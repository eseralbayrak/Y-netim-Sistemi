import JsBarcode from "jsbarcode";
import type { LabelData } from "../lib/PrintEngine";

export function normalizeBarcodeToken(value: string | null | undefined): string {
  return String(value || "-")
    .trim()
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u")
    .replace(/[^A-Za-z0-9._:-]/g, "_");
}

/** Code 128 içeriği: yalnızca LOT NO. */
export function buildBarcodeValue(label: LabelData): string {
  const { receipt } = label;
  return normalizeBarcodeToken(receipt.lotNo);
}

/**
 * Tarayıcı ortamında SVG formatında 1D Code 128 Barkod oluşturur.
 */
export function generateBarcodeSVG(
  value: string,
  options?: {
    height?: number;
    width?: number;
    fontSize?: number;
    displayValue?: boolean;
  }
): string {
  const text = String(value || "").trim();
  if (!text) return "";

  if (typeof document === "undefined") {
    return `<svg width="240" height="60" xmlns="http://www.w3.org/2000/svg">
      <rect width="240" height="60" fill="white"/>
      <text x="120" y="35" text-anchor="middle" font-family="monospace" font-size="14">${text}</text>
    </svg>`;
  }

  try {
    const svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svgNode, text, {
      format: "CODE128",
      displayValue: options?.displayValue ?? false,
      fontSize: options?.fontSize ?? 13,
      font: "SFMono-Regular, Consolas, monospace",
      textMargin: 4,
      margin: 16,
      height: options?.height ?? 40,
      width: options?.width ?? 3,
      background: "#ffffff",
      lineColor: "#000000",
    });
    svgNode.setAttribute("shape-rendering", "crispEdges");
    svgNode.setAttribute("preserveAspectRatio", "xMidYMid meet");
    return svgNode.outerHTML;
  } catch (err) {
    console.warn("Barkod oluşturma hatası, fallback metin gösteriliyor:", err);
    return `<svg width="240" height="60" xmlns="http://www.w3.org/2000/svg">
      <rect width="240" height="60" fill="white" stroke="#333" stroke-width="1"/>
      <text x="120" y="35" text-anchor="middle" font-family="monospace" font-size="14" font-weight="bold">${text}</text>
    </svg>`;
  }
}

export async function generateQRSVG(label: LabelData): Promise<string> {
  const barcodeValue = buildBarcodeValue(label);
  return generateBarcodeSVG(barcodeValue, { height: 42, width: 1.8, fontSize: 13 });
}
