import { api } from "./api";
import type { SemiFinishedPart } from "../types";

export interface SemiFinishedDb {
  movements: Array<{
    id: string;
    tip: "GIRIS" | "CIKIS";
    kod: string;
    miktar: number;
    tarih: string;
    aciklama?: string;
  }>;
}

export function loadSemiFinishedParts(): Promise<SemiFinishedPart[]> {
  return api.get<SemiFinishedPart[]>("/semi-finished-parts");
}

export function saveSemiFinishedPart(part: SemiFinishedPart): Promise<SemiFinishedPart[]> {
  return api.post<SemiFinishedPart[]>("/semi-finished-parts", part);
}

export function updateSemiFinishedPart(kod: string, part: Partial<SemiFinishedPart>): Promise<SemiFinishedPart[]> {
  return api.patch<SemiFinishedPart[]>(`/semi-finished-parts/${encodeURIComponent(kod)}`, part);
}

export function deleteSemiFinishedPart(kod: string): Promise<SemiFinishedPart[]> {
  return api.delete<SemiFinishedPart[]>(`/semi-finished-parts/${encodeURIComponent(kod)}`);
}

export function updateSemiFinishedLocation(kod: string, depoKodu: string): Promise<SemiFinishedPart[]> {
  return api.patch<SemiFinishedPart[]>(`/semi-finished-parts/${encodeURIComponent(kod)}/location`, { depoKodu });
}

export function loadSemiFinishedDb(): Promise<SemiFinishedDb> {
  return api.get<SemiFinishedDb>("/semi-finished-db");
}

export function addSemiFinishedMovement(
  tip: "GIRIS" | "CIKIS",
  kod: string,
  miktar: number,
  aciklama?: string
): Promise<{ ok: boolean; message?: string }> {
  return api.post("/semi-finished-db/movements", { tip, kod, miktar, aciklama });
}
