import type { Receipt, LabelSettings } from "../types";
import { findMaterial } from "./materialsStorage";
import { findAuxiliaryPart } from "./auxiliaryStorage";
import { loadFormMetadataItem } from "./formMetadata";

export interface LabelTemplateParams {
  receipt: Receipt;
  paketAgirligi: number;
  seq: number;
  toplamPaket: number;
  settings: LabelSettings;
  barcodeSVG?: string;
  qrSVG?: string;
}

function safe(text: string | null | undefined): string {
  if (!text) return "—";
  return String(text).replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return safe(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return safe(date);
  }
}

async function resolveMaterialName(receipt: Receipt): Promise<string> {
  try {
    const mat = await findMaterial(receipt.malzemeKodu);
    if (mat?.cins) return mat.cins;
  } catch {}

  try {
    const aux = await findAuxiliaryPart(receipt.malzemeKodu);
    if (aux?.cins) return aux.cins;
  } catch {}

  return receipt.malzemeKodu || "—";
}

export async function generateLabelHTML(
  params: LabelTemplateParams
): Promise<string> {
  const {
    receipt,
    paketAgirligi,
    seq,
    toplamPaket,
    barcodeSVG,
    qrSVG,
  } = params;

  const [malzemeAdi, formMeta] = await Promise.all([
    resolveMaterialName(receipt),
    loadFormMetadataItem("URT_F19", "ÜRT/F 19", "Parça ve Malzeme Tanıtım Etiketi"),
  ]);
  const svgContent = barcodeSVG || qrSVG || "";
  const birim = receipt.birim || "KG";

  return `
<div class="label-sheet">
  <table class="label-table">
    <!-- ROW 1: Company Header and Main Header -->
    <tr class="row-header">
      <td class="cell-company" style="width: 36%;">
        <div class="company-container">
          <div class="company-title">B.R LEVENT PLASTİK</div>
          <div class="company-sub">OTO YAN SAN. TİC. LTD. ŞTİ.</div>
        </div>
      </td>
      <td class="cell-main-title" colspan="2" style="width: 64%;">
        <div class="main-title-1">PARÇA VE MALZEME</div>
        <div class="main-title-2">TANITIM ETİKETİ</div>
      </td>
    </tr>

    <!-- ROW 2: Tedarikçi Firma | Sipariş No | Sip. Gelen Miktar -->
    <tr>
      <td class="cell-data" style="width: 48%;">
        <div class="data-label">TEDARİKÇİ FİRMA</div>
        <div class="data-value">${safe(receipt.firma)}</div>
      </td>
      <td class="cell-data" style="width: 26%;">
        <div class="data-label">SİPARİŞ NO</div>
        <div class="data-value">${safe(receipt.siparisNo) || "—"}</div>
      </td>
      <td class="cell-data" style="width: 26%;">
        <div class="data-label">SİP.GELEN MİK.( adet / kg)</div>
        <div class="data-value data-value-bold">${receipt.gelenMiktar} ${birim}</div>
      </td>
    </tr>

    <!-- ROW 3: Parça / Malzeme Adı | Parça No / Malzeme Kodu -->
    <tr>
      <td class="cell-data" style="width: 48%;">
        <div class="data-label">PARÇA / MALZEME ADI</div>
        <div class="data-value">${safe(malzemeAdi)}</div>
      </td>
      <td class="cell-data" colspan="2" style="width: 52%;">
        <div class="data-label">PARÇA NO / MALZEME KODU</div>
        <div class="data-value data-value-bold">${safe(receipt.malzemeKodu)}</div>
      </td>
    </tr>

    <!-- ROW 4: Üretici / B.R Lot No | Geliş Tarihi | Ambalaj Miktarı -->
    <tr>
      <td class="cell-data" style="width: 48%;">
        <div class="data-label">ÜRETİCİ / B.R LOT NO</div>
        <div class="data-value data-value-lot">${safe(receipt.lotNo)}</div>
      </td>
      <td class="cell-data" style="width: 26%;">
        <div class="data-label">GELİŞ TARİHİ</div>
        <div class="data-value">${formatDate(receipt.girisTarihi)}</div>
      </td>
      <td class="cell-data" style="width: 26%;">
        <div class="data-label">AMBALAJ MİKTARI(adet/kg )</div>
        <div class="data-value data-value-bold">
          ${paketAgirligi.toFixed(2)} ${birim}
          ${toplamPaket > 1 ? `<div class="packet-seq">(${seq}/${toplamPaket})</div>` : ""}
        </div>
      </td>
    </tr>

    <!-- ROW 5: Giriş kalite bilgileri -->
    <tr>
      <td class="cell-inspector-col" style="width: 48%;">
        <div class="data-label">KONTROL EDEN</div>
        <div class="data-value inspector-name">${safe(receipt.kontrolEden || "Giriş Kalite")}</div>
      </td>
      <td class="cell-inspector-col" colspan="2" style="width: 52%;">
        <div class="kontrol-edilmistir-text">KONTROL EDİLMİŞTİR</div>
      </td>
    </tr>

    <!-- ROW 6: Geniş Lot barkodu -->
    <tr>
      <td class="cell-barcode-bracket" colspan="3" style="width: 100%;">
        <div class="barcode-bracket-box">
          <div class="barcode-inner">${svgContent}</div>
        </div>
      </td>
    </tr>
  </table>
  <div class="label-footer-line">
    Yürürlük: ${safe(formMeta.yururlukTarihi)} · Rev. Tarihi: ${safe(formMeta.revTarihi)} · Rev.No: ${safe(formMeta.revNo)} · ${safe(formMeta.formKodu)}
  </div>
</div>
`;
}
