import type { Material } from "../types";
import { api } from "./api";

// ---- Malzemeler ----

export function loadMaterials(): Promise<Material[]> {
  return api.get<Material[]>("/materials");
}

export async function findMaterial(kod: string): Promise<Material | undefined> {
  const list = await loadMaterials();
  return list.find((m) => m.kod === kod);
}

export function addMaterial(material: Material): Promise<Material[]> {
  return api.post<Material[]>("/materials", material);
}

export function updateMaterial(kod: string, patch: Partial<Material>): Promise<Material[]> {
  return api.patch<Material[]>(`/materials/${encodeURIComponent(kod)}`, patch);
}

export function deleteMaterial(kod: string): Promise<Material[]> {
  return api.delete<Material[]>(`/materials/${encodeURIComponent(kod)}`);
}

export async function nextSira(): Promise<number> {
  const list = await loadMaterials();
  return list.reduce((max, m) => Math.max(max, m.sira || 0), 0) + 1;
}

// ---- Firmalar ----

export function loadSuppliers(): Promise<string[]> {
  return api.get<string[]>("/suppliers");
}

export function addSupplierIfNew(name: string): Promise<string[]> {
  return api.post<string[]>("/suppliers", { name });
}
