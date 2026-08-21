import { api } from "./api";
import type { FinishedGood } from "../types";

export interface FinishedGoodsDb {
  movements: Array<{
    id: string;
    tip: "GIRIS" | "CIKIS";
    kod: string;
    miktar: number;
    tarih: string;
    aciklama?: string;
  }>;
}

export function loadFinishedGoods(): Promise<FinishedGood[]> {
  return api.get<FinishedGood[]>("/finished-goods");
}

export function saveFinishedGood(good: FinishedGood): Promise<FinishedGood[]> {
  return api.post<FinishedGood[]>("/finished-goods", good);
}

export function updateFinishedGood(kod: string, good: Partial<FinishedGood>): Promise<FinishedGood[]> {
  return api.patch<FinishedGood[]>(`/finished-goods/${encodeURIComponent(kod)}`, good);
}

export function deleteFinishedGood(kod: string): Promise<FinishedGood[]> {
  return api.delete<FinishedGood[]>(`/finished-goods/${encodeURIComponent(kod)}`);
}

export function updateFinishedGoodLocation(kod: string, depoKodu: string): Promise<FinishedGood[]> {
  return api.patch<FinishedGood[]>(`/finished-goods/${encodeURIComponent(kod)}/location`, { depoKodu });
}

export function loadFinishedGoodsDb(): Promise<FinishedGoodsDb> {
  return api.get<FinishedGoodsDb>("/finished-goods-db");
}

export function addFinishedGoodMovement(
  tip: "GIRIS" | "CIKIS",
  kod: string,
  miktar: number,
  aciklama?: string
): Promise<{ ok: boolean; message?: string }> {
  return api.post("/finished-goods-db/movements", { tip, kod, miktar, aciklama });
}
