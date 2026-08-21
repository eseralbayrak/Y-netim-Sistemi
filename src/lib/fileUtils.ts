import { api } from "./api";

export const MAX_DOC_SIZE_BYTES = 5 * 1024 * 1024; // 5MB — sunucu tarafı da bu sınırı uygular

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function validatePdf(file: File): string | null {
  if (file.type !== "application/pdf") {
    return "Sadece PDF dosyası yükleyebilirsin.";
  }
  if (file.size > MAX_DOC_SIZE_BYTES) {
    return "Dosya çok büyük (5MB üstü).";
  }
  return null;
}

// Bir belgeyi sunucuya yükler (CoA / TDS / MSDS) — dosyayı base64'e çevirip
// /api/documents/:kind/:key uç noktasına gönderir, sunucu gerçek PDF olarak diske yazar.
export async function uploadDocument(
  kind: "coa" | "tds" | "msds",
  key: string,
  file: File
): Promise<{ name: string; url: string; uploadedAt: string }> {
  const dataUrl = await readFileAsDataUrl(file);
  return api.post<{ name: string; url: string; uploadedAt: string }>(`/documents/${kind}/${encodeURIComponent(key)}`, {
    dataUrl,
    name: file.name,
  });
}

// Parti / Lot bazlı belgeleri (Final Kontrol, Malzeme Raporu, Kaplama Raporu, CoA) sunucuya yükler
export async function uploadReceiptDocument(
  docKind: "coa" | "finalKontrol" | "malzemeRaporu" | "kaplamaRaporu",
  receiptId: string,
  file: File
): Promise<{ name: string; url: string; uploadedAt: string }> {
  const dataUrl = await readFileAsDataUrl(file);
  return api.post<{ name: string; url: string; uploadedAt: string }>(`/documents/receipt/${docKind}/${encodeURIComponent(receiptId)}`, {
    dataUrl,
    name: file.name,
  });
}
