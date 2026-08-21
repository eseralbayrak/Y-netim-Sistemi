import type { StockFilters, StokDurumu } from "./stockUtils";
import { formatDateTR, toIsoDate } from "../../lib/dateUtils";

interface Props {
  filters: StockFilters;
  onChange: (f: StockFilters) => void;
}

const STOK_DURUMU_OPTIONS: { value: StokDurumu; label: string }[] = [
  { value: "TUMU", label: "Tümü" },
  { value: "STOKTA", label: "Stokta Var" },
  { value: "KRITIK", label: "Kritik" },
  { value: "TUKENDI", label: "Tükendi" },
];

export default function SearchPanel({ filters, onChange }: Props) {
  function set<K extends keyof StockFilters>(key: K, value: StockFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="panel search-panel no-print">
      <h2>Depo Stok Takip — Arama ve Filtre</h2>
      <div className="filter-grid">
        <label>
          Lot No
          <input value={filters.lotNo} onChange={(e) => set("lotNo", e.target.value)} />
        </label>
        <label>
          Malzeme Kodu
          <input
            value={filters.malzemeKodu}
            onChange={(e) => set("malzemeKodu", e.target.value)}
          />
        </label>
        <label>
          Malzeme Adı
          <input value={filters.malzemeAdi} onChange={(e) => set("malzemeAdi", e.target.value)} />
        </label>
        <label>
          Firma
          <input value={filters.firma} onChange={(e) => set("firma", e.target.value)} />
        </label>
        <label>
          Giriş Tarihi (Başlangıç)
          <input
            type="text"
            placeholder="GG/AA/YYYY"
            value={formatDateTR(filters.girisBaslangic)}
            onChange={(e) => set("girisBaslangic", toIsoDate(e.target.value))}
          />
        </label>
        <label>
          Giriş Tarihi (Bitiş)
          <input
            type="text"
            placeholder="GG/AA/YYYY"
            value={formatDateTR(filters.girisBitis)}
            onChange={(e) => set("girisBitis", toIsoDate(e.target.value))}
          />
        </label>
        <label>
          Sertifika No
          <input
            value={filters.sertifikaNo}
            onChange={(e) => set("sertifikaNo", e.target.value)}
          />
        </label>
        <label>
          Depo Lokasyonu
          <input
            value={filters.depoLokasyonu}
            onChange={(e) => set("depoLokasyonu", e.target.value)}
            placeholder="örn. Raf A-3"
          />
        </label>
        <label>
          Stok Durumu
          <select
            value={filters.stokDurumu}
            onChange={(e) => set("stokDurumu", e.target.value as StokDurumu)}
          >
            {STOK_DURUMU_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
