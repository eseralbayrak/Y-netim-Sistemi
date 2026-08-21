import { useEffect, useState } from "react";
import type { Movement, Receipt } from "../../types";
import { findReceiptByLotNo, getMovementsForLot, updateReceipt } from "../../lib/storage";
import { validatePdf, uploadDocument } from "../../lib/fileUtils";
import { formatDateTR, toIsoDate } from "../../lib/dateUtils";
import type { LotRow } from "./stockUtils";
import { formatKg } from "./stockUtils";

interface Props {
  lotNo: string | null;
  rows: LotRow[];
  onClose: () => void;
  onChanged: () => void;
}

export default function LotDrawer({ lotNo, rows, onClose, onChanged }: Props) {
  const [receipt, setReceipt] = useState<Receipt | undefined>(undefined);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!lotNo) return;
    findReceiptByLotNo(lotNo).then(setReceipt);
    getMovementsForLot(lotNo).then(setMovements);
    setUploadError("");
  }, [lotNo]);

  if (!lotNo) return null;
  const row = rows.find((r) => r.lotNo === lotNo);

  async function handleUploadCoa(file: File | null) {
    if (!file || !receipt) return;
    setUploadError("");
    const err = validatePdf(file);
    if (err) {
      setUploadError(err);
      return;
    }
    setUploading(true);
    try {
      const doc = await uploadDocument("coa", receipt.id, file);
      setReceipt({ ...receipt, documents: { coa: doc } });
      onChanged();
    } catch (e: any) {
      setUploadError(e.message || "Dosya yüklenemedi, tekrar deneyin.");
    } finally {
      setUploading(false);
    }
  }

  async function handleFieldSave(field: "sertifikaNo" | "sonKullanmaTarihi", value: string) {
    if (!receipt) return;
    setReceipt({ ...receipt, [field]: value });
    try {
      await updateReceipt(receipt.id, { [field]: value });
      onChanged();
    } catch {
      // sessizce geç, kullanıcı akışını bozma
    }
  }

  const coaDoc = receipt?.documents?.coa;

  return (
    <div className="drawer-overlay no-print" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h2 style={{ margin: 0 }}>Lot Detayı</h2>
          <button className="btn-secondary btn-small" onClick={onClose}>
            ✕ Kapat
          </button>
        </div>

        <h3 className="sub-heading">Genel Bilgiler</h3>
        <div className="drawer-info-grid">
          <div>
            <span className="muted">Lot No</span>
            <div>{lotNo}</div>
          </div>
          <div>
            <span className="muted">Malzeme</span>
            <div>{row?.malzemeAdi} ({row?.malzemeKodu})</div>
          </div>
          <div>
            <span className="muted">Firma</span>
            <div>{row?.firma}</div>
          </div>
          <div>
            <span className="muted">Giriş Tarihi</span>
            <div>{formatDateTR(row?.girisTarihi)}</div>
          </div>
          <div>
            <span className="muted">Depo Lokasyonu</span>
            <div>{row?.depoLokasyonu}</div>
          </div>
          <div>
            <span className="muted">Sertifika No</span>
            <input
              defaultValue={receipt?.sertifikaNo || ""}
              placeholder="—"
              onBlur={(e) => handleFieldSave("sertifikaNo", e.target.value)}
            />
          </div>
          <div>
            <span className="muted">Son Kullanma Tarihi</span>
            <input
              type="text"
              placeholder="GG/AA/YYYY"
              defaultValue={formatDateTR(receipt?.sonKullanmaTarihi)}
              onBlur={(e) => handleFieldSave("sonKullanmaTarihi", toIsoDate(e.target.value))}
            />
          </div>
        </div>

        <h3 className="sub-heading">Hareket Geçmişi</h3>
        <div className="timeline">
          {receipt && (
            <div className="timeline-item timeline-giris">
              <span className="timeline-date">{formatDateTR(row?.girisTarihi)}</span>
              <span>{formatKg(receipt.gelenMiktar)} KG giriş</span>
            </div>
          )}
          {movements
            .filter((m) => m.tip === "CIKIS")
            .map((m) => (
              <div className="timeline-item timeline-cikis" key={m.id}>
                <span className="timeline-date">
                  {formatDateTR(m.tarih)}
                </span>
                <span>
                  {formatKg(m.miktar)} KG üretime çıktı
                  {m.kullanici ? ` (${m.kullanici})` : ""}
                </span>
              </div>
            ))}
          <div className="timeline-item timeline-final">
            <span className="timeline-date">Kalan</span>
            <span>
              <strong>{formatKg(row?.kalanMiktar ?? 0)} KG</strong>
            </span>
          </div>
        </div>

        <h3 className="sub-heading">Evrak — CoA / Analiz Sertifikası</h3>
        <p className="muted" style={{ marginTop: -6, marginBottom: 10 }}>
          Bu belge lota özeldir (her lotun kendi analiz sonucu farklıdır). Ürüne ait TDS/MSDS
          belgeleri için Malzeme Tanımları ekranına bakın.
        </p>
        {uploadError && <p className="error">{uploadError}</p>}
        <div className="doc-list">
          <div className="doc-row">
            <span className="doc-label">📄 CoA / Analiz Sertifikası</span>
            {coaDoc ? (
              <a
                className="btn-secondary btn-small"
                href={coaDoc.url}
                target="_blank"
                rel="noreferrer"
              >
                Görüntüle ({coaDoc.name})
              </a>
            ) : (
              <span className="muted">Yüklenmedi</span>
            )}
            <label className="btn-secondary btn-small doc-upload-btn">
              {uploading ? "Yükleniyor..." : "Yükle / Değiştir"}
              <input
                type="file"
                accept="application/pdf"
                disabled={uploading}
                style={{ display: "none" }}
                onChange={(e) => handleUploadCoa(e.target.files?.[0] || null)}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
