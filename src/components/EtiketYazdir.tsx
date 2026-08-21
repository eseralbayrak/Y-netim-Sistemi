import { useEffect, useMemo, useState } from "react";
import type { Receipt, LabelSettings, LabelData } from "../types";
import { markLabelPrinted, updateReceipt, deleteReceipt, loadLabelSettings } from "../lib/storage";
import { findMaterial } from "../lib/materialsStorage";
import { PrintEngine } from "../lib/PrintEngine";
import EtiketAyarlari from "./EtiketAyarlari";
import { IATFFormFooter } from "./IATFFormFooter";
import BarcodeView from "./BarcodeView";
import ParcaMalzemeEtiketiView from "./ParcaMalzemeEtiketiView";
import { buildBarcodeValue } from "../utils/barcode";
import { formatDateTR } from "../lib/dateUtils";

interface Props {
  receipts: Receipt[];
  onChanged: () => void;
}

/**
 * Toplam miktarı ambalaj miktarına göre paketlere böler.
 * Ambalaj miktarı boşsa tüm miktar tek etiket olarak döner.
 */
function computePackages(toplam: number, ambalajMiktari: number | null): number[] {
  if (!ambalajMiktari || ambalajMiktari <= 0 || ambalajMiktari >= toplam) {
    return [toplam];
  }

  const tamPaket = Math.floor(toplam / ambalajMiktari);
  const kalan = Math.round((toplam - tamPaket * ambalajMiktari) * 100) / 100;

  const packages = Array(tamPaket).fill(ambalajMiktari);
  if (kalan > 0.01) packages.push(kalan);

  return packages;
}

/**
 * Onaylanmış ama henüz etiketlenmemiş kayıt
 */
function PendingCard({
  receipt,
  onChanged,
  settings,
  onPreview,
}: {
  receipt: Receipt;
  onChanged: () => void;
  settings: LabelSettings;
  onPreview: (receipt: Receipt, paketAgirligi?: number) => void;
  key?: React.Key;
}) {
  const [ambalajStr, setAmbalajStr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    findMaterial(receipt.malzemeKodu).then((m) => {
      if (m?.ambalajMiktariStandart) setAmbalajStr(String(m.ambalajMiktariStandart));
    });
  }, [receipt.malzemeKodu]);

  const ambalajMiktari = ambalajStr.trim()
    ? parseFloat(ambalajStr.replace(",", "."))
    : null;

  const packages = useMemo(
    () => computePackages(receipt.gelenMiktar, ambalajMiktari),
    [receipt.gelenMiktar, ambalajMiktari]
  );

  async function handlePrint() {
    if (!ambalajMiktari && packages.length === 1 && packages[0] === receipt.gelenMiktar) {
      const confirmed = window.confirm(
        `Ambalaj miktarı girilmedi.\n\nTÜM LOT (${receipt.gelenMiktar} KG) TEK ETİKET olarak basılacak.\n\nBu doğru mu? Yanlışsa "İptal"e basıp Ambalaj Miktarı (KG) kutusuna paket ağırlığını girin.`
      );
      if (!confirmed) return;
    }

    setBusy(true);

    try {
      await markLabelPrinted(
        receipt.id,
        ambalajMiktari ?? undefined,
        packages.length
      );

      onChanged();

      const labels: LabelData[] = packages.map((weight, idx) => ({
        receipt,
        paketAgirligi: weight,
        seq: idx + 1,
        toplamPaket: packages.length,
      }));

      await PrintEngine.print({
        labels,
        settings,
      });

      onChanged();
    } catch (error) {
      console.error("Yazdırma hatası:", error);
      alert(`Yazdırma başarısız: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="label-wrap">
      <div className="card no-print">
        <div className="card-header">
          <strong>{receipt.malzemeKodu}</strong>
          <span className="muted">{receipt.firma}</span>
        </div>

        <div className="card-meta">
          Lot: <strong>{receipt.lotNo}</strong> · Toplam Miktar: {receipt.gelenMiktar} KG
        </div>

        {/* Live Barcode Preview */}
        <div style={{ margin: "10px 0", display: "flex", justifyContent: "center", background: "#ffffff", padding: "6px", borderRadius: 4 }}>
          <BarcodeView value={buildBarcodeValue({ receipt, paketAgirligi: receipt.gelenMiktar, seq: 1, toplamPaket: 1 })} height={34} width={1.6} fontSize={8} displayValue={false} />
        </div>

        <div className="grid2">
          <label>
            Ambalaj Miktarı (KG) – boş bırakılırsa tek etiket basılır
            <input
              value={ambalajStr}
              onChange={(e) => setAmbalajStr(e.target.value)}
              placeholder="örn. 25"
              inputMode="decimal"
            />
          </label>

          <div className="package-preview">
            <span className="muted">Basılacak Etiket Sayısı</span>
            <div className="package-count">{packages.length}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onPreview(receipt, packages[0])}
            style={{ padding: "0 12px", fontSize: "0.85rem" }}
            title="Otomotiv Standart Etiket Tasarımını Önizle"
          >
            👁️ Tasarımı Gör
          </button>
          <button className="btn-primary" disabled={busy} onClick={handlePrint} style={{ flex: 1 }}>
            {packages.length > 1
              ? `${packages.length} Etiketi Yazdır ve Depoya Teslim Et`
              : "Etiketi Yazdır ve Depoya Teslim Et"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Daha önce etiketlenmiş (DEPODA) kayıt - tekrar yazdırma & düzenleme & silme
 */
function ReprintCard({
  receipt,
  onChanged,
  settings,
  onEdit,
  onDelete,
  onPreview,
}: {
  receipt: Receipt;
  onChanged: () => void;
  settings: LabelSettings;
  onEdit: (receipt: Receipt) => void;
  onDelete: (receipt: Receipt) => void;
  onPreview: (receipt: Receipt, paketAgirligi?: number) => void;
  key?: React.Key;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ambalajStr, setAmbalajStr] = useState(
    receipt.ambalajMiktari ? String(receipt.ambalajMiktari) : ""
  );

  const ambalajMiktari = ambalajStr.trim()
    ? parseFloat(ambalajStr.replace(",", "."))
    : null;

  const packages = useMemo(
    () => computePackages(receipt.gelenMiktar, ambalajMiktari),
    [receipt.gelenMiktar, ambalajMiktari]
  );

  async function handleReprint() {
    if (!ambalajMiktari && packages.length === 1 && packages[0] === receipt.gelenMiktar) {
      const confirmed = window.confirm(
        `Ambalaj miktarı girilmedi.\n\nTÜM LOT (${receipt.gelenMiktar} KG) TEK ETİKET olarak basılacak.\n\nBu doğru mu? Yanlışsa "İptal"e basıp Ambalaj Miktarı (KG) kutusuna paket ağırlığını girin.`
      );
      if (!confirmed) return;
    }

    setBusy(true);

    try {
      await updateReceipt(receipt.id, {
        ambalajMiktari: ambalajMiktari ?? undefined,
        etiketSayisi: packages.length,
      });

      onChanged();

      const labels: LabelData[] = packages.map((weight, idx) => ({
        receipt,
        paketAgirligi: weight,
        seq: idx + 1,
        toplamPaket: packages.length,
      }));

      await PrintEngine.print({
        labels,
        settings,
      });
    } catch (error) {
      console.error("Tekrar yazdırma hatası:", error);
      alert(
        `Tekrar yazdırma başarısız: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`
      );
    } finally {
      setBusy(false);
    }
  }

  const printDate = receipt.etiketBasimTarihi
    ? formatDateTR(receipt.etiketBasimTarihi)
    : "—";

  return (
    <div className="label-wrap">
      <div className="card no-print">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <strong>{receipt.malzemeKodu}</strong>
            <div className="muted" style={{ fontSize: "0.85rem" }}>{receipt.firma}</div>
          </div>
          <span className="badge" style={{ fontSize: "0.75rem", background: "#10b98122", color: "#10b981", border: "1px solid #10b98144" }}>
            DEPODA
          </span>
        </div>

        <div className="card-meta" style={{ marginTop: 8, fontSize: "0.85rem", lineHeight: 1.5 }}>
          Lot: <strong>{receipt.lotNo}</strong> · Miktar: <strong>{receipt.gelenMiktar} KG</strong>
          {receipt.irsaliyeNo ? ` · İrsaliye: ${receipt.irsaliyeNo}` : ""}
          <br />
          <span className="muted" style={{ fontSize: "0.8rem" }}>İlk basım: {printDate}</span>
        </div>

        {/* Live Barcode Preview */}
        <div style={{ margin: "10px 0 6px 0", display: "flex", justifyContent: "center", background: "#ffffff", padding: "6px", borderRadius: 4 }}>
          <BarcodeView value={buildBarcodeValue({ receipt, paketAgirligi: receipt.gelenMiktar, seq: 1, toplamPaket: 1 })} height={30} width={1.6} fontSize={8} displayValue={false} />
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onPreview(receipt, packages[0])}
            title="Otomotiv Standart Etiket Tasarımını Önizle"
            style={{ padding: "6px 8px", fontSize: "0.85rem" }}
          >
            👁️ Tasarım
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setOpen(!open)}
            style={{ flex: 1, padding: "6px 10px", fontSize: "0.85rem" }}
          >
            {open ? "▲ Kapat" : "🖨️ Tekrar Yazdır"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onEdit(receipt)}
            title="Etiket Bilgilerini Düzenle"
            style={{ padding: "6px 10px", fontSize: "0.85rem", background: "#3b82f615", color: "#60a5fa", borderColor: "#3b82f644" }}
          >
            ✏️ Düzenle
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={() => onDelete(receipt)}
            title="Etiket Kaydını Sil"
            style={{ padding: "6px 10px", fontSize: "0.85rem", background: "#ef444415", color: "#f87171", borderColor: "#ef444444" }}
          >
            🗑️ Sil
          </button>
        </div>

        {open && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--panel-border, #334155)" }}>
            <div className="grid2">
              <label>
                Ambalaj Miktarı (KG)
                <input
                  value={ambalajStr}
                  onChange={(e) => setAmbalajStr(e.target.value)}
                  placeholder="örn. 25"
                  inputMode="decimal"
                />
              </label>

              <div className="package-preview">
                <span className="muted">Basılacak Etiket Sayısı</span>
                <div className="package-count">{packages.length}</div>
              </div>
            </div>

            <button className="btn-primary" disabled={busy} onClick={handleReprint} style={{ marginTop: 8 }}>
              {packages.length} Etiketi Yeniden Yazdır
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const DEFAULT_SETTINGS: LabelSettings = {
  widthMm: 100,
  heightMm: 75,
  headerText: "PARÇA VE MALZEME TANITIM ETİKETİ",
  footerText: "Yürürlük Tarihi: 22/03/2002  Rev. Tarihi:09.03.2011  Rev.No:01  ( ÜRT/F 19 )",
  fontSizePt: 10,
  qrSizeMm: 20,
};

export default function EtiketYazdir({ receipts, onChanged }: Props) {
  const [search, setSearch] = useState("");
  const [showHistory, setShowHistory] = useState(true);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [settings, setSettings] = useState<LabelSettings>(DEFAULT_SETTINGS);

  // Label visual preview modal state
  const [previewReceipt, setPreviewReceipt] = useState<{ receipt: Receipt; paketAgirligi: number } | null>(null);

  // Edit modal state
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);
  const [editForm, setEditForm] = useState<{
    malzemeKodu: string;
    lotNo: string;
    firma: string;
    gelenMiktar: string;
    ambalajMiktari: string;
    irsaliyeNo: string;
    siparisNo: string;
    faturaNo: string;
  }>({
    malzemeKodu: "",
    lotNo: "",
    firma: "",
    gelenMiktar: "",
    ambalajMiktari: "",
    irsaliyeNo: "",
    siparisNo: "",
    faturaNo: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete modal state
  const [deletingReceipt, setDeletingReceipt] = useState<Receipt | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadLabelSettings().then(setSettings);
  }, []);

  const ready = receipts.filter((r) => r.durum === "ONAYLANDI");
  const printedAll = receipts.filter((r) => r.durum === "DEPODA");

  const filteredPrinted = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return printedAll;
    return printedAll.filter(
      (r) =>
        r.lotNo.toLowerCase().includes(q) ||
        r.malzemeKodu.toLowerCase().includes(q) ||
        (r.firma && r.firma.toLowerCase().includes(q)) ||
        (r.irsaliyeNo && r.irsaliyeNo.toLowerCase().includes(q)) ||
        (r.siparisNo && r.siparisNo.toLowerCase().includes(q)) ||
        (r.faturaNo && r.faturaNo.toLowerCase().includes(q))
    );
  }, [printedAll, search]);

  const printedToDisplay = useMemo(() => {
    if (search.trim() || showAllHistory) {
      return filteredPrinted;
    }
    return filteredPrinted.slice(0, 15);
  }, [filteredPrinted, search, showAllHistory]);

  function handleOpenEdit(receipt: Receipt) {
    setEditingReceipt(receipt);
    setEditForm({
      malzemeKodu: receipt.malzemeKodu || "",
      lotNo: receipt.lotNo || "",
      firma: receipt.firma || "",
      gelenMiktar: receipt.gelenMiktar !== undefined ? String(receipt.gelenMiktar) : "",
      ambalajMiktari: receipt.ambalajMiktari !== undefined ? String(receipt.ambalajMiktari) : "",
      irsaliyeNo: receipt.irsaliyeNo || "",
      siparisNo: receipt.siparisNo || "",
      faturaNo: receipt.faturaNo || "",
    });
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingReceipt) return;

    if (!editForm.malzemeKodu.trim() || !editForm.lotNo.trim()) {
      alert("Malzeme Kodu ve Lot No boş bırakılamaz.");
      return;
    }

    setSavingEdit(true);
    try {
      const miktarNum = editForm.gelenMiktar ? parseFloat(editForm.gelenMiktar.replace(",", ".")) : editingReceipt.gelenMiktar;
      const ambNum = editForm.ambalajMiktari ? parseFloat(editForm.ambalajMiktari.replace(",", ".")) : undefined;

      await updateReceipt(editingReceipt.id, {
        malzemeKodu: editForm.malzemeKodu.trim(),
        lotNo: editForm.lotNo.trim(),
        firma: editForm.firma.trim(),
        gelenMiktar: isNaN(miktarNum) ? editingReceipt.gelenMiktar : miktarNum,
        ambalajMiktari: ambNum,
        irsaliyeNo: editForm.irsaliyeNo.trim(),
        siparisNo: editForm.siparisNo.trim(),
        faturaNo: editForm.faturaNo.trim(),
      });

      setEditingReceipt(null);
      onChanged();
    } catch (err: any) {
      alert("Düzenleme kaydedilirken bir hata oluştu: " + (err?.message || "Bilinmeyen hata"));
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingReceipt) return;
    setDeleting(true);
    try {
      await deleteReceipt(deletingReceipt.id);
      setDeletingReceipt(null);
      onChanged();
    } catch (err: any) {
      alert("Silme işlemi sırasında hata oluştu: " + (err?.message || "Bilinmeyen hata"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <EtiketAyarlari settings={settings} onChanged={setSettings} />

      <div className="panel">
        <h2 className="no-print">Etiket Basım – {ready.length} Kayıt Onaylı</h2>

        {ready.length === 0 ? (
          <p className="muted no-print">Etiket basımını bekleyen onaylı kayıt yok.</p>
        ) : (
          <div className="labels-grid">
            {ready.map((r) => (
              <PendingCard
                key={r.id}
                receipt={r}
                onChanged={onChanged}
                settings={settings}
                onPreview={(rc, weight) => setPreviewReceipt({ receipt: rc, paketAgirligi: weight ?? rc.gelenMiktar })}
              />
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            Geçmiş Etiketler – Tekrar Yazdır
            <span className="badge" style={{ fontSize: "0.85rem", padding: "4px 8px", background: "var(--badge-bg, rgba(255,255,255,0.1))" }}>
              {printedAll.length} Kayıt
            </span>
          </h2>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowHistory(!showHistory)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", fontWeight: "600" }}
          >
            {showHistory ? "🙈 Gizle" : "👁️ Göster"}
          </button>
        </div>

        {showHistory && (
          <>
            <div className="no-print" style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              <input
                className="scan-input"
                style={{ flex: 1, minWidth: 260, margin: 0 }}
                placeholder="Lot no, malzeme kodu, firma, irsaliye/fatura no ile ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSearch("")}
                  style={{ padding: "8px 12px" }}
                >
                  Aramayı Temizle
                </button>
              )}
            </div>

            {filteredPrinted.length === 0 ? (
              <p className="muted no-print">
                {search ? `"${search}" kriterine uygun etiket kaydı bulunamadı.` : "Henüz geçmiş etiket kaydı bulunmuyor."}
              </p>
            ) : (
              <>
                <div className="labels-grid">
                  {printedToDisplay.map((r) => (
                    <ReprintCard
                      key={r.id}
                      receipt={r}
                      onChanged={onChanged}
                      settings={settings}
                      onEdit={handleOpenEdit}
                      onDelete={(rc) => setDeletingReceipt(rc)}
                      onPreview={(rc, weight) => setPreviewReceipt({ receipt: rc, paketAgirligi: weight ?? rc.gelenMiktar })}
                    />
                  ))}
                </div>

                {!search && printedAll.length > 15 && (
                  <div className="no-print" style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <p className="muted" style={{ margin: 0 }}>
                      {showAllHistory
                        ? `Toplam ${printedAll.length} etiket kaydı gösteriliyor.`
                        : `Son 15 kayıt gösteriliyor (${printedAll.length} toplam).`}
                    </p>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowAllHistory(!showAllHistory)}
                      style={{ padding: "6px 12px", fontSize: "0.85rem" }}
                    >
                      {showAllHistory ? "İlk 15 Kaydı Göster" : `Tümünü Göster (${printedAll.length})`}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        <IATFFormFooter formId="ETK_F07" defaultKodu="ETK/F07" defaultAdi="Hammadde Barkod Etiket Formu" />
      </div>

      {/* DÜZENLEME MODALI */}
      {editingReceipt && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.65)",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--panel-bg, #1e293b)",
              color: "var(--panel-text, #f8fafc)",
              padding: 24,
              borderRadius: 12,
              maxWidth: 520,
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)",
              border: "1px solid var(--panel-border, #334155)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: "#60a5fa", display: "flex", alignItems: "center", gap: 8 }}>
                ✏️ Etiket Kaydını Düzenle
              </h3>
              <button
                type="button"
                onClick={() => setEditingReceipt(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="grid2">
                <label>
                  Malzeme Kodu *
                  <input
                    type="text"
                    required
                    value={editForm.malzemeKodu}
                    onChange={(e) => setEditForm({ ...editForm, malzemeKodu: e.target.value })}
                  />
                </label>
                <label>
                  Lot No *
                  <input
                    type="text"
                    required
                    value={editForm.lotNo}
                    onChange={(e) => setEditForm({ ...editForm, lotNo: e.target.value })}
                  />
                </label>
              </div>

              <div className="grid2">
                <label>
                  Tedarikçi / Firma
                  <input
                    type="text"
                    value={editForm.firma}
                    onChange={(e) => setEditForm({ ...editForm, firma: e.target.value })}
                  />
                </label>
                <label>
                  Gelen Miktar (KG)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editForm.gelenMiktar}
                    onChange={(e) => setEditForm({ ...editForm, gelenMiktar: e.target.value })}
                  />
                </label>
              </div>

              <div className="grid2">
                <label>
                  Ambalaj Miktarı (KG)
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="örn. 25"
                    value={editForm.ambalajMiktari}
                    onChange={(e) => setEditForm({ ...editForm, ambalajMiktari: e.target.value })}
                  />
                </label>
                <label>
                  İrsaliye No
                  <input
                    type="text"
                    value={editForm.irsaliyeNo}
                    onChange={(e) => setEditForm({ ...editForm, irsaliyeNo: e.target.value })}
                  />
                </label>
              </div>

              <div className="grid2">
                <label>
                  Sipariş No
                  <input
                    type="text"
                    value={editForm.siparisNo}
                    onChange={(e) => setEditForm({ ...editForm, siparisNo: e.target.value })}
                  />
                </label>
                <label>
                  Fatura No
                  <input
                    type="text"
                    value={editForm.faturaNo}
                    onChange={(e) => setEditForm({ ...editForm, faturaNo: e.target.value })}
                  />
                </label>
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingReceipt(null)}
                  disabled={savingEdit}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={savingEdit}
                  style={{ fontWeight: "bold" }}
                >
                  {savingEdit ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SİLME ONAY MODALI */}
      {deletingReceipt && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.65)",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--panel-bg, #1e293b)",
              color: "var(--panel-text, #f8fafc)",
              padding: 24,
              borderRadius: 12,
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)",
              border: "1px solid var(--panel-border, #334155)",
            }}
          >
            <h3 style={{ marginTop: 0, color: "#ef4444", display: "flex", alignItems: "center", gap: 8 }}>
              ⚠️ Etiket Kaydını Sil
            </h3>
            <p style={{ margin: "16px 0 24px 0", fontSize: "0.95rem", lineHeight: 1.5 }}>
              <strong>"{deletingReceipt.lotNo}"</strong> lot numaralı ({deletingReceipt.malzemeKodu}) etiket kaydını ve ilgili stok tanımını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeletingReceipt(null)}
                disabled={deleting}
              >
                İptal
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmDelete}
                disabled={deleting}
                style={{ backgroundColor: "#ef4444", borderColor: "#ef4444", fontWeight: "bold" }}
              >
                {deleting ? "Siliniyor..." : "Evet, Sil"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANLI ETİKET TASARIM ÖNİZLEME MODALI */}
      {previewReceipt && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.75)",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--panel-bg, #1e293b)",
              color: "var(--panel-text, #f8fafc)",
              padding: 24,
              borderRadius: 12,
              maxWidth: 640,
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)",
              border: "1px solid var(--panel-border, #334155)",
              maxHeight: "92vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, color: "#38bdf8", display: "flex", alignItems: "center", gap: 8 }}>
                  🏷️ Etiket Tasarım Önizlemesi (ÜRT/F 19)
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
                  Otomotiv Parça ve Malzeme Tanıtım Etiketi standardı
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReceipt(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "1.4rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: "#0f172a", padding: 16, borderRadius: 8, overflowX: "auto" }}>
              <ParcaMalzemeEtiketiView
                receipt={previewReceipt.receipt}
                paketAgirligi={previewReceipt.paketAgirligi}
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPreviewReceipt(null)}
              >
                Kapat
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  const r = previewReceipt.receipt;
                  const w = previewReceipt.paketAgirligi;
                  setPreviewReceipt(null);
                  await PrintEngine.print({
                    labels: [{ receipt: r, paketAgirligi: w, seq: 1, toplamPaket: 1 }],
                    settings,
                  });
                }}
                style={{ fontWeight: "bold" }}
              >
                🖨️ Bu Etiketi Yazdır
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

