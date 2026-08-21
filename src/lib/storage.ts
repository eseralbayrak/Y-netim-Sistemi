import { api } from "./api";
import type { Database, Receipt, Movement, StockLot, LabelSettings } from "../types";

// ---- Ana veritabanı (receipts / movements / lots) — hepsi sunucuda ----

export function loadDb(): Promise<Database> {
  return api.get<Database>("/db");
}

export function addReceipt(
  receipt: Omit<Receipt, "id" | "olusturmaTarihi">
): Promise<Receipt> {
  return api.post<Receipt>("/receipts", receipt);
}

export function updateReceipt(id: string, patch: Partial<Receipt>): Promise<Receipt> {
  return api.patch<Receipt>(`/receipts/${encodeURIComponent(id)}`, patch);
}

export function deleteReceipt(id: string): Promise<{ ok: boolean; id: string }> {
  return api.delete<{ ok: boolean; id: string }>(`/receipts/${encodeURIComponent(id)}`);
}

export function approveReceiptAndStock(receiptId: string): Promise<Database> {
  return api.post<Database>(`/receipts/${encodeURIComponent(receiptId)}/approve`);
}

export function rejectReceiptAndStock(
  receiptId: string,
  payload: { redNedeni: string; ambalajKontrol?: boolean; analizRaporuVar?: boolean; coa?: any }
): Promise<Database> {
  return api.post<Database>(`/receipts/${encodeURIComponent(receiptId)}/reject`, payload);
}

export function processRetCikis(payload: {
  lotNo: string;
  miktar: number;
  islemTuru: "TEDARIKCIYE_IADE" | "HURDA";
  aciklama?: string;
}): Promise<Database> {
  return api.post<Database>("/ret-bolgesi/cikis", payload);
}

export function markLabelPrinted(
  receiptId: string,
  ambalajMiktari?: number,
  etiketSayisi?: number
): Promise<Receipt> {
  return api.post<Receipt>(`/receipts/${encodeURIComponent(receiptId)}/label-printed`, {
    ambalajMiktari,
    etiketSayisi,
  });
}

export function consumeLot(
  lotNo: string,
  miktar: number,
  kullanici?: string
): Promise<{ db: Database; movement: Movement }> {
  return api.post<{ db: Database; movement: Movement }>("/consume", { lotNo, miktar, kullanici });
}

export function undoMovement(movementId: string): Promise<Database> {
  return api.post<Database>(`/undo/${encodeURIComponent(movementId)}`);
}

export function updateLotLocation(lotNo: string, depoLokasyonu: string): Promise<StockLot> {
  return api.patch<StockLot>(`/lots/${encodeURIComponent(lotNo)}/location`, { depoLokasyonu });
}

export function deleteLot(lotNo: string): Promise<{ ok: boolean; lotNo: string }> {
  return api.delete<{ ok: boolean; lotNo: string }>(`/lots/${encodeURIComponent(lotNo)}`);
}

export async function getStockLotsList(): Promise<StockLot[]> {
  const db = await loadDb();
  return Object.values(db.lots).sort((a, b) => b.girisTarihi.localeCompare(a.girisTarihi));
}

export async function findReceiptByLotNo(lotNo: string): Promise<Receipt | undefined> {
  const db = await loadDb();
  return db.receipts.find((r) => r.lotNo === lotNo);
}

export async function getMovementsForLot(lotNo: string): Promise<Movement[]> {
  const db = await loadDb();
  return db.movements
    .filter((m) => m.lotNo === lotNo)
    .sort((a, b) => a.tarih.localeCompare(b.tarih));
}

// ---- Etiket ayarları ----

export function loadLabelSettings(): Promise<LabelSettings> {
  return api.get<LabelSettings>("/label-settings");
}

export function saveLabelSettings(settings: LabelSettings): Promise<LabelSettings> {
  return api.put<LabelSettings>("/label-settings", settings);
}
