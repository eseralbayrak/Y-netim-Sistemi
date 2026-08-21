import type { Movement, Receipt } from "../types";
import { IATFFormFooter } from "./IATFFormFooter";
import { formatDateTR } from "../lib/dateUtils";

interface Props {
  movements: Movement[];
  receipts: Receipt[];
}

export default function Gecmis({ movements, receipts }: Props) {
  const rejected = receipts.filter((r) => r.durum === "REDDEDILDI");

  return (
    <div className="panel">
      <h2>Hareket Geçmişi</h2>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tip</th>
              <th>Lot No</th>
              <th>Malzeme Kodu</th>
              <th>Miktar (KG)</th>
              <th>Tarih</th>
              <th>Açıklama</th>
            </tr>
          </thead>
          <tbody>
            {movements.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Henüz hareket yok.
                </td>
              </tr>
            )}
            {movements.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.tip === "GIRIS" ? (
                    <span className="tag-ok">GİRİŞ</span>
                  ) : m.tip === "RET" ? (
                    <span className="tag" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.4)" }}>
                      🚨 RET
                    </span>
                  ) : m.tip === "RET_CIKIS" ? (
                    <span className="tag" style={{ background: "rgba(168, 85, 247, 0.2)", color: "#c084fc", border: "1px solid rgba(168, 85, 247, 0.4)" }}>
                      🚚 RET İADE
                    </span>
                  ) : (
                    <span className="tag-info">{m.tip}</span>
                  )}
                </td>
                <td>{m.lotNo}</td>
                <td>{m.malzemeKodu}</td>
                <td>{m.miktar}</td>
                <td>{formatDateTR(m.tarih)}</td>
                <td className="muted">{m.aciklama || m.kullanici || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 32 }}>Reddedilen Lotlar (DÖF)</h2>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Lot No</th>
              <th>Malzeme Kodu</th>
              <th>Firma</th>
              <th>Red Nedeni</th>
              <th>Tarih</th>
            </tr>
          </thead>
          <tbody>
            {rejected.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Reddedilen kayıt yok.
                </td>
              </tr>
            )}
            {rejected.map((r) => (
              <tr key={r.id}>
                <td>{r.lotNo}</td>
                <td>{r.malzemeKodu}</td>
                <td>{r.firma}</td>
                <td className="error-text">{r.redNedeni}</td>
                <td>{formatDateTR(r.kontrolTarihi)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <IATFFormFooter formId="REP_F08" defaultKodu="REP/F08" defaultAdi="Stok Hareket ve Uygunsuzluk Kayıt Raporu" />
    </div>
  );
}
