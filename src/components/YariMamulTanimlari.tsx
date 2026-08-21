import { useEffect, useState, useMemo } from "react";
import type { SemiFinishedPart, Material } from "../types";
import { formatDateTR } from "../lib/dateUtils";
import {
  loadSemiFinishedParts,
  saveSemiFinishedPart,
  updateSemiFinishedPart,
  deleteSemiFinishedPart,
  updateSemiFinishedLocation,
  loadSemiFinishedDb,
  addSemiFinishedMovement,
  type SemiFinishedDb,
} from "../lib/semiFinishedStorage";
import { loadMaterials } from "../lib/materialsStorage";
import { getStoredUser } from "../lib/auth";
import { IATFFormFooter } from "./IATFFormFooter";

interface Props {
  isStockView?: boolean;
}

export default function YariMamulTanimlari({ isStockView = false }: Props) {
  const [parts, setParts] = useState<SemiFinishedPart[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [db, setDb] = useState<SemiFinishedDb>({ movements: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"liste" | "hareketler">("liste");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Tanımlama / Düzenleme Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<SemiFinishedPart | null>(null);

  // Hareket (Giriş/Çıkış - Stok Düşümü) Modal State
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementForm, setMovementForm] = useState<{
    tip: "GIRIS" | "CIKIS";
    kod: string;
    miktar: number;
    aciklama: string;
  }>({
    tip: "GIRIS",
    kod: "",
    miktar: 1,
    aciklama: "",
  });

  // Quick Location Edit State
  const [locationEditKod, setLocationEditKod] = useState<string | null>(null);
  const [locationVal, setLocationVal] = useState("");

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
      await deleteSemiFinishedPart(deleteTargetKod);
      setDeleteTargetKod(null);
      setSuccess("Yarı mamül silindi.");
      refresh();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      alert(err.message || "Silinemedi.");
    } finally {
      setDeleting(false);
    }
  }

  const [form, setForm] = useState<Partial<SemiFinishedPart>>({
    kod: "",
    ad: "",
    plastikKalipNo: "",
    bagliHammaddeKodu: "",
    depoKodu: "",
    birim: "ADET",
    stokMiktari: 0,
    minStokMiktari: 500,
    aciklama: "",
  });

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const [pList, mList, sDb] = await Promise.all([
        loadSemiFinishedParts(),
        loadMaterials(),
        loadSemiFinishedDb(),
      ]);
      setParts(pList || []);
      setMaterials(mList || []);
      setDb(sDb || { movements: [] });
    } catch {
      setError("Yarı mamül verileri yüklenirken hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  // Dashboard İstatistikleri
  const totalCount = parts.length;
  const totalStock = parts.reduce((acc, p) => acc + (Number(p.stokMiktari) || 0), 0);
  const criticalCount = parts.filter(
    (p) => p.minStokMiktari !== undefined && Number(p.stokMiktari) <= Number(p.minStokMiktari)
  ).length;
  const movementCount = db.movements.length;

  function handleOpenCreate() {
    setEditingPart(null);
    setForm({
      kod: `YM-PL-${(parts.length + 1).toString().padStart(3, "0")}`,
      ad: "",
      plastikKalipNo: "",
      bagliHammaddeKodu: materials[0]?.kod || "",
      depoKodu: "YM-01 / R-01",
      birim: "ADET",
      stokMiktari: 0,
      minStokMiktari: 500,
      aciklama: "",
    });
    setError("");
    setModalOpen(true);
  }

  function handleOpenEdit(p: SemiFinishedPart) {
    setEditingPart(p);
    setForm({ ...p });
    setError("");
    setModalOpen(true);
  }

  function handleOpenMovement(kod: string, defaultTip: "GIRIS" | "CIKIS") {
    setMovementForm({
      tip: defaultTip,
      kod,
      miktar: 1,
      aciklama: defaultTip === "GIRIS" ? "Enjeksiyon Üretim Girişi" : "Montaj Hattına Düşüm / Çıkış",
    });
    setError("");
    setMovementModalOpen(true);
  }

  async function handleSaveMovement(e: React.FormEvent) {
    e.preventDefault();
    if (!movementForm.kod || movementForm.miktar <= 0) {
      setError("Geçerli bir parça ve miktar giriniz.");
      return;
    }
    setError("");
    try {
      await addSemiFinishedMovement(
        movementForm.tip,
        movementForm.kod,
        movementForm.miktar,
        movementForm.aciklama
      );
      setSuccess(`Stok ${movementForm.tip === "GIRIS" ? "girişi" : "çıkışı / düşümü"} yapıldı.`);
      setMovementModalOpen(false);
      refresh();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "İşlem sırasında hata oluştu.");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.kod || !form.ad) {
      setError("Parça kodu ve parça adı zorunludur.");
      return;
    }
    setError("");
    try {
      if (editingPart) {
        await updateSemiFinishedPart(editingPart.kod, form);
        setSuccess("Yarı mamül başarıyla güncellendi.");
      } else {
        await saveSemiFinishedPart(form as SemiFinishedPart);
        setSuccess("Yeni yarı mamül başarıyla eklendi.");
      }
      setModalOpen(false);
      refresh();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Kaydederken bir hata oluştu.");
    }
  }

  async function handleSaveQuickLocation(kod: string) {
    try {
      await updateSemiFinishedLocation(kod, locationVal);
      setLocationEditKod(null);
      refresh();
    } catch (e: any) {
      alert(e.message || "Depo konumu güncellenemedi.");
    }
  }

  const filtered = useMemo(() => {
    return parts.filter(
      (p) =>
        p.kod.toLowerCase().includes(search.toLowerCase()) ||
        p.ad.toLowerCase().includes(search.toLowerCase()) ||
        (p.plastikKalipNo && p.plastikKalipNo.toLowerCase().includes(search.toLowerCase())) ||
        (p.depoKodu && p.depoKodu.toLowerCase().includes(search.toLowerCase()))
    );
  }, [parts, search]);

  return (
    <div className="panel">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2>🧩 Yarı Mamül & Enjeksiyon Kalıp Stoğu</h2>
          <p className="muted" style={{ margin: "2px 0 0 0" }}>
            Plastik enjeksiyon yarı mamülleri, kalıp kodları, montaj öncesi stok lokasyonları ve üretim düşümleri.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-success" onClick={() => handleOpenMovement(parts[0]?.kod || "", "GIRIS")}>
            📥 + Kontrol Bölgesi Girişi
          </button>
          <button className="btn-warning" onClick={() => handleOpenMovement(parts[0]?.kod || "", "CIKIS")}>
            📤 - Kontrol Bölgesinden Çıkış
          </button>
          {!isStockView && (
            <button className="btn-primary" onClick={handleOpenCreate}>
              + Yeni Yarı Mamül Tanımla
            </button>
          )}
        </div>
      </div>

      {success && <div className="badge badge-success" style={{ marginBottom: 12, display: "block", padding: 8 }}>{success}</div>}

      {/* Alt Sekmeler (Liste vs Hareketler) */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          className={`btn-secondary ${activeTab === "liste" ? "btn-primary" : ""}`}
          onClick={() => setActiveTab("liste")}
        >
          📋 Yarı Mamül Listesi
        </button>
        <button
          className={`btn-secondary ${activeTab === "hareketler" ? "btn-primary" : ""}`}
          onClick={() => setActiveTab("hareketler")}
        >
          📜 Stok Hareket Geçmişi ({db.movements.length})
        </button>
      </div>

      {activeTab === "liste" ? (
        <>
          <div style={{ marginBottom: 16, display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              style={{ flex: 1, minWidth: 260 }}
              placeholder="🔍 Parça kodu, adı, kalıp no veya depo rafına göre ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
                <option value="show">👁️ Yarı Mamül Listesini Göster</option>
                <option value="hide">🙈 Yarı Mamül Listesini Gizle</option>
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

          {!showList ? (
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
              🙈 Yarı Mamül Tanım ve Stok Durumu Listesi gizlendi. Listeyi görüntülemek için yukarıdaki <strong>"Yarı Mamül Listesini Göster"</strong> seçeneğini seçebilir veya butona tıklayabilirsiniz.
            </div>
          ) : loading ? (
            <p className="muted">Yükleniyor...</p>
          ) : filtered.length === 0 ? (
            <p className="muted" style={{ textAlign: "center", padding: 24 }}>
              {search ? "Arama kriterine uygun yarı mamül bulunamadı." : "Henüz yarı mamül tanımlanmamış."}
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.04)", textAlign: "left" }}>
                    <th style={{ padding: 10 }}>Parça Kodu</th>
                    <th style={{ padding: 10 }}>Parça Tanımı / Adı</th>
                    <th style={{ padding: 10 }}>Kalıp No</th>
                    <th style={{ padding: 10 }}>Hammaddesi</th>
                    <th style={{ padding: 10 }}>📍 Depo / Raf Kodu</th>
                    <th style={{ padding: 10 }}>Mevcut Stok</th>
                    <th style={{ padding: 10 }}>Min. Stok</th>
                    <th style={{ padding: 10, textAlign: "right" }}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const isCritical = Number(p.stokMiktari) <= Number(p.minStokMiktari || 0);
                    return (
                      <tr key={p.kod} style={{ borderBottom: "1px solid var(--border-color, #e2e8f0)" }}>
                        <td style={{ padding: 10, fontWeight: "bold", fontFamily: "monospace" }}>{p.kod}</td>
                        <td style={{ padding: 10 }}>{p.ad}</td>
                        <td style={{ padding: 10 }}>
                          {p.plastikKalipNo ? (
                            <span className="badge-info" style={{ fontFamily: "monospace" }}>
                              🧰 {p.plastikKalipNo}
                            </span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td style={{ padding: 10, fontSize: "0.85rem" }}>
                          {p.bagliHammaddeKodu || <span className="muted">—</span>}
                        </td>

                        {/* Düzenlenebilir Depo / Raf Kodu */}
                        <td style={{ padding: 10 }}>
                          {locationEditKod === p.kod ? (
                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                              <input
                                type="text"
                                style={{ width: 110, padding: "2px 6px", fontSize: "0.85rem" }}
                                value={locationVal}
                                onChange={(e) => setLocationVal(e.target.value)}
                                placeholder="ör: YM-01/R2"
                              />
                              <button
                                type="button"
                                className="btn-small btn-success"
                                style={{ padding: "2px 6px", fontSize: "0.75rem" }}
                                onClick={() => handleSaveQuickLocation(p.kod)}
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                className="btn-small btn-secondary"
                                style={{ padding: "2px 6px", fontSize: "0.75rem" }}
                                onClick={() => setLocationEditKod(null)}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontFamily: "monospace", fontSize: "0.88rem" }}>
                                {p.depoKodu || <span className="muted">Tanımlanmadı</span>}
                              </span>
                              <button
                                type="button"
                                className="btn-small btn-secondary"
                                style={{ padding: "1px 5px", fontSize: "0.75rem" }}
                                onClick={() => {
                                  setLocationEditKod(p.kod);
                                  setLocationVal(p.depoKodu || "");
                                }}
                                title="Depo / Raf Kodunu Düzenle"
                              >
                                ✏️
                              </button>
                            </div>
                          )}
                        </td>

                        <td style={{ padding: 10, fontWeight: "bold" }}>
                          <span style={{ color: isCritical ? "var(--ng, #ef4444)" : "var(--ok, #10b981)" }}>
                            {p.stokMiktari} {p.birim || "ADET"}
                          </span>
                        </td>
                        <td style={{ padding: 10 }} className="muted">
                          {p.minStokMiktari || 0} {p.birim || "ADET"}
                        </td>

                        <td style={{ padding: 10, textAlign: "right" }}>
                          <button
                            className="btn-small btn-success"
                            style={{ marginRight: 4 }}
                            onClick={() => handleOpenMovement(p.kod, "GIRIS")}
                            title="Kontrol Bölgesi Girişi"
                          >
                            + Giriş
                          </button>
                          <button
                            className="btn-small btn-warning"
                            style={{ marginRight: 6 }}
                            onClick={() => handleOpenMovement(p.kod, "CIKIS")}
                            title="Kontrol Bölgesinden Çıkış"
                          >
                            - Çıkış
                          </button>
                          {!isStockView && (
                            <>
                              <button
                                className="btn-secondary btn-small"
                                style={{ marginRight: 4 }}
                                onClick={() => handleOpenEdit(p)}
                              >
                                Düzenle
                              </button>
                              {canDelete && (
                                <button
                                  className="btn-danger btn-small"
                                  onClick={() => setDeleteTargetKod(p.kod)}
                                  title="Düşüm yapmadan direkt sil (Yönetici / Giriş Kalite)"
                                >
                                  🗑️ Sil
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        /* Hareketler Sekmesi */
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.04)", textAlign: "left" }}>
                <th style={{ padding: 10 }}>İşlem Tipi</th>
                <th style={{ padding: 10 }}>Parça Kodu</th>
                <th style={{ padding: 10 }}>Miktar</th>
                <th style={{ padding: 10 }}>Tarih</th>
                <th style={{ padding: 10 }}>Açıklama / Referans</th>
              </tr>
            </thead>
            <tbody>
              {db.movements.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 20, textAlign: "center" }} className="muted">
                    Henüz kayıtlı yarı mamül hareketi bulunmuyor.
                  </td>
                </tr>
              ) : (
                db.movements.map((m) => (
                  <tr key={m.id} style={{ borderBottom: "1px solid var(--border-color, #e2e8f0)" }}>
                    <td style={{ padding: 10 }}>
                      {m.tip === "GIRIS" ? (
                        <span className="badge badge-success">⬇ GİRİŞ (Üretim)</span>
                      ) : (
                        <span className="badge badge-warning">⬆ ÇIKIŞ (Montaj Düşümü)</span>
                      )}
                    </td>
                    <td style={{ padding: 10, fontWeight: "bold", fontFamily: "monospace" }}>{m.kod}</td>
                    <td style={{ padding: 10, fontWeight: "bold" }}>
                      {m.tip === "GIRIS" ? `+${m.miktar}` : `-${m.miktar}`}
                    </td>
                    <td style={{ padding: 10, fontSize: "0.85rem" }}>
                      {formatDateTR(m.tarih)}
                    </td>
                    <td style={{ padding: 10 }}>{m.aciklama || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* KPI Dashboard Kartları (Sayfa Altı & Daraltılabilir) */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border-color, #e2e8f0)" }}>
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
          <h3 style={{ fontSize: "1.05rem", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            📊 Yarı Mamül & Enjeksiyon Stok Özet Gösterge Paneli
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
              <span className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase" }}>Yarı Mamül Çeşit</span>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{totalCount} Kalem</div>
            </div>
            <div style={{ background: "rgba(16, 185, 129, 0.08)", padding: 12, borderRadius: 8, borderLeft: "4px solid #10b981" }}>
              <span className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase" }}>Toplam Stok</span>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{totalStock.toLocaleString()} Adet</div>
            </div>
            <div
              style={{
                background: criticalCount > 0 ? "rgba(239, 68, 68, 0.08)" : "rgba(107, 114, 128, 0.08)",
                padding: 12,
                borderRadius: 8,
                borderLeft: criticalCount > 0 ? "4px solid #ef4444" : "4px solid #6b7280",
              }}
            >
              <span className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase" }}>Kritik Seviyede</span>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: criticalCount > 0 ? "#ef4444" : "inherit" }}>
                {criticalCount} Kalem
              </div>
            </div>
            <div style={{ background: "rgba(139, 92, 246, 0.08)", padding: 12, borderRadius: 8, borderLeft: "4px solid #8b5cf6" }}>
              <span className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase" }}>Toplam Hareket</span>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{movementCount} Kayıt</div>
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
              ⚠️ Yarı Mamülü Sil
            </h3>
            <p style={{ margin: "16px 0 24px 0", lineHeight: 1.6, fontSize: "0.95rem", color: "#cbd5e1" }}>
              <strong style={{ fontFamily: "monospace", color: "#38bdf8", background: "rgba(56, 189, 248, 0.15)", padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(56, 189, 248, 0.3)" }}>
                {deleteTargetKod}
              </strong>{" "}
              numaralı yarı mamül tanımını düşüm yapmadan sistemden <strong style={{ color: "#f8fafc" }}>direkt silmek istediğinize emin misiniz?</strong>
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

      {/* Stok Düşüm / Giriş Modalı */}
      {movementModalOpen && (
        <div className="modal-overlay" onClick={() => setMovementModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{movementForm.tip === "GIRIS" ? "📥 Yarı Mamül Kontrol Bölgesi Girişi" : "📤 Yarı Mamül Kontrol Bölgesinden Çıkış"}</h3>
              <button type="button" className="close-btn" onClick={() => setMovementModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveMovement}>
              <div className="modal-body">
                {error && <p className="error" style={{ fontSize: "0.85rem" }}>{error}</p>}
                
                <label>
                  <span style={{ fontWeight: 600 }}>Yarı Mamül Parça *</span>
                  <select
                    value={movementForm.kod}
                    onChange={(e) => setMovementForm({ ...movementForm, kod: e.target.value })}
                    style={{ width: "100%", marginTop: 4 }}
                  >
                    {parts.map((p) => (
                      <option key={p.kod} value={p.kod}>
                        {p.kod} - {p.ad} (Mevcut: {p.stokMiktari} {p.birim || "ADET"})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span style={{ fontWeight: 600 }}>Miktar ({parts.find(p => p.kod === movementForm.kod)?.birim || "Adet"}) *</span>
                  <input
                    type="number"
                    min="1"
                    value={movementForm.miktar}
                    onChange={(e) => setMovementForm({ ...movementForm, miktar: Number(e.target.value) })}
                    style={{ width: "100%", marginTop: 4 }}
                  />
                </label>

                <label>
                  <span style={{ fontWeight: 600 }}>Açıklama / İş Emri / Parti Ref.</span>
                  <input
                    value={movementForm.aciklama}
                    onChange={(e) => setMovementForm({ ...movementForm, aciklama: e.target.value })}
                    placeholder="ör: İş Emri #402, Montaj Hattı Düşümü"
                    style={{ width: "100%", marginTop: 4 }}
                  />
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setMovementModalOpen(false)}>
                  İptal
                </button>
                <button type="submit" className={movementForm.tip === "GIRIS" ? "btn-success" : "btn-warning"}>
                  {movementForm.tip === "GIRIS" ? "📥 Kontrol Bölgesi Girişini Kaydet" : "📤 Kontrol Bölgesinden Çıkış Yap"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tanım Ekleme / Düzenleme Modalı */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingPart ? "✏️ Yarı Mamül Düzenle" : "➕ Yeni Yarı Mamül Tanımla"}</h3>
              <button type="button" className="close-btn" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {error && <p className="error" style={{ fontSize: "0.85rem" }}>{error}</p>}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label>
                    <span style={{ fontWeight: 600 }}>Yarı Mamül Kodu *</span>
                    <input
                      value={form.kod || ""}
                      onChange={(e) => setForm({ ...form, kod: e.target.value })}
                      placeholder="ör: YM-PL-201"
                      disabled={!!editingPart}
                      style={{ width: "100%", marginTop: 4 }}
                    />
                  </label>
                  <label>
                    <span style={{ fontWeight: 600 }}>Plastik Enjeksiyon Kalıp No</span>
                    <input
                      value={form.plastikKalipNo || ""}
                      onChange={(e) => setForm({ ...form, plastikKalipNo: e.target.value })}
                      placeholder="ör: KLP-12"
                      style={{ width: "100%", marginTop: 4 }}
                    />
                  </label>
                </div>

                <label>
                  <span style={{ fontWeight: 600 }}>Yarı Mamül Adı / Tanımı *</span>
                  <input
                    value={form.ad || ""}
                    onChange={(e) => setForm({ ...form, ad: e.target.value })}
                    placeholder="ör: Siyah Plastik Enjeksiyon Gövde Parçası"
                    style={{ width: "100%", marginTop: 4 }}
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label>
                    <span style={{ fontWeight: 600 }}>Bağlı Plastik Granül Kodu</span>
                    <select
                      value={form.bagliHammaddeKodu || ""}
                      onChange={(e) => setForm({ ...form, bagliHammaddeKodu: e.target.value })}
                      style={{ width: "100%", marginTop: 4 }}
                    >
                      <option value="">-- Seçiniz --</option>
                      {materials.map((m) => (
                        <option key={m.kod} value={m.kod}>
                          {m.kod} ({m.cins || m.firma})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span style={{ fontWeight: 600 }}>📍 Depo Kodu / Rafı (Düzenlenebilir)</span>
                    <input
                      value={form.depoKodu || ""}
                      onChange={(e) => setForm({ ...form, depoKodu: e.target.value })}
                      placeholder="ör: YM-01 / R-02"
                      style={{ width: "100%", marginTop: 4 }}
                    />
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <label>
                    <span style={{ fontWeight: 600 }}>Birim</span>
                    <select
                      value={form.birim || "ADET"}
                      onChange={(e) => setForm({ ...form, birim: e.target.value })}
                      style={{ width: "100%", marginTop: 4 }}
                    >
                      <option value="ADET">ADET</option>
                      <option value="TAKIM">TAKIM</option>
                      <option value="KG">KG</option>
                      <option value="KUTU">KUTU</option>
                    </select>
                  </label>

                  <label>
                    <span style={{ fontWeight: 600 }}>Başlangıç Stok</span>
                    <input
                      type="number"
                      value={form.stokMiktari ?? 0}
                      onChange={(e) => setForm({ ...form, stokMiktari: Number(e.target.value) })}
                      style={{ width: "100%", marginTop: 4 }}
                    />
                  </label>

                  <label>
                    <span style={{ fontWeight: 600 }}>Min. Stok Uyarısı</span>
                    <input
                      type="number"
                      value={form.minStokMiktari ?? 500}
                      onChange={(e) => setForm({ ...form, minStokMiktari: Number(e.target.value) })}
                      style={{ width: "100%", marginTop: 4 }}
                    />
                  </label>
                </div>

                <label>
                  <span style={{ fontWeight: 600 }}>Açıklama / Notlar</span>
                  <textarea
                    rows={2}
                    value={form.aciklama || ""}
                    onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
                    placeholder="Enjeksiyon çevrim süresi, uyarılar vb."
                    style={{ width: "100%", marginTop: 4, fontFamily: "inherit" }}
                  />
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                  İptal
                </button>
                <button type="submit" className="btn-primary">
                  {editingPart ? "Güncelle" : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <IATFFormFooter formId="MAL_F01" defaultKodu="MAL/F01" defaultAdi="Yarı Mamül Tanımları Formu" />
    </div>
  );
}
