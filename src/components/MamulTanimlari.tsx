import { useEffect, useState, useMemo } from "react";
import type { FinishedGood, BomItem, SemiFinishedPart, AuxiliaryPart } from "../types";
import { formatDateTR } from "../lib/dateUtils";
import {
  loadFinishedGoods,
  saveFinishedGood,
  updateFinishedGood,
  deleteFinishedGood,
  updateFinishedGoodLocation,
  loadFinishedGoodsDb,
  addFinishedGoodMovement,
  type FinishedGoodsDb,
} from "../lib/finishedGoodsStorage";
import { loadSemiFinishedParts } from "../lib/semiFinishedStorage";
import { loadAuxiliaryParts } from "../lib/auxiliaryStorage";
import { getStoredUser } from "../lib/auth";
import { IATFFormFooter } from "./IATFFormFooter";

interface Props {
  isStockView?: boolean;
}

export default function MamulTanimlari({ isStockView = false }: Props) {
  const [goods, setGoods] = useState<FinishedGood[]>([]);
  const [semiParts, setSemiParts] = useState<SemiFinishedPart[]>([]);
  const [auxParts, setAuxParts] = useState<AuxiliaryPart[]>([]);
  const [db, setDb] = useState<FinishedGoodsDb>({ movements: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"liste" | "hareketler">("liste");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingGood, setEditingGood] = useState<FinishedGood | null>(null);

  // Hareket (Giriş/Çıkış) Modal State
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
      await deleteFinishedGood(deleteTargetKod);
      setDeleteTargetKod(null);
      setSuccess("Mamül silindi.");
      refresh();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      alert(err.message || "Silinemedi.");
    } finally {
      setDeleting(false);
    }
  }

  const [form, setForm] = useState<Partial<FinishedGood>>({
    kod: "",
    ad: "",
    depoKodu: "",
    birim: "ADET",
    stokMiktari: 0,
    minStokMiktari: 100,
    aciklama: "",
    recete: [],
  });

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const [gList, fDb, semiList, auxList] = await Promise.all([
        loadFinishedGoods(),
        loadFinishedGoodsDb(),
        loadSemiFinishedParts(),
        loadAuxiliaryParts(),
      ]);
      setGoods(gList || []);
      setDb(fDb || { movements: [] });
      setSemiParts(semiList || []);
      setAuxParts(auxList || []);
    } catch {
      setError("Mamül verileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  // Dashboard KPI İstatistikleri
  const totalCount = goods.length;
  const totalStock = goods.reduce((acc, g) => acc + (Number(g.stokMiktari) || 0), 0);
  const criticalCount = goods.filter(
    (g) => g.minStokMiktari !== undefined && Number(g.stokMiktari) <= Number(g.minStokMiktari)
  ).length;
  const movementCount = db.movements.length;

  function handleOpenCreate() {
    setEditingGood(null);
    setForm({
      kod: `MAM-${(goods.length + 1).toString().padStart(3, "0")}`,
      ad: "",
      depoKodu: "MAM-01 / A-01",
      birim: "ADET",
      stokMiktari: 0,
      minStokMiktari: 100,
      aciklama: "",
      recete: [],
    });
    setError("");
    setModalOpen(true);
  }

  function handleOpenEdit(g: FinishedGood) {
    setEditingGood(g);
    setForm({
      ...g,
      recete: g.recete ? [...g.recete] : [],
    });
    setError("");
    setModalOpen(true);
  }

  function handleOpenMovement(kod: string, defaultTip: "GIRIS" | "CIKIS") {
    setMovementForm({
      tip: defaultTip,
      kod: kod || (goods[0] ? goods[0].kod : ""),
      miktar: 1,
      aciklama: defaultTip === "GIRIS" ? "Montaj Tamamlama Girişi" : "Sevkiyat Çıkışı / Düşüm",
    });
    setError("");
    setMovementModalOpen(true);
  }

  // Reçete (BOM) Yönetimi İşlevleri
  function handleAddBomItem() {
    const currentRecete = form.recete || [];
    const defaultKod = semiParts[0] ? semiParts[0].kod : auxParts[0] ? auxParts[0].kod : "";
    setForm({
      ...form,
      recete: [
        ...currentRecete,
        {
          tip: "YARI_MAMUL",
          kod: defaultKod,
          miktar: 1,
        },
      ],
    });
  }

  function handleUpdateBomItem(index: number, patch: Partial<BomItem>) {
    const currentRecete = [...(form.recete || [])];
    if (!currentRecete[index]) return;
    currentRecete[index] = { ...currentRecete[index], ...patch };

    // Tip değiştiğinde ilk uygun kodla resetle
    if (patch.tip) {
      if (patch.tip === "YARI_MAMUL") {
        currentRecete[index].kod = semiParts[0] ? semiParts[0].kod : "";
      } else {
        currentRecete[index].kod = auxParts[0] ? auxParts[0].kod : "";
      }
    }

    setForm({ ...form, recete: currentRecete });
  }

  function handleRemoveBomItem(index: number) {
    const currentRecete = (form.recete || []).filter((_, i) => i !== index);
    setForm({ ...form, recete: currentRecete });
  }

  async function handleSaveMovement(e: React.FormEvent) {
    e.preventDefault();
    if (!movementForm.kod || movementForm.miktar <= 0) {
      setError("Geçerli mamül ve miktar giriniz.");
      return;
    }
    setError("");
    try {
      const res: any = await addFinishedGoodMovement(
        movementForm.tip,
        movementForm.kod,
        movementForm.miktar,
        movementForm.aciklama
      );
      let msg = `Mamül stok ${movementForm.tip === "GIRIS" ? "girişi" : "sevkiyat düşümü"} yapıldı.`;
      if (res && res.autoDeducted && res.autoDeducted.length > 0) {
        msg += ` Otomatik Reçete Düşümleri: ${res.autoDeducted.join(", ")}`;
      }
      setSuccess(msg);
      setMovementModalOpen(false);
      refresh();
      setTimeout(() => setSuccess(""), 5000);
    } catch (err: any) {
      setError(err.message || "İşlem sırasında hata oluştu.");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.kod || !form.ad) {
      setError("Mamül kodu ve adı zorunludur.");
      return;
    }
    setError("");
    try {
      if (editingGood) {
        await updateFinishedGood(editingGood.kod, form);
        setSuccess("Mamül ve ürün reçetesi başarıyla güncellendi.");
      } else {
        await saveFinishedGood(form as FinishedGood);
        setSuccess("Yeni mamül ve ürün reçetesi eklendi.");
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
      await updateFinishedGoodLocation(kod, locationVal);
      setLocationEditKod(null);
      refresh();
    } catch (e: any) {
      alert(e.message || "Depo konumu güncellenemedi.");
    }
  }

  const filtered = useMemo(() => {
    return goods.filter(
      (g) =>
        g.kod.toLowerCase().includes(search.toLowerCase()) ||
        g.ad.toLowerCase().includes(search.toLowerCase()) ||
        (g.plastikKalipNo && g.plastikKalipNo.toLowerCase().includes(search.toLowerCase())) ||
        (g.depoKodu && g.depoKodu.toLowerCase().includes(search.toLowerCase()))
    );
  }, [goods, search]);

  return (
    <div className="panel">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2>📦 Mamül (Nihai Montajlı Ürün) Stoğu & Reçete Yönetimi</h2>
          <p className="muted" style={{ margin: "2px 0 0 0" }}>
            Montajı bitmiş ürünler, ürün reçetesi (BOM) tanımları ve sevkiyat çıkışında otomatik yarı mamül / yardımcı parça düşümü.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-success" onClick={() => handleOpenMovement(goods[0]?.kod || "", "GIRIS")}>
            📥 + Stok Girişi
          </button>
          <button className="btn-warning" onClick={() => handleOpenMovement(goods[0]?.kod || "", "CIKIS")}>
            📤 Sevkiyat Çıkışı (Otomatik Düşüm)
          </button>
          {!isStockView && (
            <button className="btn-primary" onClick={handleOpenCreate}>
              + Yeni Mamül Tanımla
            </button>
          )}
        </div>
      </div>

      {success && <div className="badge badge-success" style={{ marginBottom: 12, display: "block", padding: 10, fontSize: "0.9rem" }}>{success}</div>}

      {/* Üst Kısım: Arama & Sekmeler */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className={`btn-secondary ${activeTab === "liste" ? "btn-primary" : ""}`}
            onClick={() => setActiveTab("liste")}
          >
            📋 Mamül & Reçete Listesi ({filtered.length})
          </button>
          <button
            className={`btn-secondary ${activeTab === "hareketler" ? "btn-primary" : ""}`}
            onClick={() => setActiveTab("hareketler")}
          >
            📜 Sevkiyat & Hareket Geçmişi ({db.movements.length})
          </button>
        </div>

        {activeTab === "liste" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <input
              type="text"
              style={{ width: 280 }}
              placeholder="🔍 Mamül kodu, kalıp no, ürün, raf..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--muted)" }}>📋 Liste:</span>
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
              <option value="show">👁️ Mamül Listesini Göster</option>
              <option value="hide">🙈 Mamül Listesini Gizle</option>
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
        )}
      </div>

      {/* Tablo İçeriği */}
      {activeTab === "liste" ? (
        <>
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
              🙈 Mamül Tanım ve Reçete Listesi gizlendi. Listeyi görüntülemek için yukarıdaki <strong>"Mamül Listesini Göster"</strong> seçeneğini seçebilir veya butona tıklayabilirsiniz.
            </div>
          ) : loading ? (
            <p className="muted">Yükleniyor...</p>
          ) : filtered.length === 0 ? (
            <p className="muted" style={{ textAlign: "center", padding: 24 }}>
              {search ? "Arama kriterine uygun mamül bulunamadı." : "Henüz mamül tanımlanmamış."}
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.04)", textAlign: "left" }}>
                    <th style={{ padding: 10 }}>Mamül Kodu</th>
                    <th style={{ padding: 10 }}>Kalıp No</th>
                    <th style={{ padding: 10 }}>Mamül Adı / Ürün Tanımı</th>
                    <th style={{ padding: 10 }}>🛠️ Reçete (BOM) Bileşenleri</th>
                    <th style={{ padding: 10 }}>📍 Depo / Raf Kodu</th>
                    <th style={{ padding: 10 }}>Mevcut Stok</th>
                    <th style={{ padding: 10 }}>Min. Stok</th>
                    <th style={{ padding: 10, textAlign: "right" }}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((g) => {
                    const isCritical = Number(g.stokMiktari) <= Number(g.minStokMiktari || 0);
                    const receteList = g.recete || [];
                    return (
                      <tr key={g.kod} style={{ borderBottom: "1px solid var(--border-color, #e2e8f0)" }}>
                        <td style={{ padding: 10, fontWeight: "bold", fontFamily: "monospace" }}>{g.kod}</td>
                        <td style={{ padding: 10 }}>
                          {g.plastikKalipNo ? (
                            <span style={{ fontFamily: "monospace", padding: "2px 6px", borderRadius: 4, background: "rgba(16, 185, 129, 0.12)", color: "#059669", fontSize: "0.82rem", fontWeight: 600 }}>
                              {g.plastikKalipNo}
                            </span>
                          ) : (
                            <span className="muted">-</span>
                          )}
                        </td>
                        <td style={{ padding: 10 }}>{g.ad}</td>

                        {/* Reçete Bileşenleri */}
                        <td style={{ padding: 10 }}>
                          {receteList.length === 0 ? (
                            <span className="muted" style={{ fontSize: "0.8rem" }}>Reçete tanımlanmadı</span>
                          ) : (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {receteList.map((item, idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    fontSize: "0.75rem",
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    background: item.tip === "YARI_MAMUL" ? "rgba(59, 130, 246, 0.12)" : "rgba(139, 92, 246, 0.12)",
                                    color: item.tip === "YARI_MAMUL" ? "#1d4ed8" : "#6d28d9",
                                    border: "1px solid rgba(0,0,0,0.08)",
                                  }}
                                >
                                  {item.tip === "YARI_MAMUL" ? "⚙️ YM" : "🔩 YP"}: {item.kod} ({item.miktar}x)
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Düzenlenebilir Depo / Raf Kodu */}
                        <td style={{ padding: 10 }}>
                          {locationEditKod === g.kod ? (
                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                              <input
                                type="text"
                                style={{ width: 110, padding: "2px 6px", fontSize: "0.85rem" }}
                                value={locationVal}
                                onChange={(e) => setLocationVal(e.target.value)}
                                placeholder="ör: MAM-01/A2"
                              />
                              <button
                                type="button"
                                className="btn-small btn-success"
                                style={{ padding: "2px 6px", fontSize: "0.75rem" }}
                                onClick={() => handleSaveQuickLocation(g.kod)}
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
                                {g.depoKodu || <span className="muted">Tanımlanmadı</span>}
                              </span>
                              <button
                                type="button"
                                className="btn-small btn-secondary"
                                style={{ padding: "1px 5px", fontSize: "0.75rem" }}
                                onClick={() => {
                                  setLocationEditKod(g.kod);
                                  setLocationVal(g.depoKodu || "");
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
                            {g.stokMiktari} {g.birim || "ADET"}
                          </span>
                        </td>
                        <td style={{ padding: 10 }} className="muted">
                          {g.minStokMiktari || 0} {g.birim || "ADET"}
                        </td>

                        <td style={{ padding: 10, textAlign: "right" }}>
                          <button
                            className="btn-small btn-success"
                            style={{ marginRight: 4 }}
                            onClick={() => handleOpenMovement(g.kod, "GIRIS")}
                            title="Montaj Girişi"
                          >
                            + Giriş
                          </button>
                          <button
                            className="btn-small btn-warning"
                            style={{ marginRight: 6 }}
                            onClick={() => handleOpenMovement(g.kod, "CIKIS")}
                            title="Sevkiyat Düşümü"
                          >
                            - Sevkiyat
                          </button>
                          {!isStockView && (
                            <>
                              <button
                                className="btn-secondary btn-small"
                                style={{ marginRight: 4 }}
                                onClick={() => handleOpenEdit(g)}
                              >
                                Düzenle / Reçete
                              </button>
                              {canDelete && (
                                <button
                                  className="btn-danger btn-small"
                                  onClick={() => setDeleteTargetKod(g.kod)}
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
                <th style={{ padding: 10 }}>Mamül Kodu</th>
                <th style={{ padding: 10 }}>Miktar</th>
                <th style={{ padding: 10 }}>Tarih</th>
                <th style={{ padding: 10 }}>Açıklama / Reçete Otomatik Düşüm Detayı</th>
              </tr>
            </thead>
            <tbody>
              {db.movements.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 20, textAlign: "center" }} className="muted">
                    Henüz kayıtlı mamül hareketi bulunmuyor.
                  </td>
                </tr>
              ) : (
                db.movements.map((m) => (
                  <tr key={m.id} style={{ borderBottom: "1px solid var(--border-color, #e2e8f0)" }}>
                    <td style={{ padding: 10 }}>
                      {m.tip === "GIRIS" ? (
                        <span className="badge badge-success">⬇ GİRİŞ (Montaj Tamamlama)</span>
                      ) : (
                        <span className="badge badge-warning">⬆ ÇIKIŞ (Sevkiyat Düşümü)</span>
                      )}
                    </td>
                    <td style={{ padding: 10, fontWeight: "bold", fontFamily: "monospace" }}>{m.kod}</td>
                    <td style={{ padding: 10, fontWeight: "bold" }}>
                      {m.tip === "GIRIS" ? `+${m.miktar}` : `-${m.miktar}`}
                    </td>
                    <td style={{ padding: 10, fontSize: "0.85rem" }}>
                      {formatDateTR(m.tarih)}
                    </td>
                    <td style={{ padding: 10, fontSize: "0.88rem" }}>{m.aciklama || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* KPI Dashboard Kartları (Sayfa Altında Organizasyon & Daraltılabilir) */}
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
            📊 Mamül & Sevkiyat Stok Özet Gösterge Paneli
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
              <span className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase" }}>Nihai Mamül Çeşit</span>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{totalCount} Ürün</div>
            </div>
            <div style={{ background: "rgba(16, 185, 129, 0.08)", padding: 12, borderRadius: 8, borderLeft: "4px solid #10b981" }}>
              <span className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase" }}>Hazır Mamül Stok</span>
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
                {criticalCount} Ürün
              </div>
            </div>
            <div style={{ background: "rgba(139, 92, 246, 0.08)", padding: 12, borderRadius: 8, borderLeft: "4px solid #8b5cf6" }}>
              <span className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase" }}>Sevkiyat & Hareket</span>
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
              ⚠️ Mamül Ürününü Sil
            </h3>
            <p style={{ margin: "16px 0 24px 0", lineHeight: 1.6, fontSize: "0.95rem", color: "#cbd5e1" }}>
              <strong style={{ fontFamily: "monospace", color: "#38bdf8", background: "rgba(56, 189, 248, 0.15)", padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(56, 189, 248, 0.3)" }}>
                {deleteTargetKod}
              </strong>{" "}
              numaralı mamül ürününü düşüm yapmadan sistemden <strong style={{ color: "#f8fafc" }}>direkt silmek istediğinize emin misiniz?</strong>
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

      {/* Stok Hareket / Düşüm Modalı */}
      {movementModalOpen && (
        <div className="modal-overlay" onClick={() => setMovementModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{movementForm.tip === "GIRIS" ? "📥 Mamül Stok Girişi" : "📤 Mamül Sevkiyat Çıkışı (Otomatik Reçete Düşümü)"}</h3>
              <button type="button" className="close-btn" onClick={() => setMovementModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveMovement}>
              <div className="modal-body">
                {error && <p className="error" style={{ fontSize: "0.85rem" }}>{error}</p>}

                <label>
                  <span style={{ fontWeight: 600 }}>Mamül / Ürün Seçiniz *</span>
                  <select
                    value={movementForm.kod}
                    onChange={(e) => setMovementForm({ ...movementForm, kod: e.target.value })}
                    style={{ width: "100%", marginTop: 4 }}
                  >
                    {goods.map((g) => (
                      <option key={g.kod} value={g.kod}>
                        {g.kod} - {g.ad} (Mevcut: {g.stokMiktari} {g.birim || "ADET"})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span style={{ fontWeight: 600 }}>Miktar ({goods.find(g => g.kod === movementForm.kod)?.birim || "Adet"}) *</span>
                  <input
                    type="number"
                    min="1"
                    value={movementForm.miktar}
                    onChange={(e) => setMovementForm({ ...movementForm, miktar: Number(e.target.value) })}
                    style={{ width: "100%", marginTop: 4 }}
                  />
                </label>

                <label>
                  <span style={{ fontWeight: 600 }}>Açıklama / İrsaliye No / Müşteri</span>
                  <input
                    value={movementForm.aciklama}
                    onChange={(e) => setMovementForm({ ...movementForm, aciklama: e.target.value })}
                    placeholder="ör: İrsaliye #8821, Müşteri Sevkiyatı"
                    style={{ width: "100%", marginTop: 4 }}
                  />
                </label>

                {movementForm.tip === "CIKIS" && (
                  <div style={{ background: "rgba(245, 158, 11, 0.1)", padding: 10, borderRadius: 6, fontSize: "0.82rem", color: "#b45309", marginTop: 4 }}>
                    💡 <strong>Otomatik Reçete Düşümü:</strong> Bu mamüle tanımlı olan yarı mamül ve yardımcı parçalar stoktan otomatik olarak düşülecektir.
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setMovementModalOpen(false)}>
                  İptal
                </button>
                <button type="submit" className={movementForm.tip === "GIRIS" ? "btn-success" : "btn-warning"}>
                  {movementForm.tip === "GIRIS" ? "📥 Stok Girişini Kaydet" : "📤 Sevkiyat Çıkışı Yap"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tanım & Reçete (BOM) Ekleme / Düzenleme Modalı */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingGood ? "✏️ Mamül ve Reçete Düzenle" : "➕ Yeni Mamül & Reçete (BOM) Tanımla"}</h3>
              <button type="button" className="close-btn" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {error && <p className="error" style={{ fontSize: "0.85rem" }}>{error}</p>}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 12 }}>
                  <label>
                    <span style={{ fontWeight: 600 }}>Mamül Kodu *</span>
                    <input
                      value={form.kod || ""}
                      onChange={(e) => setForm({ ...form, kod: e.target.value })}
                      placeholder="ör: MAM-501"
                      disabled={!!editingGood}
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
                  <label>
                    <span style={{ fontWeight: 600 }}>Mamül / Ürün Adı *</span>
                    <input
                      value={form.ad || ""}
                      onChange={(e) => setForm({ ...form, ad: e.target.value })}
                      placeholder="ör: Tamamlanmış Montajlı Plastik Anahtar Kutusu"
                      style={{ width: "100%", marginTop: 4 }}
                    />
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label>
                    <span style={{ fontWeight: 600 }}>📍 Depo Kodu / Rafı</span>
                    <input
                      value={form.depoKodu || ""}
                      onChange={(e) => setForm({ ...form, depoKodu: e.target.value })}
                      placeholder="ör: MAM-01 / A-10"
                      style={{ width: "100%", marginTop: 4 }}
                    />
                  </label>
                  <label>
                    <span style={{ fontWeight: 600 }}>Birim</span>
                    <select
                      value={form.birim || "ADET"}
                      onChange={(e) => setForm({ ...form, birim: e.target.value })}
                      style={{ width: "100%", marginTop: 4 }}
                    >
                      <option value="ADET">ADET</option>
                      <option value="KUTU">KUTU</option>
                      <option value="PALET">PALET</option>
                      <option value="TAKIM">TAKIM</option>
                    </select>
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label>
                    <span style={{ fontWeight: 600 }}>Mevcut Stok</span>
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
                      value={form.minStokMiktari ?? 100}
                      onChange={(e) => setForm({ ...form, minStokMiktari: Number(e.target.value) })}
                      style={{ width: "100%", marginTop: 4 }}
                    />
                  </label>
                </div>

                {/* 🛠️ Ürün Reçetesi (BOM - Bill of Materials) Bölümü */}
                <div style={{ border: "1px solid var(--panel-border, #2a3340)", borderRadius: 8, padding: 12, background: "rgba(0,0,0,0.2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div>
                      <strong style={{ fontSize: "0.95rem" }}>🛠️ Ürün Reçetesi (BOM - Bill of Materials)</strong>
                      <p className="muted" style={{ margin: "2px 0 0 0", fontSize: "0.8rem" }}>
                        1 Adet bu mamül için kullanılan yarı mamüller ve yardımcı parçalar.
                      </p>
                    </div>
                    <button type="button" className="btn-secondary btn-small" onClick={handleAddBomItem}>
                      + Bileşen Ekle
                    </button>
                  </div>

                  {(!form.recete || form.recete.length === 0) ? (
                    <p className="muted" style={{ fontSize: "0.82rem", fontStyle: "italic", margin: "8px 0" }}>
                      Henüz reçete bileşeni eklenmedi. Sevkiyat çıkışında otomatik stok düşümü yapılabilmesi için parçaları tanımlayabilirsiniz.
                    </p>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {form.recete.map((item, idx) => (
                        <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(0,0,0,0.3)", padding: 8, borderRadius: 6, border: "1px solid var(--panel-border)" }}>
                          <select
                            value={item.tip}
                            onChange={(e) => handleUpdateBomItem(idx, { tip: e.target.value as any })}
                            style={{ width: 140, fontSize: "0.85rem" }}
                          >
                            <option value="YARI_MAMUL">⚙️ Yarı Mamül</option>
                            <option value="YARDIMCI_PARCA">🔩 Yardımcı Parça</option>
                          </select>

                          <select
                            value={item.kod}
                            onChange={(e) => handleUpdateBomItem(idx, { kod: e.target.value })}
                            style={{ flex: 1, fontSize: "0.85rem" }}
                          >
                            {item.tip === "YARI_MAMUL" ? (
                              semiParts.length === 0 ? (
                                <option value="">(Yarı mamül kaydı yok)</option>
                              ) : (
                                semiParts.map((sp) => (
                                  <option key={sp.kod} value={sp.kod}>
                                    {sp.kod} - {sp.ad}
                                  </option>
                                ))
                              )
                            ) : (
                              auxParts.length === 0 ? (
                                <option value="">(Yardımcı parça kaydı yok)</option>
                              ) : (
                                auxParts.map((ap) => (
                                  <option key={ap.kod} value={ap.kod}>
                                    {ap.kod} - {ap.cins || "Parça"}
                                  </option>
                                ))
                              )
                            )}
                          </select>

                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              style={{ width: 80, fontSize: "0.85rem" }}
                              value={item.miktar}
                              onChange={(e) => handleUpdateBomItem(idx, { miktar: Number(e.target.value) })}
                              placeholder="Miktar"
                            />
                            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>adet</span>
                          </div>

                          <button
                            type="button"
                            className="btn-danger btn-small"
                            style={{ padding: "4px 8px" }}
                            onClick={() => handleRemoveBomItem(idx)}
                            title="Bileşeni Kaldır"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <label>
                  <span style={{ fontWeight: 600 }}>Açıklama / Notlar</span>
                  <textarea
                    rows={2}
                    value={form.aciklama || ""}
                    onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
                    placeholder="Ambalaj içi adet, koli bilgisi vb."
                    style={{ width: "100%", marginTop: 4, fontFamily: "inherit" }}
                  />
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                  İptal
                </button>
                <button type="submit" className="btn-primary">
                  {editingGood ? "Güncelle" : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <IATFFormFooter formId="STK_F01" defaultKodu="STK/F01" defaultAdi="Mamül Stok Takip Formu" />
    </div>
  );
}
