import type { AuxiliaryPart, Database, Receipt } from "../types";
import { api } from "./api";

// ---- Yardımcı Parçalar ----

export function loadAuxiliaryParts(): Promise<AuxiliaryPart[]> {
  return api.get<AuxiliaryPart[]>("/auxiliary-parts");
}

export async function findAuxiliaryPart(kod: string): Promise<AuxiliaryPart | undefined> {
  const list = await loadAuxiliaryParts();
  return list.find((p) => p.kod === kod);
}

export function addAuxiliaryPart(part: AuxiliaryPart): Promise<AuxiliaryPart[]> {
  return api.post<AuxiliaryPart[]>("/auxiliary-parts", part);
}

export function updateAuxiliaryPart(kod: string, patch: Partial<AuxiliaryPart>): Promise<AuxiliaryPart[]> {
  return api.patch<AuxiliaryPart[]>(`/auxiliary-parts/${encodeURIComponent(kod)}`, patch);
}

export function deleteAuxiliaryPart(kod: string): Promise<AuxiliaryPart[]> {
  return api.delete<AuxiliaryPart[]>(`/auxiliary-parts/${encodeURIComponent(kod)}`);
}

export async function nextAuxiliarySira(): Promise<number> {
  const list = await loadAuxiliaryParts();
  return list.reduce((max, p) => Math.max(max, p.sira || 0), 0) + 1;
}

// ---- Yardımcı Parça Tedarikçileri ----

export function loadAuxiliarySuppliers(): Promise<string[]> {
  return api.get<string[]>("/auxiliary-suppliers");
}

export function addAuxiliarySupplierIfNew(name: string): Promise<string[]> {
  return api.post<string[]>("/auxiliary-suppliers", { name });
}

export function saveAuxiliarySuppliers(suppliers: string[]): Promise<string[]> {
  return api.put<string[]>("/auxiliary-suppliers", suppliers);
}

export function deleteAuxiliarySupplier(name: string): Promise<string[]> {
  return api.delete<string[]>(`/auxiliary-suppliers/${encodeURIComponent(name)}`);
}

export function extractAuxiliarySuppliers(): Promise<string[]> {
  return api.post<string[]>("/auxiliary-suppliers/extract");
}

// ---- Yardımcı Parça Depo Stok Veritabanı ----

export function loadAuxiliaryDb(): Promise<Database> {
  return api.get<Database>("/auxiliary-db");
}

export function addAuxiliaryReceipt(receipt: Partial<Receipt>): Promise<Database> {
  return api.post<Database>("/auxiliary-db/receipts", receipt);
}

export function addAuxiliaryMovement(movement: {
  tip: "GIRIS" | "CIKIS";
  lotNo: string;
  malzemeKodu: string;
  firma?: string;
  miktar: number;
  aciklama?: string;
}): Promise<Database> {
  return api.post<Database>("/auxiliary-db/movements", movement);
}

export function updateAuxiliaryLotLocation(lotNo: string, depoLokasyonu: string): Promise<any> {
  return api.patch(`/auxiliary-db/lots/${encodeURIComponent(lotNo)}/location`, { depoLokasyonu });
}

export function generateAuxiliaryLotNo(existingLots: string[] = []): string {
  const year2Digits = new Date().getFullYear().toString().slice(-2); // örn: "26"
  const prefix = `YLP${year2Digits}/`;
  let maxSeq = 2265; // Varsayılan başlangıç 2265, ilk otomatik lot YLP26/2266 olur
  for (const lot of existingLots) {
    if (lot && lot.startsWith(prefix)) {
      const parts = lot.split("/");
      if (parts[1]) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
  }
  return `${prefix}${maxSeq + 1}`;
}
