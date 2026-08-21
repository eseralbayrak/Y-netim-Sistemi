import { useEffect, useMemo, useState } from "react";
import type { AuxiliaryPart, Database, StockLot } from "../types";
import {
  loadAuxiliaryParts,
  loadAuxiliaryDb,
  addAuxiliaryMovement,
  addAuxiliaryReceipt,
  updateAuxiliaryLotLocation,
  generateAuxiliaryLotNo,
} from "../lib/auxiliaryStorage";
import { IATFFormFooter } from "./IATFFormFooter";
import { formatDateTR, todayIso, toIsoDate } from "../lib/dateUtils";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function YardimciParcaStok() {
  const [parts, setParts] = useState<AuxiliaryPart[]>([]);
  const [db, setDb] = useState<Database>({ receipts: [], movements: [], lots: {} });
  const [search, setSearch] = useState("");
  const [kritikFilter, setKritikFilter] = useState<"ALL" | "KRITIK">("ALL");
  const [subTab, setSubTab] = useState<"parcalar" | "lotlar" | "hareketler">("parcalar");
  const [showStockList, setShowStockList] = useState(true);

  // Modal State
  const [girisModalOpen, setGirisModalOpen] = useState(false);
  const [cikisModalOpen, setCikisModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Giriş Formu State
  const [girisForm, setGirisForm] = useState({
    malzemeKodu: "",
    firma: "",
    irsaliyeNo: "",
    lotNo: "",
    gelenMiktar: "",
    girisTarihi: todayIso(),
    depoLokasyonu: "",
  });

  // Çıkış Formu State
  const [cikisForm, setCikisForm] = useState({
    malzemeKodu: "",
    lotNo: "",
    miktar: "",
    aciklama: "",
  });

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    loadAuxiliaryParts().then(setParts);
    loadAuxiliaryDb().then(setDb);
  }

  // Özet İstatistikler
  const totalPartsCount = parts.length;
  const totalStockQuantity = parts.reduce((sum, p) => sum + (p.stokMiktari || 0), 0);
  const lowStockParts = parts.filter(
    (p) => p.minMiktar !== null && p.minMiktar !== undefined && (p.stokMiktari || 0) <= Number(p.minMiktar)
  );
  const recentMovementsCount = db.movements.length;

  // Filtrelenmiş parçalar
  const filteredParts = useMemo(() => {
    return parts.filter((p) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.kod.toLowerCase().includes(q) ||
        (p.cins || "").toLowerCase().includes(q) ||
        (p.firma || "").toLowerCase().includes(q);

      const isLow = p.minMiktar !== null && p.minMiktar !== undefined && (p.stokMiktari || 0) <= Number(p.minMiktar);
      const matchKritik = kritikFilter === "ALL" || (kritikFilter === "KRITIK" && isLow);

      return matchSearch && matchKritik;
    });
  }, [parts, search, kritikFilter]);

  // Filtrelenmiş Lotlar
  const lotList = useMemo(() => {
    const list = (Object.values(db.lots || {}) as StockLot[]).filter((l) => l.kalanMiktar > 0);
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (l) =>
        l.lotNo.toLowerCase().includes(q) ||
        l.malzemeKodu.toLowerCase().includes(q) ||
        (l.firma || "").toLowerCase().includes(q)
    );
  }, [db.lots, search]);

  // Filtrelenmiş Hareketler
  const movementList = useMemo(() => {
    const list = [...(db.movements || [])].reverse();
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (m) =>
        m.malzemeKodu.toLowerCase().includes(q) ||
        m.lotNo.toLowerCase().includes(q) ||
        (m.aciklama || "").toLowerCase().includes(q)
    );
  }, [db.movements, search]);

  // Parça seçildiğinde firma bilgisini otomatik doldur
  function handleGirisPartSelect(kod: string) {
    const found = parts.find((p) => p.kod === kod);
    const existingLots = Object.keys(db.lots || {});
    setGirisForm((prev) => ({
      ...prev,
      malzemeKodu: kod,
      firma: found ? found.firma : prev.firma,
      lotNo: prev.lotNo || generateAuxiliaryLotNo(existingLots),
    }));
  }

  // Hızlı Giriş Kaydet
  async function handleGirisSave() {
    setError("");
    setMessage("");
    if (!girisForm.malzemeKodu) {
      setError("Lütfen parça seçin.");
      return;
    }
    if (!girisForm.lotNo.trim()) {
      setError("Lot No zorunludur.");
      return;
    }
    const miktar = parseFloat(girisForm.gelenMiktar.replace(",", "."));
    if (isNaN(miktar) || miktar <= 0) {
      setError("Geçerli bir miktar girin.");
      return;
    }

    try {
      await addAuxiliaryReceipt({
        malzemeKodu: girisForm.malzemeKodu,
        firma: girisForm.firma,
        irsaliyeNo: girisForm.irsaliyeNo || "İRS-" + Date.now().toString().slice(-6),
        lotNo: girisForm.lotNo.trim(),
        gelenMiktar: miktar,
        girisTarihi: girisForm.girisTarihi,
        durum: "DEPODA",
      });

      if (girisForm.depoLokasyonu) {
        await updateAuxiliaryLotLocation(girisForm.lotNo.trim(), girisForm.depoLokasyonu);
      }

      setMessage("✅ Stok girişi başarıyla kaydedildi.");
      refresh();
      setGirisModalOpen(false);
      setGirisForm({
        malzemeKodu: "",
        firma: "",
        irsaliyeNo: "",
        lotNo: "",
        gelenMiktar: "",
        girisTarihi: todayIso(),
        depoLokasyonu: "",
      });
    } catch (err: any) {
      setError(err.message || "Giriş kaydedilemedi.");
    }
  }

  // Hızlı Çıkış Kaydet
  async function handleCikisSave() {
    setError("");
    setMessage("");
    if (!cikisForm.malzemeKodu) {
      setError("Lütfen parça seçin.");
      return;
    }
    if (!cikisForm.lotNo) {
      setError("Lütfen Lot seçin.");
      return;
    }
    const miktar = parseFloat(cikisForm.miktar.replace(",", "."));
    if (isNaN(miktar) || miktar <= 0) {
      setError("Geçerli bir miktar girin.");
      return;
    }

    try {
      await addAuxiliaryMovement({
        tip: "CIKIS",
        malzemeKodu: cikisForm.malzemeKodu,
        lotNo: cikisForm.lotNo,
        miktar: miktar,
        aciklama: cikisForm.aciklama || "Yardımcı Parça Kullanım Çıkışı",
      });

      setMessage("✅ Stok çıkışı başarıyla tamamlandı.");
      refresh();
      setCikisModalOpen(false);
      setCikisForm({
        malzemeKodu: "",
        lotNo: "",
        miktar: "",
        aciklama: "",
      });
    } catch (err: any) {
      setError(err.message || "Çıkış yapılamadı.");
    }
  }

  function exportExcel() {
    const data = filteredParts.map((p) => ({
      "Parça Kodu": p.kod,
      "Parça Cinsi / Tanımı": p.cins || "-",
      "Tedarikçi": p.firma,
      "Mevcut Stok": p.stokMiktari ?? 0,
      "Birim": p.birim || "ADET",
      "Kritik Stok Seviyesi": p.minMiktar ?? "-",
      "Kritik Durum":
        p.minMiktar !== null && p.minMiktar !== undefined && (p.stokMiktari || 0) <= Number(p.minMiktar)
          ? "KRİTİK STOK"
          : "NORMAL",
      "Stoklama Koşulları": p.stoklamaKosullari || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "YP Stok Takip");
    XLSX.writeFile(wb, "Yardimci_Parca_Stok_Raporu.xlsx");
  }

  async function exportPdf() {
    const el = document.getElementById("aux-stock-export-area");
    if (!el) return;
    const canvas = await html2canvas(el, { backgroundColor: "#ffffff", scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("l", "mm", "a4");
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, "PNG", 0, 10, pdfWidth, pdfHeight);
    pdf.save("Yardimci_Parca_Stok_Raporu.pdf");
  }

  return (
    <div className="card">
      <div className="card-header flex-between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2>📦 Yardımcı Parça Stok Takip</h2>
          <p className="muted">
            Yardımcı parçaların bağımsız stok bakiyeleri, lot takibi, depo giriş/çıkış hareketleri ve kritik stok uyarıları.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn-secondary" onClick={exportExcel}>
            📊 Excel Aktar
          </button>
          <button type="button" className="btn-secondary" onClick={exportPdf}>
            📄 PDF İndir
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setError("");
              setGirisModalOpen(true);
            }}
          >
            📥 Hızlı Stok Girişi
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              setError("");
              setCikisModalOpen(true);
            }}
          >
            📤 Hızlı Stok Çıkışı
          </button>
        </div>
      </div>

      {message && <div className="alert alert-success" style={{ marginBottom: 12 }}>{message}</div>}

      {/* Arama & Filtreler (Sayfa Üstü) */}
      <div className="filter-row flex-between" style={{ flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="🔍 Parça Kodu, Tanımı, Tedarikçi veya Lot Ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
          style={{ width: "100%", maxWidth: 350 }}
        />

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: "0.85rem", margin: 0 }}>Stok Filtresi:</label>
          <select
            value={kritikFilter}
            onChange={(e) => setKritikFilter(e.target.value as any)}
            style={{ padding: "6px 12px", borderRadius: 6 }}
          >
            <option value="ALL">Tüm Parçalar</option>
            <option value="KRITIK">⚠️ Sadece Kritik Stoktakiler</option>
          </select>
        </div>

        {/* Görünüm Sekmeleri */}
        <div className="tab-buttons" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <button
            type="button"
            className={`tab-btn ${subTab === "parcalar" ? "active" : ""}`}
            onClick={() => setSubTab("parcalar")}
          >
            📋 Parça Stok Durumu ({filteredParts.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${subTab === "lotlar" ? "active" : ""}`}
            onClick={() => setSubTab("lotlar")}
          >
            🏷️ Lot / Parti Listesi ({lotList.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${subTab === "hareketler" ? "active" : ""}`}
            onClick={() => setSubTab("hareketler")}
          >
            📜 Stok Hareketleri ({movementList.length})
          </button>
        </div>
      </div>

      {/* Ana İçerik Tablosu */}
      <div id="aux-stock-export-area">
        {subTab === "parcalar" && (
          <div>
            {/* Göster / Gizle Dropdown Menü ve Başlık Kontrolü */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid var(--panel-border)",
                padding: "10px 14px",
                borderRadius: 8,
                marginBottom: 12,
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--accent)" }}>
                  📋 Yardımcı Parça Stok Durumu Listesi ({filteredParts.length} Parça)
                </span>
                <select
                  value={showStockList ? "show" : "hide"}
                  onChange={(e) => setShowStockList(e.target.value === "show")}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 6,
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    background: "var(--panel-bg)",
                    color: "var(--text)",
                    border: "1px solid var(--panel-border)",
                    cursor: "pointer",
                  }}
                >
                  <option value="show">👁️ Stok Listesini Göster</option>
                  <option value="hide">🙈 Stok Listesini Gizle</option>
                </select>
              </div>

              <button
                type="button"
                className="btn-secondary btn-small"
                onClick={() => setShowStockList(!showStockList)}
                style={{ fontSize: "0.85rem", fontWeight: 600 }}
              >
                {showStockList ? "▲ Listeyi Gizle" : "▼ Listeyi Göster"}
              </button>
            </div>

            {showStockList ? (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Parça Kodu</th>
                      <th>Parça Cinsi / Tanımı</th>
                      <th>Tedarikçi Firma</th>
                      <th>Mevcut Stok</th>
                      <th>Birim</th>
                      <th>Kritik Min. Stok</th>
                      <th>Stok Durumu</th>
                      <th>Stoklama Koşulları</th>
                      <th style={{ textAlign: "center", width: 150 }}>⚡ Hızlı Stok İşlemi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParts.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center muted" style={{ padding: 24 }}>
                          Arama kriterlerine uygun stok kaydı bulunamadı.
                        </td>
                      </tr>
                    ) : (
                      filteredParts.map((p) => {
                        const isLow =
                          p.minMiktar !== null &&
                          p.minMiktar !== undefined &&
                          (p.stokMiktari || 0) <= Number(p.minMiktar);

                        return (
                          <tr key={p.kod} className={isLow ? "table-row-danger" : ""}>
                            <td>
                              <strong className="badge-info" style={{ fontFamily: "monospace", fontSize: "0.9rem" }}>{p.kod}</strong>
                            </td>
                            <td>{p.cins || "-"}</td>
                            <td>{p.firma}</td>
                            <td>
                              <strong style={{ fontSize: "1.05rem", color: isLow ? "#ef4444" : "inherit" }}>
                                {(p.stokMiktari || 0).toLocaleString("tr-TR")}
                              </strong>
                            </td>
                            <td>{p.birim || "ADET"}</td>
                            <td>
                              {p.minMiktar !== null && p.minMiktar !== undefined
                                ? `${p.minMiktar} ${p.birim || "ADET"}`
                                : "-"}
                            </td>
                            <td>
                              {isLow ? (
                                <span
                                  className="tag tag-ng"
                                  style={{
                                    backgroundColor: "#fef2f2",
                                    color: "#dc2626",
                                    border: "1px solid #fca5a5",
                                  }}
                                >
                                  ⚠️ KRİTİK STOK
                                </span>
                              ) : (
                                <span className="tag tag-ok">✅ YETERLİ</span>
                              )}
                            </td>
                            <td className="muted" style={{ fontSize: "0.85rem" }}>
                              {p.stoklamaKosullari || "-"}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                                <button
                                  type="button"
                                  className="btn-small btn-primary"
                                  onClick={() => {
                                    handleGirisPartSelect(p.kod);
                                    setError("");
                                    setGirisModalOpen(true);
                                  }}
                                  title="Bu parça için pop-up stok girişi aç"
                                >
                                  📥 Giriş
                                </button>
                                <button
                                  type="button"
                                  className="btn-small btn-danger"
                                  onClick={() => {
                                    const availableLot = (Object.values(db.lots || {}) as StockLot[]).find(
                                      (l) => l.malzemeKodu === p.kod && l.kalanMiktar > 0
                                    );
                                    setCikisForm({
                                      malzemeKodu: p.kod,
                                      lotNo: availableLot ? availableLot.lotNo : "",
                                      miktar: "",
                                      aciklama: "",
                                    });
                                    setError("");
                                    setCikisModalOpen(true);
                                  }}
                                  title="Bu parça için pop-up stok çıkışı aç"
                                >
                                  📤 Çıkış
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div
                style={{
                  padding: 20,
                  textAlign: "center",
                  background: "rgba(0,0,0,0.15)",
                  borderRadius: 8,
                  border: "1px dashed var(--panel-border)",
                  color: "var(--muted)",
                }}
              >
                🙈 Stok Durumu Listesi gizlendi. Listeyi görüntülemek için sağ üstteki <strong>"Listeyi Göster"</strong> butonuna tıklayabilirsiniz.
              </div>
            )}
          </div>
        )}

        {subTab === "lotlar" && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lot / Parti No</th>
                  <th>Parça Kodu</th>
                  <th>Tedarikçi</th>
                  <th>Kalan Stok</th>
                  <th>İlk Giriş Miktarı</th>
                  <th>Giriş Tarihi</th>
                  <th>Depo Lokasyonu</th>
                </tr>
              </thead>
              <tbody>
                {lotList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center muted" style={{ padding: 24 }}>
                      Aktif stokta lot bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  lotList.map((l) => (
                    <tr key={l.lotNo}>
                      <td><strong>{l.lotNo}</strong></td>
                      <td><strong className="badge-info" style={{ fontFamily: "monospace", fontSize: "0.88rem" }}>{l.malzemeKodu}</strong></td>
                      <td>{l.firma}</td>
                      <td><strong>{l.kalanMiktar}</strong></td>
                      <td>{l.ilkGirisMiktari}</td>
                      <td>{formatDateTR(l.girisTarihi)}</td>
                      <td>{l.depoLokasyonu || "Rarf / Depo Belirtilmedi"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {subTab === "hareketler" && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tarih & Saat</th>
                  <th>İşlem Tipi</th>
                  <th>Parça Kodu</th>
                  <th>Lot No</th>
                  <th>Miktar</th>
                  <th>İşlemi Yapan</th>
                  <th>Açıklama / Belge</th>
                </tr>
              </thead>
              <tbody>
                {movementList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center muted" style={{ padding: 24 }}>
                      Henüz kaydedilmiş stok hareketi yok.
                    </td>
                  </tr>
                ) : (
                  movementList.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontSize: "0.85rem" }}>
                        {formatDateTR(m.tarih)}
                      </td>
                      <td>
                        {m.tip === "GIRIS" ? (
                          <span className="tag tag-ok">📥 GİRİŞ</span>
                        ) : (
                          <span className="tag tag-ng">📤 ÇIKIŞ</span>
                        )}
                      </td>
                      <td><strong>{m.malzemeKodu}</strong></td>
                      <td>{m.lotNo}</td>
                      <td>
                        <strong style={{ color: m.tip === "GIRIS" ? "#10b981" : "#ef4444" }}>
                          {m.tip === "GIRIS" ? `+${m.miktar}` : `-${m.miktar}`}
                        </strong>
                      </td>
                      <td>{m.kullanici || "Sistem"}</td>
                      <td className="muted" style={{ fontSize: "0.85rem" }}>
                        {m.aciklama || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Özet Gösterge Paneli Kartları (Sayfa Altı) */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border-color, #e2e8f0)" }}>
        <h3 style={{ fontSize: "1.05rem", marginBottom: 12 }}>📊 Yardımcı Parça Stok Özet Gösterge Paneli</h3>
        <div className="summary-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <div className="summary-card card" style={{ padding: 12 }}>
            <span className="muted" style={{ fontSize: "0.8rem" }}>Toplam Parça Çeşidi</span>
            <h3 style={{ margin: "4px 0 0 0", color: "#3b82f6" }}>{totalPartsCount} Çeşit</h3>
          </div>
          <div className="summary-card card" style={{ padding: 12 }}>
            <span className="muted" style={{ fontSize: "0.8rem" }}>Toplam Stok Miktarı</span>
            <h3 style={{ margin: "4px 0 0 0", color: "#10b981" }}>{totalStockQuantity.toLocaleString("tr-TR")} Miktar</h3>
          </div>
          <div className="summary-card card" style={{ padding: 12, borderLeft: lowStockParts.length > 0 ? "4px solid #ef4444" : "4px solid #10b981" }}>
            <span className="muted" style={{ fontSize: "0.8rem" }}>Kritik Stok Uyarısı</span>
            <h3 style={{ margin: "4px 0 0 0", color: lowStockParts.length > 0 ? "#ef4444" : "#10b981" }}>
              {lowStockParts.length} Parça
            </h3>
          </div>
          <div className="summary-card card" style={{ padding: 12 }}>
            <span className="muted" style={{ fontSize: "0.8rem" }}>Toplam Stok Hareketleri</span>
            <h3 style={{ margin: "4px 0 0 0", color: "#8b5cf6" }}>{recentMovementsCount} Kayıt</h3>
          </div>
        </div>
      </div>

      {/* Modal: Hızlı Stok Girişi */}
      {girisModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>📥 Yardımcı Parça Stok Girişi</h3>
              <button type="button" className="close-btn" onClick={() => setGirisModalOpen(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}

              <div className="form-group">
                <label>Yardımcı Parça Seçin *</label>
                <select
                  value={girisForm.malzemeKodu}
                  onChange={(e) => handleGirisPartSelect(e.target.value)}
                >
                  <option value="">-- Parça Seçin --</option>
                  {parts.map((p) => (
                    <option key={p.kod} value={p.kod}>
                      {p.kod} - {p.cins || "İsimsiz"} ({p.firma})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Tedarikçi Firma</label>
                <input
                  type="text"
                  value={girisForm.firma}
                  onChange={(e) => setGirisForm({ ...girisForm, firma: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>İrsaliye / Fiş No</label>
                <input
                  type="text"
                  placeholder="örn: İRS-2025/001"
                  value={girisForm.irsaliyeNo}
                  onChange={(e) => setGirisForm({ ...girisForm, irsaliyeNo: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Lot / Parti No *</label>
                <input
                  type="text"
                  value={girisForm.lotNo}
                  onChange={(e) => setGirisForm({ ...girisForm, lotNo: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Gelen Miktar *</label>
                <input
                  type="text"
                  placeholder="örn: 500"
                  value={girisForm.gelenMiktar}
                  onChange={(e) => setGirisForm({ ...girisForm, gelenMiktar: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Giriş Tarihi</label>
                <input
                  type="text"
                  placeholder="GG/AA/YYYY"
                  value={formatDateTR(girisForm.girisTarihi)}
                  onChange={(e) => setGirisForm({ ...girisForm, girisTarihi: toIsoDate(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label>Depo / Raf Lokasyonu</label>
                <input
                  type="text"
                  placeholder="örn: YP-Raf B3"
                  value={girisForm.depoLokasyonu}
                  onChange={(e) => setGirisForm({ ...girisForm, depoLokasyonu: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setGirisModalOpen(false)}>
                İptal
              </button>
              <button type="button" className="btn-primary" onClick={handleGirisSave}>
                📥 Girişi Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Hızlı Stok Çıkışı */}
      {cikisModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>📤 Yardımcı Parça Stok Çıkışı (Kullanım)</h3>
              <button type="button" className="close-btn" onClick={() => setCikisModalOpen(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}

              <div className="form-group">
                <label>Çıkış Yapılacak Parça *</label>
                <select
                  value={cikisForm.malzemeKodu}
                  onChange={(e) => {
                    const kod = e.target.value;
                    const availableLot = (Object.values(db.lots || {}) as StockLot[]).find((l) => l.malzemeKodu === kod && l.kalanMiktar > 0);
                    setCikisForm({
                      ...cikisForm,
                      malzemeKodu: kod,
                      lotNo: availableLot ? availableLot.lotNo : "",
                    });
                  }}
                >
                  <option value="">-- Parça Seçin --</option>
                  {parts.map((p) => (
                    <option key={p.kod} value={p.kod}>
                      {p.kod} - {p.cins || "İsimsiz"} (Mevcut: {p.stokMiktari || 0} {p.birim || "ADET"})
                    </option>
                  ))}
                </select>
              </div>

              {cikisForm.malzemeKodu && (
                <div className="form-group">
                  <label>Lot / Parti Seçin *</label>
                  <select
                    value={cikisForm.lotNo}
                    onChange={(e) => setCikisForm({ ...cikisForm, lotNo: e.target.value })}
                  >
                    <option value="">-- Lot Seçin --</option>
                    {(Object.values(db.lots || {}) as StockLot[])
                      .filter((l) => l.malzemeKodu === cikisForm.malzemeKodu && l.kalanMiktar > 0)
                      .map((l) => (
                        <option key={l.lotNo} value={l.lotNo}>
                          {l.lotNo} (Kalan: {l.kalanMiktar})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Çıkış Miktarı *</label>
                <input
                  type="text"
                  placeholder="örn: 50"
                  value={cikisForm.miktar}
                  onChange={(e) => setCikisForm({ ...cikisForm, miktar: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Kullanım Amacı / Fiş No / Açıklama</label>
                <input
                  type="text"
                  placeholder="örn: Montaj Hattı 2 Kullanımı"
                  value={cikisForm.aciklama}
                  onChange={(e) => setCikisForm({ ...cikisForm, aciklama: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setCikisModalOpen(false)}>
                İptal
              </button>
              <button type="button" className="btn-danger" onClick={handleCikisSave}>
                📤 Çıkışı Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      <IATFFormFooter formId="YPS_F01" defaultKodu="YPS/F01" defaultAdi="Yardımcı Parça Stok Takip Raporu" />
    </div>
  );
}
