import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import type { LotRow } from "./stockUtils";

interface Props {
  rows: LotRow[];
  dashboardRef: React.RefObject<HTMLDivElement | null>;
  onClearFilters: () => void;
  withPrintMode: (action: () => void | Promise<void>) => Promise<void>;
}

export function exportExcel(rows: LotRow[]) {
  const data = rows.map((r) => ({
    "Lot No": r.lotNo,
    "Malzeme Kodu": r.malzemeKodu,
    "Malzeme Adı": r.malzemeAdi,
    Firma: r.firma,
    "Giriş Tarihi": r.girisTarihi,
    "İlk Giriş (KG)": r.ilkGirisMiktari,
    "Kullanılan (KG)": r.kullanilanMiktar,
    "Kalan (KG)": r.kalanMiktar,
    "Depo Lokasyonu": r.depoLokasyonu,
    Durum: r.durum,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Depo Stok");
  XLSX.writeFile(wb, `depo-stok-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportPdf(el: HTMLDivElement) {
  const canvas = await html2canvas(el, { backgroundColor: "#10151c", scale: 2 });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? "l" : "p",
    unit: "px",
    format: [canvas.width, canvas.height],
  });
  pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
  pdf.save(`depo-stok-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function ExportButtons({ rows, dashboardRef, onClearFilters, withPrintMode }: Props) {
  return (
    <div className="export-buttons no-print">
      <button className="btn-secondary btn-small" onClick={onClearFilters}>
        Filtreleri Temizle
      </button>
      <button className="btn-secondary btn-small" onClick={() => exportExcel(rows)}>
        Excel'e Aktar
      </button>
      <button
        className="btn-secondary btn-small"
        onClick={() =>
          withPrintMode(async () => {
            if (dashboardRef.current) await exportPdf(dashboardRef.current);
          })
        }
      >
        PDF Oluştur
      </button>
      <button className="btn-secondary btn-small" onClick={() => withPrintMode(() => window.print())}>
        Yazdır
      </button>
    </div>
  );
}
