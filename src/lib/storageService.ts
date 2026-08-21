import { api } from "./api";
import type { StoragePathsConfig, StorageScanResult } from "../types";

export interface ReconcileMatchItem {
  filename: string;
  kind: string;
  targetType: "material" | "auxiliaryPart" | "receipt";
  targetId: string;
  fieldName: "msds" | "tds" | "coa" | "finalKontrol" | "malzemeRaporu" | "kaplamaRaporu";
}

export async function getStoragePaths(): Promise<StoragePathsConfig> {
  return api.get<StoragePathsConfig>("/storage/paths");
}

export async function updateStoragePaths(paths: Partial<StoragePathsConfig>): Promise<StoragePathsConfig> {
  return api.put<StoragePathsConfig>("/storage/paths", paths);
}

export async function createStorageDirectory(dirPath: string): Promise<{ success: boolean; created: boolean; path: string }> {
  return api.post<{ success: boolean; created: boolean; path: string }>("/storage/create-directory", { dirPath });
}

export async function scanStorageDirectory(kind: string = "all", customPath?: string): Promise<StorageScanResult> {
  return api.post<StorageScanResult>("/storage/scan", { kind, customPath });
}

export async function reconcileStorageFiles(matches: ReconcileMatchItem[]): Promise<{ success: boolean; attachedCount: number }> {
  return api.post<{ success: boolean; attachedCount: number }>("/storage/reconcile", { matches });
}
