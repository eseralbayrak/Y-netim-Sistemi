import { useEffect, useState } from "react";
import type { LotRow } from "./stockUtils";
import { formatKg } from "./stockUtils";
import { updateLotLocation, deleteLot } from "../../lib/storage";
import { getStoredUser } from "../../lib/auth";
import { formatDateTR } from "../../lib/dateUtils";

interface Props {
  rows: LotRow[];
  onDetay: (lotNo: string) => void;
  onLocationChanged: () => void;
  showAllRows?: boolean;
}

const PAGE_SIZE = 20;

const DURUM_BADGE: Record<LotRow["durum"], { label: string; cls: string }> = {
  NORMAL: { label: "🟢 Normal", cls: "tag-ok" },
  KRITIK: { label: "🟡 Kritik", cls: "tag-warning" },
  TUKENDI: { label: "🔴 Tükendi", cls: "tag-ng" },
};

export default function StockTable({ rows, onDetay, onLocationChanged, showAllRows }: Props) {
  const [page, setPage] = useState(1);
  const [searchLot, setSearchLot] = useState("");
  const [searchMaterial, setSearchMaterial] = useState("");
  const [deleteTargetLot, setDeleteTargetLot] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const currentUser = getStoredUser();
  const canDelete = currentUser?.role === "Yönetici" || currentUser?.role === "Giriş Kalite";

  useEffect(() => {
    setPage(1);
  }, [rows.length]);

  const filtered = rows.filter((r) => {
    if (searchLot && !r.lotNo.toLowerCase().includes(searchLot.toLowerCase())) return false;
    if (searchMaterial && !r.malzemeAdi.toLowerCase().includes(searchMaterial.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = showAllRows ? filtered : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleLocationBlur(lotNo: string, value: string) {
    updateLotLocation(lotNo, value)
      .then(() => onLocationChanged())
      .catch(() => {});
  }

  async function confirmDeleteLot() {
    if (!deleteTargetLot) return;
    setDeleting(true);
    try {
      await deleteLot(deleteTargetLot);
      setDeleteTargetLot(null);
      onLocationChanged();
    } catch (err: any) {
      alert(err.message || "Lot silinirken hata oluştu.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="panel">
      <h2>Hammadde Lot Detay Tablosu — {rows.length} Kayıt</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <input
          placeholder="Lot No ile ara..."
          value={searchLot}
          onChange={(e) => {
            setSearchLot(e.target.value);
            setPage(1);
          }}
          style={{ padding: "8px 10px", minWidth: 160 }}
        />
        <input
          placeholder="Malzeme adı ile ara..."
          value={searchMaterial}
          onChange={(e) => {
            setSearchMaterial(e.target.value);
            setPage(1);
          }}
          style={{ padding: "8px 10px", minWidth: 220 }}
        />
        <button
          className="btn-secondary btn-small"
          onClick={() => {
            setSearchLot("");
            setSearchMaterial("");
            setPage(1);
          }}
        >
          Filtreleri Temizle
        </button>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Lot No</th>
              <th>Malzeme Kodu</th>
              <th>Malzeme Adı</th>
              <th>Firma</th>
              <th>Giriş Tarihi</th>
              <th>İlk Giriş (KG)</th>
              <th>Kullanılan (KG)</th>
              <th>Kalan (KG)</th>
              <th>Depo Lokasyonu</th>
              <th>Durum</th>
              {!showAllRows && <th>Aksiyon</th>}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={showAllRows ? 10 : 11} className="muted">
                  Filtreye uyan kayıt bulunamadı.
                </td>
              </tr>
            )}
            {pageRows.map((r) => (
              <tr key={r.lotNo}>
                <td>{r.lotNo}</td>
                <td>{r.malzemeKodu}</td>
                <td className="muted">{r.malzemeAdi}</td>
                <td className="muted">{r.firma}</td>
                <td>{formatDateTR(r.girisTarihi)}</td>
                <td>{formatKg(r.ilkGirisMiktari)}</td>
                <td>{formatKg(r.kullanilanMiktar)}</td>
                <td>
                  <strong>{formatKg(r.kalanMiktar)}</strong>
                </td>
                <td>
                  <input
                    className="coa-input"
                    defaultValue={r.depoLokasyonu === "—" ? "" : r.depoLokasyonu}
                    placeholder="örn. Raf A-3"
                    onBlur={(e) => handleLocationBlur(r.lotNo, e.target.value)}
                  />
                </td>
                <td>
                  <span className={DURUM_BADGE[r.durum].cls}>{DURUM_BADGE[r.durum].label}</span>
                </td>
                {!showAllRows && (
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn-secondary btn-small" onClick={() => onDetay(r.lotNo)}>
                        Detay
                      </button>
                      {canDelete && (
                        <button
                          className="btn-danger btn-small"
                          onClick={() => setDeleteTargetLot(r.lotNo)}
                          title="Düşüm yapmadan hammadde lotunu direkt sil (Yönetici / Giriş Kalite)"
                        >
                          Sil
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!showAllRows && totalPages > 1 && (
        <div className="pagination-row">
          <button
            className="btn-secondary btn-small"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Önceki
          </button>
          <span className="muted">
            Sayfa {page} / {totalPages}
          </span>
          <button
            className="btn-secondary btn-small"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Sonraki →
          </button>
        </div>
      )}

      {/* Silme Onay Pop-up Modalı */}
      {deleteTargetLot && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
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
              ⚠️ Hammadde Lotunu Sil
            </h3>
            <p style={{ margin: "16px 0 24px 0", lineHeight: 1.6, fontSize: "0.95rem", color: "#cbd5e1" }}>
              <strong style={{ fontFamily: "monospace", color: "#38bdf8", background: "rgba(56, 189, 248, 0.15)", padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(56, 189, 248, 0.3)" }}>
                {deleteTargetLot}
              </strong>{" "}
              numaralı hammadde lotunu düşüm yapmadan sistemden <strong style={{ color: "#f8fafc" }}>direkt silmek istediğinize emin misiniz?</strong>
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeleteTargetLot(null)}
                disabled={deleting}
                style={{ padding: "8px 16px" }}
              >
                İptal Et
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={confirmDeleteLot}
                disabled={deleting}
                style={{ minWidth: 110, padding: "8px 16px" }}
              >
                {deleting ? "Siliniyor..." : "Evet, Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
