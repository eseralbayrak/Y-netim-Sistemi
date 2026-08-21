import { useEffect, useMemo, useState } from "react";
import type { AuxiliaryPart, CustomQualitySpec } from "../types";
import {
  loadAuxiliaryParts,
  addAuxiliaryPart,
  updateAuxiliaryPart,
  deleteAuxiliaryPart,
  nextAuxiliarySira,
  loadAuxiliarySuppliers,
  addAuxiliarySupplierIfNew,
  saveAuxiliarySuppliers,
  deleteAuxiliarySupplier,
  extractAuxiliarySuppliers,
} from "../lib/auxiliaryStorage";
import { validatePdf, uploadDocument } from "../lib/fileUtils";
import { getStoredUser } from "../lib/auth";
import DocHoverBadge from "./DocHoverBadge";
import { IATFFormFooter } from "./IATFFormFooter";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const PRESET_SPECS = [
  { name: "Dış Çap", unit: "mm" },
  { name: "İç Çap", unit: "mm" },
  { name: "Et Kalınlığı", unit: "mm" },
  { name: "Sertlik", unit: "Shore A" },
  { name: "Ağırlık", unit: "g" },
  { name: "Sıkma Torku", unit: "Nm" },
  { name: "Kaplama Kalınlığı", unit: "µm" },
  { name: "Görsel Uygunluk", unit: "Tolerans" },
];

const emptyForm = (sira: number): AuxiliaryPart => ({
  sira,
  firma: "",
  kod: "",
  cins: "",
  birim: "ADET",
  stokMiktari: 0,
  minMiktar: null,
  stoklamaKosullari: "",
  ambalajMiktariStandart: 100,
  qualitySpecs: [],
});

export default function YardimciParcaTanimlari() {
  const [parts, setParts] = useState<AuxiliaryPart[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingKod, setEditingKod] = useState<string | null>(null);
  const [form, setForm] = useState<AuxiliaryPart>(() => emptyForm(1));
  const [error, setError] = useState("");
  const [docError, setDocError] = useState("");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  // Tedarikçi Yönetim Modalı State
  const [supModalOpen, setSupModalOpen] = useState(false);
  const [newSupInput, setNewSupInput] = useState("");
  const [editingSupIndex, setEditingSupIndex] = useState<number | null>(null);
  const [editingSupValue, setEditingSupValue] = useState("");

  // Silme & Dashboard State
  const [deleteTargetKod, setDeleteTargetKod] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [showList, setShowList] = useState(true);

  const currentUser = getStoredUser();
  const canDelete = currentUser?.role === "Yönetici" || currentUser?.role === "Giriş Kalite";

  async function confirmDeletePart() {
    if (!deleteTargetKod) return;
    setDeleting(true);
    try {
      await deleteAuxiliaryPart(deleteTargetKod);
      setDeleteTargetKod(null);
      refresh();
    } catch (err: any) {
      alert(err.message || "Silinemedi.");
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    refresh();
    loadAuxiliarySuppliers().then(setSuppliers);
  }, []);

  function refresh() {
    loadAuxiliaryParts().then(setParts);
  }

  async function handleAddSupplierModal() {
    if (!newSupInput.trim()) return;
    try {
      const updated = await addAuxiliarySupplierIfNew(newSupInput.trim());
      setSuppliers(updated);
      setNewSupInput("");
    } catch (e: any) {
      alert(e.message || "Tedarikçi eklenemedi.");
    }
  }

  async function handleSaveEditSupplier(index: number) {
    if (!editingSupValue.trim()) return;
    const oldName = suppliers[index];
    const newName = editingSupValue.trim();
    if (oldName === newName) {
      setEditingSupIndex(null);
      return;
    }
    const updatedList = [...suppliers];
    updatedList[index] = newName;
    try {
      await saveAuxiliarySuppliers(updatedList);
      setSuppliers(updatedList);
      setEditingSupIndex(null);
    } catch (e: any) {
      alert(e.message || "Tedarikçi güncellenemedi.");
    }
  }

  async function handleDeleteSupplierModal(name: string) {
    if (!window.confirm(`"${name}" tedarikçisini listeden silmek istediğinize emin misiniz?`)) return;
    try {
      const updated = await deleteAuxiliarySupplier(name);
      setSuppliers(updated);
    } catch (e: any) {
      alert(e.message || "Tedarikçi silinemedi.");
    }
  }

  async function handleExtractSuppliers() {
    try {
      const updated = await extractAuxiliarySuppliers();
      setSuppliers(updated);
      alert(`Tanımlı yardımcı parçalardan ${updated.length} adet benzersiz tedarikçi listesi güncellendi.`);
    } catch (e: any) {
      alert(e.message || "Tedarikçiler ayıklanamadı.");
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return parts;
    const q = search.toLowerCase();
    return parts.filter(
      (p) =>
        p.kod.toLowerCase().includes(q) ||
        (p.cins || "").toLowerCase().includes(q) ||
        (p.firma || "").toLowerCase().includes(q)
    );
  }, [parts, search]);

  async function openNewForm() {
    setForm(emptyForm(await nextAuxiliarySira()));
    setEditingKod(null);
    setError("");
    setFormOpen(true);
  }

  function openEditForm(p: AuxiliaryPart) {
    setForm({
      ...p,
      qualitySpecs: p.qualitySpecs ? [...p.qualitySpecs] : [],
    });
    setEditingKod(p.kod);
    setError("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setError("");
  }

  // Özel Kalite Spec Parametresi Ekleme / Güncelleme / Silme
  function addSpecParam(name = "", unit = "") {
    const newSpec: CustomQualitySpec = {
      id: "spec-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      paramName: name,
      unit: unit,
      minValue: null,
      maxValue: null,
      targetValue: "",
      description: "",
    };
    setForm((prev) => ({
      ...prev,
      qualitySpecs: [...(prev.qualitySpecs || []), newSpec],
    }));
  }

  function updateSpecParam(id: string, patch: Partial<CustomQualitySpec>) {
    setForm((prev) => ({
      ...prev,
      qualitySpecs: (prev.qualitySpecs || []).map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }

  function removeSpecParam(id: string) {
    setForm((prev) => ({
      ...prev,
      qualitySpecs: (prev.qualitySpecs || []).filter((s) => s.id !== id),
    }));
  }

  async function handleSave() {
    setError("");
    if (!form.kod.trim()) {
      setError("Parça kodu zorunludur.");
      return;
    }
    if (!form.firma.trim()) {
      setError("Tedarikçi firma zorunludur.");
      return;
    }

    // Spec min > max kontrolleri
    if (form.qualitySpecs) {
      for (const spec of form.qualitySpecs) {
        if (
          spec.minValue !== null &&
          spec.minValue !== undefined &&
          spec.maxValue !== null &&
          spec.maxValue !== undefined
        ) {
          if (spec.minValue > spec.maxValue) {
            setError(`"${spec.paramName || 'Spec'}": Min değeri (${spec.minValue}), Max değerinden (${spec.maxValue}) büyük olamaz.`);
            return;
          }
        }
      }
    }

    try {
      if (editingKod) {
        await updateAuxiliaryPart(editingKod, form);
      } else {
        await addAuxiliaryPart(form);
      }
      if (form.firma) {
        await addAuxiliarySupplierIfNew(form.firma);
        loadAuxiliarySuppliers().then(setSuppliers);
      }
      refresh();
      closeForm();
    } catch (err: any) {
      setError(err.message || "Kaydederken bir hata oluştu.");
    }
  }

  async function handleDocUpload(file: File, docType: "tds" | "msds") {
    setDocError("");
    const err = validatePdf(file);
    if (err) {
      setDocError(err);
      return;
    }
    setUploadingKey(docType);
    try {
      const doc = await uploadDocument(docType, form.kod || "GECICI", file);
      setForm((prev) => ({ ...prev, [docType]: doc }));
    } catch (e: any) {
      setDocError(e.message || "Dosya yüklenemedi.");
    } finally {
      setUploadingKey(null);
    }
  }

  function exportExcel() {
    const data = filtered.map((p) => ({
      "Sıra No": p.sira,
      "Parça Kodu": p.kod,
      "Parça Cinsi / Açıklaması": p.cins || "-",
      "Tedarikçi Firma": p.firma,
      "Birim": p.birim || "ADET",
      "Stok Miktarı": p.stokMiktari ?? 0,
      "Min Stok Miktarı": p.minMiktar ?? "-",
      "Standart Ambalaj Miktarı": p.ambalajMiktariStandart ?? "-",
      "Stoklama Koşulları": p.stoklamaKosullari || "-",
      "Özel Kalite Spec Sayısı": p.qualitySpecs?.length || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Yardımcı Parçalar");
    XLSX.writeFile(wb, "Yardimci_Parca_Tanimlari.xlsx");
  }

  async function exportPdf() {
    const el = document.getElementById("aux-parts-table");
    if (!el) return;
    const canvas = await html2canvas(el, { backgroundColor: "#ffffff", scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("l", "mm", "a4");
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, "PNG", 0, 10, pdfWidth, pdfHeight);
    pdf.save("Yardimci_Parca_Tanimlari.pdf");
  }

  return (
    <div className="card">
      <div className="card-header flex-between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2>⚙️ Yardımcı Parça Tanımları</h2>
          <p className="muted">
            Fabrika genelindeki yardımcı parçalar, cıvatalar, somunlar, o-ringler, kutular ve diğer komponentlerin tanımsal listesi ve parçaya özel kalite spec sınırları.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn-secondary" onClick={() => setSupModalOpen(true)}>
            🏢 Tedarikçi Listesi ({suppliers.length})
          </button>
          <button type="button" className="btn-secondary" onClick={exportExcel}>
            📊 Excel İndir
          </button>
          <button type="button" className="btn-secondary" onClick={exportPdf}>
            📄 PDF İndir
          </button>
          <button type="button" className="btn-primary" onClick={openNewForm}>
            ➕ Yeni Yardımcı Parça Tanımla
          </button>
        </div>
      </div>

      <div className="filter-row flex-between" style={{ marginTop: 16, marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <input
          type="text"
          placeholder="🔍 Parça Kodu, Parça Cinsi veya Tedarikçi Ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
          style={{ width: "100%", maxWidth: 400 }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--muted)" }}>📋 Liste Görünümü:</span>
          <select
            value={showList ? "show" : "hide"}
            onChange={(e) => setShowList(e.target.value === "show")}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: "0.85rem",
              fontWeight: 600,
              background: "var(--panel-bg)",
              color: "var(--text)",
              border: "1px solid var(--panel-border)",
              cursor: "pointer",
            }}
          >
            <option value="show">👁️ Parça Listesini Göster</option>
            <option value="hide">🙈 Parça Listesini Gizle</option>
          </select>
          <button
            type="button"
            className="btn-secondary btn-small"
            onClick={() => setShowList(!showList)}
            style={{ fontSize: "0.85rem", fontWeight: 600 }}
          >
            {showList ? "▲ Listeyi Gizle" : "▼ Listeyi Göster"}
          </button>
        </div>
      </div>

      {showList ? (
        <div className="table-responsive" id="aux-parts-table">
          <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>Sıra</th>
              <th>Tedarikçi Firma</th>
              <th>Parça Kodu</th>
              <th>Parça Cinsi / Tanımı</th>
              <th>Birim</th>
              <th>Std. Kutu/Ambalaj</th>
              <th>Min Stok</th>
              <th>Kalite Spec Sınırları</th>
              <th>Teknik Belge (TDS/Çizim)</th>
              <th style={{ width: 110, textAlign: "center" }}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center muted" style={{ padding: 24 }}>
                  Kayıtlı yardımcı parça bulunamadı.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.kod}>
                  <td>{p.sira}</td>
                  <td><strong>{p.firma}</strong></td>
                  <td><strong className="badge-info" style={{ fontFamily: "monospace", fontSize: "0.9rem" }}>{p.kod}</strong></td>
                  <td>{p.cins || "-"}</td>
                  <td>{p.birim || "ADET"}</td>
                  <td>{p.ambalajMiktariStandart ? `${p.ambalajMiktariStandart} ${p.birim || "ADET"}` : "-"}</td>
                  <td>{p.minMiktar !== null && p.minMiktar !== undefined ? `${p.minMiktar} ${p.birim || "ADET"}` : "-"}</td>
                  <td>
                    {p.qualitySpecs && p.qualitySpecs.length > 0 ? (
                      <div style={{ fontSize: "0.85rem" }}>
                        {p.qualitySpecs.slice(0, 2).map((s) => (
                          <div key={s.id}>
                            • {s.paramName}: {s.minValue ?? "-"} / {s.maxValue ?? "-"} {s.unit}
                          </div>
                        ))}
                        {p.qualitySpecs.length > 2 && (
                          <span className="muted" style={{ fontSize: "0.75rem" }}>
                            +{p.qualitySpecs.length - 2} spec daha
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="muted">Spec Yok</span>
                    )}
                  </td>
                  <td>
                    <DocHoverBadge
                      label=""
                      doc={p.tds}
                      uploading={uploadingKey === `tds-${p.kod}`}
                      onUpload={async (file) => {
                        if (!file) return;
                        setUploadingKey(`tds-${p.kod}`);
                        try {
                          const doc = await uploadDocument("tds", p.kod, file);
                          await updateAuxiliaryPart(p.kod, { tds: doc });
                          refresh();
                        } catch (e: any) {
                          alert(e.message || "TDS Yüklenemedi.");
                        } finally {
                          setUploadingKey(null);
                        }
                      }}
                    />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                      <button
                        type="button"
                        className="btn-small btn-secondary"
                        onClick={() => openEditForm(p)}
                        title="Düzenle"
                      >
                        ✏️
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          className="btn-small btn-danger"
                          onClick={() => setDeleteTargetKod(p.kod)}
                          title="Düşüm yapmadan direkt sil (Yönetici / Giriş Kalite)"
                        >
                          🗑️ Sil
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      ) : (
        <div
          style={{
            padding: 24,
            textAlign: "center",
            background: "rgba(0,0,0,0.15)",
            borderRadius: 8,
            border: "1px dashed var(--panel-border)",
            color: "var(--muted)",
            marginBottom: 20,
          }}
        >
          🙈 Yardımcı Parça Tanım Listesi gizlendi. Listeyi tekrar görüntülemek için yukarıdaki <strong>"Parça Listesini Göster"</strong> seçeneğini seçebilir veya butona tıklayabilirsiniz.
        </div>
      )}

      {/* Özet Gösterge Paneli */}
      <div style={{ marginTop: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            cursor: "pointer",
            userSelect: "none",
          }}
          onClick={() => setShowAnalytics(!showAnalytics)}
        >
          <h3 style={{ fontSize: "1.1rem", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            📊 Yardımcı Parça Özet Gösterge Paneli ve İstatistikler
          </h3>
          <button
            type="button"
            className="btn-secondary btn-small no-print"
            style={{ fontSize: "0.85rem", padding: "4px 10px" }}
          >
            {showAnalytics ? "▲ Gösterge Panelini Gizle" : "▼ Gösterge Panelini Aç"}
          </button>
        </div>

        {showAnalytics && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            <div style={{ background: "rgba(59, 130, 246, 0.08)", padding: 12, borderRadius: 8, borderLeft: "4px solid #3b82f6" }}>
              <span className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase" }}>Tanımlı Parça Çeşidi</span>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{parts.length} Kalem</div>
            </div>
            <div style={{ background: "rgba(16, 185, 129, 0.08)", padding: 12, borderRadius: 8, borderLeft: "4px solid #10b981" }}>
              <span className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase" }}>Toplam Stok Miktarı</span>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
                {parts.reduce((a, b) => a + (Number(b.stokMiktari) || 0), 0).toLocaleString()} Birim
              </div>
            </div>
            <div
              style={{
                background: parts.filter((p) => p.minMiktar != null && (p.stokMiktari ?? 0) <= Number(p.minMiktar)).length > 0
                  ? "rgba(239, 68, 68, 0.08)"
                  : "rgba(107, 114, 128, 0.08)",
                padding: 12,
                borderRadius: 8,
                borderLeft: parts.filter((p) => p.minMiktar != null && (p.stokMiktari ?? 0) <= Number(p.minMiktar)).length > 0
                  ? "4px solid #ef4444"
                  : "4px solid #6b7280",
              }}
            >
              <span className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase" }}>Kritik Seviyede</span>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  color: parts.filter((p) => p.minMiktar != null && (p.stokMiktari ?? 0) <= Number(p.minMiktar)).length > 0
                    ? "#ef4444"
                    : "inherit",
                }}
              >
                {parts.filter((p) => p.minMiktar != null && (p.stokMiktari ?? 0) <= Number(p.minMiktar)).length} Kalem
              </div>
            </div>
            <div style={{ background: "rgba(139, 92, 246, 0.08)", padding: 12, borderRadius: 8, borderLeft: "4px solid #8b5cf6" }}>
              <span className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase" }}>Aktif Tedarikçi</span>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{suppliers.length} Firma</div>
            </div>
            <div style={{ background: "rgba(236, 72, 153, 0.08)", padding: 12, borderRadius: 8, borderLeft: "4px solid #ec4899" }}>
              <span className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase" }}>Kalite Spec Tanımlı</span>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
                {parts.filter((p) => p.qualitySpecs && p.qualitySpecs.length > 0).length} Parça
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Silme Onay Modalı (Koyu Tema & Yüksek Kontrast) */}
      {deleteTargetKod && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: 460,
              width: "92%",
              padding: "24px 28px",
              borderRadius: 12,
              background: "#1e293b",
              color: "#f8fafc",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
              border: "1px solid #334155",
            }}
          >
            <h3 style={{ marginTop: 0, color: "#ef4444", display: "flex", alignItems: "center", gap: 8, fontSize: "1.2rem", fontWeight: 700 }}>
              ⚠️ Yardımcı Parça Tanımını Sil
            </h3>
            <p style={{ margin: "16px 0 24px 0", lineHeight: 1.6, fontSize: "0.95rem", color: "#cbd5e1" }}>
              <strong style={{ fontFamily: "monospace", color: "#38bdf8", background: "rgba(56, 189, 248, 0.15)", padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(56, 189, 248, 0.3)" }}>
                {deleteTargetKod}
              </strong>{" "}
              numaralı yardımcı parça kaydını düşüm yapmadan sistemden <strong style={{ color: "#f8fafc" }}>direkt silmek istediğinize emin misiniz?</strong>
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeleteTargetKod(null)}
                disabled={deleting}
                style={{ padding: "8px 16px" }}
              >
                İptal Et
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={confirmDeletePart}
                disabled={deleting}
                style={{ minWidth: 110, padding: "8px 16px" }}
              >
                {deleting ? "Siliniyor..." : "Evet, Sil"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form: Yeni Yardımcı Parça / Düzenle */}
      {formOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <h3>{editingKod ? `✏️ Yardımcı Parça Düzenle (${editingKod})` : "➕ Yeni Yardımcı Parça Tanımla"}</h3>
              <button type="button" className="close-btn" onClick={closeForm}>
                ×
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: "75vh", overflowY: "auto" }}>
              {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}

              <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label>Sıra No</label>
                  <input
                    type="number"
                    value={form.sira}
                    onChange={(e) => setForm({ ...form, sira: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label>Parça Kodu *</label>
                  <input
                    type="text"
                    placeholder="örn: YP-101 / M6-C12"
                    value={form.kod}
                    onChange={(e) => setForm({ ...form, kod: e.target.value.toUpperCase() })}
                    disabled={!!editingKod}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: "span 2" }}>
                  <label>Parça Cinsi / Tanımı *</label>
                  <input
                    type="text"
                    placeholder="örn: M6x20 Paslanmaz İmbus Cıvata / Silikon O-Ring 25mm"
                    value={form.cins || ""}
                    onChange={(e) => setForm({ ...form, cins: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Tedarikçi Firma *</label>
                  <input
                    type="text"
                    list="aux-suppliers-list"
                    placeholder="Tedarikçi Firma Seçin veya Yazın"
                    value={form.firma}
                    onChange={(e) => setForm({ ...form, firma: e.target.value })}
                  />
                  <datalist id="aux-suppliers-list">
                    {suppliers.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>

                <div className="form-group">
                  <label>Ölçü Birimi</label>
                  <select
                    value={form.birim || "ADET"}
                    onChange={(e) => setForm({ ...form, birim: e.target.value })}
                  >
                    <option value="ADET">ADET</option>
                    <option value="KG">KG</option>
                    <option value="METRE">METRE</option>
                    <option value="PAKET">PAKET</option>
                    <option value="KUTU">KUTU</option>
                    <option value="SET">SET</option>
                    <option value="LİTRE">LİTRE</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Standart Ambalaj / Kutu İçi Miktarı</label>
                  <input
                    type="number"
                    placeholder="örn: 100 (Bir kutudaki adet)"
                    value={form.ambalajMiktariStandart ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        ambalajMiktariStandart: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Kritik Minimum Stok Seviyesi</label>
                  <input
                    type="number"
                    placeholder="örn: 50"
                    value={form.minMiktar ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        minMiktar: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>

                <div className="form-group" style={{ gridColumn: "span 2" }}>
                  <label>Stoklama Koşulları / Özel Notlar</label>
                  <input
                    type="text"
                    placeholder="örn: Kuru ortamda, nemden uzak kutularda saklanmalı"
                    value={form.stoklamaKosullari || ""}
                    onChange={(e) => setForm({ ...form, stoklamaKosullari: e.target.value })}
                  />
                </div>
              </div>

              {/* Her Parçaya Özel Kalite Spec Sınırları */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border-color, #e2e8f0)" }}>
                <div className="flex-between" style={{ alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <h4 style={{ margin: 0 }}>📏 Parçaya Özel Kalite Spec Sınırları</h4>
                    <p className="muted" style={{ fontSize: "0.82rem", margin: "2px 0 0 0" }}>
                      Bu yardımcı parçanın kalite kontrolde test edilecek sınır ve tolerans değerlerini tanımlayın.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-small btn-secondary"
                    onClick={() => addSpecParam()}
                  >
                    ➕ Yeni Spec Ekle
                  </button>
                </div>

                {/* Hızlı Şablon Ekleme Butonları */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  <span className="muted" style={{ fontSize: "0.8rem", alignSelf: "center" }}>Hızlı Şablonlar:</span>
                  {PRESET_SPECS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      className="btn-small btn-secondary"
                      style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                      onClick={() => addSpecParam(preset.name, preset.unit)}
                    >
                      +{preset.name} ({preset.unit})
                    </button>
                  ))}
                </div>

                {/* Spec Parametre Listesi */}
                {(!form.qualitySpecs || form.qualitySpecs.length === 0) ? (
                  <div className="muted" style={{ padding: 12, backgroundColor: "var(--bg-secondary, #f8fafc)", borderRadius: 6, textAlign: "center" }}>
                    Henüz tanımlanmış bir kalite spec sınırı yok. Yukarıdaki butonlardan ekleyebilirsiniz.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {form.qualitySpecs.map((spec) => (
                      <div
                        key={spec.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 30px",
                          gap: 8,
                          alignItems: "center",
                          backgroundColor: "var(--bg-secondary, #f8fafc)",
                          padding: 8,
                          borderRadius: 6,
                          border: "1px solid var(--border-color, #e2e8f0)",
                        }}
                      >
                        <div>
                          <input
                            type="text"
                            placeholder="Parametre Adı (örn: Dış Çap)"
                            value={spec.paramName}
                            onChange={(e) => updateSpecParam(spec.id, { paramName: e.target.value })}
                            style={{ width: "100%", fontSize: "0.85rem" }}
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="Birim (mm, g)"
                            value={spec.unit || ""}
                            onChange={(e) => updateSpecParam(spec.id, { unit: e.target.value })}
                            style={{ width: "100%", fontSize: "0.85rem" }}
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            step="any"
                            placeholder="Min Değer"
                            value={spec.minValue ?? ""}
                            onChange={(e) =>
                              updateSpecParam(spec.id, {
                                minValue: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                            style={{ width: "100%", fontSize: "0.85rem" }}
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            step="any"
                            placeholder="Max Değer"
                            value={spec.maxValue ?? ""}
                            onChange={(e) =>
                              updateSpecParam(spec.id, {
                                maxValue: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                            style={{ width: "100%", fontSize: "0.85rem" }}
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="Hedef / Nominal"
                            value={spec.targetValue ?? ""}
                            onChange={(e) => updateSpecParam(spec.id, { targetValue: e.target.value })}
                            style={{ width: "100%", fontSize: "0.85rem" }}
                          />
                        </div>
                        <div>
                          <button
                            type="button"
                            className="btn-small btn-danger"
                            onClick={() => removeSpecParam(spec.id)}
                            title="Spec Sil"
                            style={{ padding: "4px 8px" }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Belge Yükleme Bölümü */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border-color, #e2e8f0)" }}>
                <h4>📑 Teknik Dokümanlar & Şartnameler</h4>
                <p className="muted" style={{ fontSize: "0.8rem", margin: "2px 0 8px 0" }}>
                  💡 Parçaya ait genel teknik çizim ve şartnameler. Sevkiyat / parti bazlı belgeler (Final Kontrol, Malzeme Raporu, Kaplama Raporu) ise Mal Kabul ve Kalite Kontrol modülünde her gelen lota özel yüklenmektedir.
                </p>
                {docError && <p className="error" style={{ fontSize: "0.85rem" }}>{docError}</p>}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>Teknik Çizim / Ürün Şartnamesi (PDF)</label>
                    <div style={{ marginTop: 4 }}>
                      {form.tds ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className="badge badge-ok">📄 {form.tds.name}</span>
                          <button
                            type="button"
                            className="btn-small btn-danger"
                            onClick={() => setForm({ ...form, tds: undefined })}
                          >
                            Kaldır
                          </button>
                        </div>
                      ) : (
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={(e) => e.target.files?.[0] && handleDocUpload(e.target.files[0], "tds")}
                          disabled={uploadingKey === "tds"}
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>Kalite / Standart Onay Sertifikası (PDF)</label>
                    <div style={{ marginTop: 4 }}>
                      {form.msds ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className="badge badge-ok">📄 {form.msds.name}</span>
                          <button
                            type="button"
                            className="btn-small btn-danger"
                            onClick={() => setForm({ ...form, msds: undefined })}
                          >
                            Kaldır
                          </button>
                        </div>
                      ) : (
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={(e) => e.target.files?.[0] && handleDocUpload(e.target.files[0], "msds")}
                          disabled={uploadingKey === "msds"}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ marginTop: 16 }}>
              <button type="button" className="btn-secondary" onClick={closeForm}>
                İptal
              </button>
              <button type="button" className="btn-primary" onClick={handleSave}>
                💾 Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Yardimci Parca Tedarikci Listesi Yonetimi */}
      {supModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 650 }}>
            <div className="modal-header">
              <h3>🏢 Yardımcı Parça Tedarikçi Listesi</h3>
              <button type="button" className="close-btn" onClick={() => setSupModalOpen(false)}>
                ×
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
              <p className="muted" style={{ fontSize: "0.85rem", marginBottom: 12 }}>
                Sistemde tanımlı yardımcı parça tedarikçilerini düzenleyebilir, yeni tedarikçi ekleyebilir veya tanımlı parçalardan otomatik tedarikçi isimlerini çekebilirsiniz.
              </p>

              {/* Yeni Tedarikci Ekle / Otomatik Çek Row */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input
                  type="text"
                  placeholder="Yeni Tedarikçi Firma Adı..."
                  value={newSupInput}
                  onChange={(e) => setNewSupInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddSupplierModal()}
                  style={{ flex: 1 }}
                />
                <button type="button" className="btn-primary" onClick={handleAddSupplierModal}>
                  ➕ Ekle
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleExtractSuppliers}
                  title="Tanımlı tüm yardımcı parçaların tedarikçi isimlerini ayıklar"
                >
                  🔄 Parçalardan Çek
                </button>
              </div>

              {/* Tedarikci Listesi Tablosu */}
              <div className="table-responsive">
                <table className="data-table" style={{ fontSize: "0.9rem" }}>
                  <thead>
                    <tr>
                      <th style={{ width: 50 }}>#</th>
                      <th>Tedarikçi Firma Ünvanı</th>
                      <th style={{ width: 120, textAlign: "center" }}>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center muted" style={{ padding: 16 }}>
                          Kayıtlı yardımcı parça tedarikçisi bulunamadı.
                        </td>
                      </tr>
                    ) : (
                      suppliers.map((sup, idx) => (
                        <tr key={sup + "-" + idx}>
                          <td>{idx + 1}</td>
                          <td>
                            {editingSupIndex === idx ? (
                              <input
                                type="text"
                                value={editingSupValue}
                                onChange={(e) => setEditingSupValue(e.target.value)}
                                style={{ width: "100%", padding: "4px 8px" }}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveEditSupplier(idx);
                                  if (e.key === "Escape") setEditingSupIndex(null);
                                }}
                              />
                            ) : (
                              <strong>{sup}</strong>
                            )}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {editingSupIndex === idx ? (
                              <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                                <button
                                  type="button"
                                  className="btn-small btn-primary"
                                  onClick={() => handleSaveEditSupplier(idx)}
                                >
                                  💾
                                </button>
                                <button
                                  type="button"
                                  className="btn-small btn-secondary"
                                  onClick={() => setEditingSupIndex(null)}
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                                <button
                                  type="button"
                                  className="btn-small btn-secondary"
                                  onClick={() => {
                                    setEditingSupIndex(idx);
                                    setEditingSupValue(sup);
                                  }}
                                  title="Düzenle"
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  className="btn-small btn-danger"
                                  onClick={() => handleDeleteSupplierModal(sup)}
                                  title="Sil"
                                >
                                  🗑️
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer" style={{ marginTop: 16 }}>
              <button type="button" className="btn-primary" onClick={() => setSupModalOpen(false)}>
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}

      <IATFFormFooter formId="YPC_F01" defaultKodu="YPC/F01" defaultAdi="Yardımcı Parça Tanımları Formu" />
    </div>
  );
}
