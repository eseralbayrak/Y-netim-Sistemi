import type { Material, Receipt, StockLot } from "../../types";

export const CRITICAL_THRESHOLD_KG = 50;

export type StokDurumu = "TUMU" | "STOKTA" | "KRITIK" | "TUKENDI";

export interface StockFilters {
  lotNo: string;
  malzemeKodu: string;
  malzemeAdi: string;
  firma: string;
  girisBaslangic: string;
  girisBitis: string;
  sertifikaNo: string;
  depoLokasyonu: string;
  stokDurumu: StokDurumu;
}

export const emptyFilters: StockFilters = {
  lotNo: "",
  malzemeKodu: "",
  malzemeAdi: "",
  firma: "",
  girisBaslangic: "",
  girisBitis: "",
  sertifikaNo: "",
  depoLokasyonu: "",
  stokDurumu: "TUMU",
};

export interface LotRow {
  lotNo: string;
  malzemeKodu: string;
  malzemeAdi: string;
  firma: string;
  girisTarihi: string;
  ilkGirisMiktari: number;
  kullanilanMiktar: number;
  kalanMiktar: number;
  depoLokasyonu: string;
  sertifikaNo: string;
  durum: "NORMAL" | "KRITIK" | "TUKENDI";
}

export function getDurum(kalanMiktar: number): LotRow["durum"] {
  if (kalanMiktar <= 0) return "TUKENDI";
  if (kalanMiktar < CRITICAL_THRESHOLD_KG) return "KRITIK";
  return "NORMAL";
}

export function buildLotRows(
  lots: StockLot[],
  materials: Material[],
  receipts: Receipt[]
): LotRow[] {
  const materialByKod = new Map(materials.map((m) => [m.kod, m]));
  const receiptByLot = new Map(receipts.map((r) => [r.lotNo, r]));

  return lots.map((lot) => {
    const material = materialByKod.get(lot.malzemeKodu);
    const receipt = receiptByLot.get(lot.lotNo);
    const kalanMiktar = lot.kalanMiktar ?? 0;
    const ilkGirisMiktari = lot.ilkGirisMiktari ?? kalanMiktar;
    return {
      lotNo: lot.lotNo,
      malzemeKodu: lot.malzemeKodu,
      malzemeAdi: material?.cins || lot.malzemeKodu,
      firma: lot.firma,
      girisTarihi: lot.girisTarihi,
      ilkGirisMiktari,
      kullanilanMiktar: Math.max(0, ilkGirisMiktari - kalanMiktar),
      kalanMiktar,
      depoLokasyonu: lot.depoLokasyonu || "—",
      sertifikaNo: receipt?.sertifikaNo || "—",
      durum: getDurum(kalanMiktar),
    };
  });
}

export function applyFilters(rows: LotRow[], f: StockFilters): LotRow[] {
  return rows.filter((r) => {
    if (f.lotNo && !r.lotNo.toLowerCase().includes(f.lotNo.toLowerCase())) return false;
    if (f.malzemeKodu && !r.malzemeKodu.toLowerCase().includes(f.malzemeKodu.toLowerCase()))
      return false;
    if (f.malzemeAdi && !r.malzemeAdi.toLowerCase().includes(f.malzemeAdi.toLowerCase()))
      return false;
    if (f.firma && !r.firma.toLowerCase().includes(f.firma.toLowerCase())) return false;
    if (f.sertifikaNo && !r.sertifikaNo.toLowerCase().includes(f.sertifikaNo.toLowerCase()))
      return false;
    if (f.depoLokasyonu && !r.depoLokasyonu.toLowerCase().includes(f.depoLokasyonu.toLowerCase()))
      return false;
    if (f.girisBaslangic && r.girisTarihi < f.girisBaslangic) return false;
    if (f.girisBitis && r.girisTarihi > f.girisBitis) return false;

    if (f.stokDurumu === "STOKTA" && r.kalanMiktar <= 0) return false;
    if (f.stokDurumu === "KRITIK" && r.durum !== "KRITIK") return false;
    if (f.stokDurumu === "TUKENDI" && r.durum !== "TUKENDI") return false;

    return true;
  });
}

export function formatKg(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return "0";
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
