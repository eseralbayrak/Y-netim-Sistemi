import { api } from "./api";

// Veri artık paylaşımlı sunucuda (ağdaki Data klasörü) kalıcı olarak tutuluyor,
// bu yüzden ayrı bir "klasöre yaz" mekanizmasına gerek kalmadı — sunucu zaten
// gerçek dosyaları (PDF'ler + JSON) o klasöre yazıyor. Bu modül sadece taşınabilir
// tek dosyalık bir yedek indirme/geri yükleme sağlar (örn. sunucu değişikliği,
// ekstra güvenlik kopyası için).

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export async function downloadJsonBackup() {
  const payload = await api.get<Record<string, unknown>>("/backup");
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gkys-yedek-${timestamp()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function restoreFromFile(file: File): Promise<void> {
  const text = await file.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("Dosya okunamadı — geçerli bir yedek JSON dosyası değil.");
  }
  await api.post<unknown>("/restore", payload);
}
