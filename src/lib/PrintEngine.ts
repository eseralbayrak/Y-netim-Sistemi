import type { Receipt, LabelSettings } from "../types";
import { generateLabelHTML } from "./LabelTemplate";
import { generateBarcodeSVG, buildBarcodeValue } from "../utils/barcode";

export interface LabelData {
  receipt: Receipt;
  paketAgirligi: number;
  seq: number;
  toplamPaket: number;
}

export interface PrintEngineParams {
  labels: LabelData[];
  settings: LabelSettings;
}

function generatePageCSS(settings: LabelSettings): string {
  return `
    @page {
      size: ${settings.widthMm}mm ${settings.heightMm}mm;
      margin: 0;
      padding: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      width: ${settings.widthMm}mm;
      height: ${settings.heightMm}mm;
      margin: 0;
      padding: 0;
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      background: #ffffff;
      color: #000000;
    }
    .label-sheet {
      width: ${settings.widthMm}mm;
      height: ${settings.heightMm}mm;
      max-width: ${settings.widthMm}mm;
      max-height: ${settings.heightMm}mm;
      page-break-after: always;
      page-break-inside: avoid;
      box-sizing: border-box;
      padding: 0.8mm 1mm 0.5mm 1mm;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      overflow: hidden;
      background: #ffffff;
    }
    .label-table {
      width: 100%;
      height: calc(${settings.heightMm}mm - 4mm);
      min-height: 0;
      flex: none;
      border-collapse: collapse;
      border: 2px solid #000000;
      table-layout: fixed;
      flex: 1;
    }
    .label-table td {
      border: 1.8px solid #000000;
      padding: 0.7mm 1mm;
      vertical-align: middle;
      text-align: center;
      overflow: visible;
      overflow-wrap: anywhere;
    }

    /* HEADER ROW */
    .row-header {
      height: 9mm;
    }
    .cell-company, .cell-logo {
      padding: 1mm 1mm !important;
      vertical-align: middle;
      text-align: center;
      overflow: hidden;
    }
    .company-container, .logo-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      overflow: hidden;
    }
    .company-title {
      font-family: Arial, "Arial Black", sans-serif;
      font-size: 8pt;
      font-weight: 900;
      letter-spacing: 0.3px;
      line-height: 1.1;
      color: #000000;
      text-transform: uppercase;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .company-sub {
      font-family: Arial, sans-serif;
      font-size: 5pt;
      font-weight: 800;
      letter-spacing: 0.2px;
      line-height: 1.1;
      margin-top: 1px;
      color: #000000;
      text-transform: uppercase;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .logo-title {
      font-size: 7.5pt;
      font-weight: 800;
      letter-spacing: 0.3px;
      margin-top: 1px;
      line-height: 1.1;
    }
    .logo-sub {
      font-size: 5.5pt;
      font-weight: 700;
      letter-spacing: 0.2px;
      line-height: 1;
      color: #111111;
    }

    .cell-main-title {
      text-align: center;
      vertical-align: middle;
      padding: 0.8mm 1mm !important;
      overflow: hidden;
    }
    .main-title-1, .main-title-2 {
      font-family: Arial, "Arial Black", sans-serif;
      font-size: 11pt;
      font-weight: 900;
      letter-spacing: 0.6px;
      line-height: 1.1;
      color: #000000;
      text-transform: uppercase;
      margin: 0;
    }

    /* DATA CELLS */
    .data-label {
      font-size: 6.5pt;
      font-weight: 800;
      text-decoration: underline;
      text-transform: uppercase;
      margin-bottom: 0.4mm;
      letter-spacing: 0.2px;
      line-height: 1;
      color: #000000;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .data-value {
      font-family: "Times New Roman", Times, Georgia, serif;
      font-size: 8.5pt;
      font-weight: 700;
      line-height: 1.2;
      color: #000000;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .data-value-bold {
      font-family: "Times New Roman", Times, Georgia, serif;
      font-size: 9.5pt;
      font-weight: 800;
    }
    .data-value-lot {
      font-family: "Times New Roman", Times, Georgia, serif;
      font-size: 10pt;
      font-weight: 900;
      letter-spacing: 0.4px;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .packet-seq {
      font-size: 7pt;
      font-family: Arial, sans-serif;
      font-weight: 600;
      color: #333333;
      margin-top: 0.5px;
      line-height: 1;
    }

    /* INSPECTOR & STATUS */
    .cell-inspector-col {
      padding: 1mm 1.5mm !important;
      vertical-align: middle;
      text-align: center;
      overflow: hidden;
    }
    .inspector-name {
      font-family: "Times New Roman", Times, Georgia, serif;
      font-size: 9pt;
      font-weight: 700;
      margin-bottom: 0.5mm;
      color: #000000;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .kontrol-edilmistir-text {
      font-family: Arial, "Arial Black", sans-serif;
      font-size: 9pt;
      font-weight: 900;
      letter-spacing: 0.4px;
      line-height: 1;
      color: #000000;
      text-transform: uppercase;
      margin-top: 0.5mm;
    }

    /* BARCODE BRACKET BOX */
    .cell-barcode-bracket {
      height: 30mm;
      padding: 0 !important;
      vertical-align: middle;
      text-align: center;
      overflow: visible;
      border: none !important;
    }
    .barcode-bracket-box {
      position: relative;
      width: 100%;
      margin: 0 auto;
      height: 29mm;
      padding: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: visible;
    }
    .barcode-inner {
      width: 100%;
      height: 24mm;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: visible;
      padding: 0 2mm;
    }
    .label-footer-line {
      width: 100%;
      height: 2.5mm;
      padding-top: 0.3mm;
      color: #333333;
      font-size: 4.5pt;
      font-weight: 700;
      line-height: 1;
      white-space: nowrap;
      text-align: center;
    }
    .barcode-inner svg {
      width: auto !important;
      max-width: 100%;
      height: 24mm !important;
      display: block;
      margin: 0 auto;
      shape-rendering: crispEdges;
    }

    /* FOOTER LINE */

  `;
}

export const PrintEngine = {
  async print(params: PrintEngineParams): Promise<void> {
    const { labels, settings } = params;

    if (!labels || labels.length === 0) {
      alert("Yazdırılacak etiket yok");
      return;
    }

    try {
      let htmlContent = "";

      for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        const barcodeVal = buildBarcodeValue(label);
        const barcodeSVG = generateBarcodeSVG(barcodeVal, {
          height: 110,
          width: 3,
          displayValue: true,
          fontSize: 14,
        });

        const html = await generateLabelHTML({
          receipt: label.receipt,
          paketAgirligi: label.paketAgirligi,
          seq: label.seq,
          toplamPaket: label.toplamPaket,
          settings,
          barcodeSVG,
        });
        htmlContent += html;
      }

      const css = generatePageCSS(settings);

      const fullHTML = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <title>PARÇA VE MALZEME TANITIM ETİKETİ</title>
  <style>${css}</style>
</head>
<body>
  ${htmlContent}
  <script>
    window.onload = function() {
      document.querySelectorAll('.label-sheet').forEach(function(sheet) {
        var fitTargets = sheet.querySelectorAll('.company-title, .company-sub, .main-title-1, .main-title-2, .data-value, .inspector-name, .kontrol-edilmistir-text');
        fitTargets.forEach(function(target) {
          var currentSize = parseFloat(window.getComputedStyle(target).fontSize);
          var minimumSize = target.classList.contains('data-label') ? 5 : 5.5;
          while (sheet.scrollHeight > sheet.clientHeight && currentSize > minimumSize) {
            currentSize -= 0.25;
            target.style.fontSize = currentSize + 'pt';
          }
        });
      });
      setTimeout(function() {
        window.print();
        window.onafterprint = function() { window.close(); };
      }, 250);
    };
  </script>
</body>
</html>`;

      // Usar Blob URL en lugar de document.write para evitar SecurityError
      const blob = new Blob([fullHTML], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      
      const popup = window.open(url, "_blank", "width=850,height=950");
      if (!popup) {
        URL.revokeObjectURL(url);
        alert("Popup açılamadı. Tarayıcı ayarlarından popup engelleyiciyi kapatın.");
        return;
      }

      // Limpiar URL después de que el popup se abra
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (err) {
      console.error("Print error:", err);
      alert("Yazdırma hatası: " + String(err));
    }
  },
};
