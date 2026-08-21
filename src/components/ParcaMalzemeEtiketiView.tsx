import { useEffect, useState } from "react";
import type { Receipt } from "../types";
import { findMaterial } from "../lib/materialsStorage";
import { findAuxiliaryPart } from "../lib/auxiliaryStorage";
import { type FormMetadata, loadFormMetadataItem } from "../lib/formMetadata";
import BarcodeView from "./BarcodeView";
import { buildBarcodeValue } from "../utils/barcode";

interface Props {
  receipt: Receipt;
  paketAgirligi?: number;
  seq?: number;
  toplamPaket?: number;
  showBorder?: boolean;
}

export default function ParcaMalzemeEtiketiView({
  receipt,
  paketAgirligi = receipt.gelenMiktar,
  seq = 1,
  toplamPaket = 1,
  showBorder = true,
}: Props) {
  const [malzemeAdi, setMalzemeAdi] = useState<string>(receipt.malzemeKodu);
  const [formMeta, setFormMeta] = useState<FormMetadata | null>(null);

  useEffect(() => {
    let active = true;

    loadFormMetadataItem("URT_F19", "ÜRT/F 19", "Parça ve Malzeme Tanıtım Etiketi").then((data) => {
      if (active) setFormMeta(data);
    });

    (async () => {
      try {
        const mat = await findMaterial(receipt.malzemeKodu);
        if (mat?.cins && active) {
          setMalzemeAdi(mat.cins);
          return;
        }
      } catch {}

      try {
        const aux = await findAuxiliaryPart(receipt.malzemeKodu);
        if (aux?.cins && active) {
          setMalzemeAdi(aux.cins);
          return;
        }
      } catch {}

      if (active) {
        setMalzemeAdi(receipt.malzemeKodu || "—");
      }
    })();

    return () => {
      active = false;
    };
  }, [receipt.malzemeKodu]);

  function formatDate(d?: string) {
    if (!d) return "—";
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return d;
      return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
    } catch {
      return d;
    }
  }

  const birim = receipt.birim || "KG";

  return (
    <div
      style={{
        background: "#ffffff",
        color: "#000000",
        padding: "10px",
        borderRadius: 4,
        fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
        maxWidth: 580,
        margin: "0 auto",
        boxShadow: showBorder ? "0 4px 14px rgba(0,0,0,0.15)" : "none",
        border: showBorder ? "1px solid #cbd5e1" : "none",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          border: "2px solid #000000",
          tableLayout: "fixed",
          fontSize: "12px",
        }}
      >
        <tbody>
          {/* ROW 1: Company Header & Header */}
          <tr style={{ height: "48px" }}>
            <td
              style={{
                width: "36%",
                border: "2px solid #000000",
                padding: "3px 4px",
                textAlign: "center",
                verticalAlign: "middle",
              }}
            >
              <div
                style={{
                  fontFamily: 'Arial, "Arial Black", sans-serif',
                  fontSize: "11px",
                  fontWeight: 900,
                  letterSpacing: "0.4px",
                  lineHeight: "1.15",
                  color: "#000000",
                }}
              >
                B.R LEVENT PLASTİK
              </div>
              <div
                style={{
                  fontSize: "7px",
                  fontWeight: 800,
                  color: "#000000",
                  letterSpacing: "0.2px",
                  marginTop: "1px",
                  lineHeight: "1.2",
                }}
              >
                OTO YAN SAN. TİC. LTD. ŞTİ.
              </div>
            </td>
            <td
              colSpan={2}
              style={{
                width: "64%",
                border: "2px solid #000000",
                padding: "3px 5px",
                textAlign: "center",
                verticalAlign: "middle",
              }}
            >
              <div
                style={{
                  fontFamily: 'Arial, "Arial Black", sans-serif',
                  fontSize: "14px",
                  fontWeight: 900,
                  letterSpacing: "0.8px",
                  lineHeight: "1.15",
                }}
              >
                PARÇA VE MALZEME
              </div>
              <div
                style={{
                  fontFamily: 'Arial, "Arial Black", sans-serif',
                  fontSize: "14px",
                  fontWeight: 900,
                  letterSpacing: "0.8px",
                  lineHeight: "1.15",
                }}
              >
                TANITIM ETİKETİ
              </div>
            </td>
          </tr>

          {/* ROW 2: Tedarikçi Firma | Sipariş No | Sip. Gelen Miktar */}
          <tr>
            <td style={{ width: "48%", border: "2px solid #000000", padding: "6px 8px", textAlign: "center" }}>
              <div style={{ textDecoration: "underline", fontWeight: 800, fontSize: "11px", marginBottom: "4px" }}>
                TEDARİKÇİ FİRMA
              </div>
              <div style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: "14px", fontWeight: 700 }}>
                {receipt.firma || "—"}
              </div>
            </td>
            <td style={{ width: "26%", border: "2px solid #000000", padding: "6px 8px", textAlign: "center" }}>
              <div style={{ textDecoration: "underline", fontWeight: 800, fontSize: "11px", marginBottom: "4px" }}>
                SİPARİŞ NO
              </div>
              <div style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: "13px", fontWeight: 700 }}>
                {receipt.siparisNo || "—"}
              </div>
            </td>
            <td style={{ width: "26%", border: "2px solid #000000", padding: "6px 8px", textAlign: "center" }}>
              <div style={{ textDecoration: "underline", fontWeight: 800, fontSize: "11px", marginBottom: "4px" }}>
                SİP.GELEN MİK.( adet / kg)
              </div>
              <div style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: "14px", fontWeight: 800 }}>
                {receipt.gelenMiktar} {birim}
              </div>
            </td>
          </tr>

          {/* ROW 3: Parça / Malzeme Adı | Parça No / Malzeme Kodu */}
          <tr>
            <td style={{ width: "48%", border: "2px solid #000000", padding: "6px 8px", textAlign: "center" }}>
              <div style={{ textDecoration: "underline", fontWeight: 800, fontSize: "11px", marginBottom: "4px" }}>
                PARÇA / MALZEME ADI
              </div>
              <div style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: "13px", fontWeight: 700 }}>
                {malzemeAdi}
              </div>
            </td>
            <td colSpan={2} style={{ width: "52%", border: "2px solid #000000", padding: "6px 8px", textAlign: "center" }}>
              <div style={{ textDecoration: "underline", fontWeight: 800, fontSize: "11px", marginBottom: "4px" }}>
                PARÇA NO / MALZEME KODU
              </div>
              <div style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: "15px", fontWeight: 800 }}>
                {receipt.malzemeKodu}
              </div>
            </td>
          </tr>

          {/* ROW 4: Üretici / B.R Lot No | Geliş Tarihi | Ambalaj Miktarı */}
          <tr>
            <td style={{ width: "48%", border: "2px solid #000000", padding: "6px 8px", textAlign: "center" }}>
              <div style={{ textDecoration: "underline", fontWeight: 800, fontSize: "11px", marginBottom: "4px" }}>
                ÜRETİCİ / B.R LOT NO
              </div>
              <div style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: "17px", fontWeight: 900 }}>
                {receipt.lotNo}
              </div>
            </td>
            <td style={{ width: "26%", border: "2px solid #000000", padding: "6px 8px", textAlign: "center" }}>
              <div style={{ textDecoration: "underline", fontWeight: 800, fontSize: "11px", marginBottom: "4px" }}>
                GELİŞ TARİHİ
              </div>
              <div style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: "13px", fontWeight: 700 }}>
                {formatDate(receipt.girisTarihi)}
              </div>
            </td>
            <td style={{ width: "26%", border: "2px solid #000000", padding: "6px 8px", textAlign: "center" }}>
              <div style={{ textDecoration: "underline", fontWeight: 800, fontSize: "11px", marginBottom: "4px" }}>
                AMBALAJ MİKTARI(adet/kg )
              </div>
              <div style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: "14px", fontWeight: 800 }}>
                {paketAgirligi.toFixed(2)} {birim}
                {toplamPaket > 1 && (
                  <span style={{ fontSize: "11px", fontWeight: 600, display: "block", color: "#475569" }}>
                    ({seq}/{toplamPaket})
                  </span>
                )}
              </div>
            </td>
          </tr>

          {/* ROW 5: Giriş kalite bilgileri */}
          <tr>
            <td style={{ width: "48%", border: "2px solid #000000", padding: "6px 8px", textAlign: "center", verticalAlign: "middle" }}>
              <div style={{ textDecoration: "underline", fontWeight: 800, fontSize: "11px", marginBottom: "3px" }}>
                KONTROL EDEN
              </div>
              <div style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: "14px", fontWeight: 700 }}>
                {receipt.kontrolEden || "Giriş Kalite"}
              </div>
            </td>
            <td colSpan={2} style={{ width: "52%", border: "2px solid #000000", padding: "6px 8px", textAlign: "center", verticalAlign: "middle" }}>
              <div style={{ fontFamily: 'Arial, "Arial Black", sans-serif', fontSize: "14px", fontWeight: 900, letterSpacing: "0.4px", textTransform: "uppercase" }}>
                KONTROL EDİLMİŞTİR
              </div>
            </td>
          </tr>

          {/* ROW 6: Geniş Lot barkodu */}
          <tr>
            <td colSpan={3} style={{ width: "100%", border: "2px solid #000000", padding: "2px 0 0", textAlign: "center", verticalAlign: "middle" }}>
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  margin: "0 auto",
                  padding: "0",
                  display: "flex",
                  justifyContent: "center",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div style={{ width: "100%", height: "125px", display: "flex", justifyContent: "center", alignItems: "center", padding: "2px 0" }}>
                  <BarcodeView value={buildBarcodeValue({ receipt, paketAgirligi, seq, toplamPaket })} height={110} width={3} fontSize={14} displayValue={true} />
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div style={{ width: "100%", paddingTop: "2px", textAlign: "center", fontSize: "6px", lineHeight: 1, fontWeight: 700, color: "#333333", whiteSpace: "nowrap" }}>
        Yürürlük: {formMeta?.yururlukTarihi || "22/03/2002"} · Rev. Tarihi: {formMeta?.revTarihi || "09.03.2011"} · Rev.No: {formMeta?.revNo || "01"} · {formMeta?.formKodu || "ÜRT/F 19"}
      </div>
    </div>
  );
}
