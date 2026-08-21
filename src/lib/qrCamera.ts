// Telefon kamerasıyla QR okutma için saf (React'tan bağımsız) yardımcı
// fonksiyonlar. Hiçbir state tutmaz, sadece kontrol/karar mantığı içerir —
// bu sayede ayrı test edilebilir ve CikisBarkod.tsx'i sade tutar.

import type { CameraDevice } from "html5-qrcode";

/**
 * Kamera erişiminin çalışabilmesi için tarayıcının "güvenli bağlam" (secure
 * context) içinde olması gerekir. `window.isSecureContext`, https:// ve
 * localhost/127.0.0.1 gibi tarayıcı tarafından zaten güvenli sayılan
 * origin'leri doğru şekilde değerlendirir — burada ayrıca elle bir
 * localhost kontrolü yapmaya gerek yoktur, tekrar icat etmek yerine
 * tarayıcının kendi değerlendirmesine güveniyoruz.
 */
export function isSecureCameraContext(): boolean {
  return typeof window !== "undefined" && window.isSecureContext === true;
}

/** Tarayıcı, kamera erişimi için gerekli temel Web API'lerini destekliyor mu? */
export function isMediaDevicesSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices !== "undefined" &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

/**
 * Kamera listesinden arka kamerayı bulmaya çalışır (etikette "back", "rear"
 * veya "environment" geçen ilk kamera). Bulunamazsa listedeki ilk kamerayı
 * döndürür. Liste boşsa null döner.
 */
export function pickBackCamera(cameras: CameraDevice[]): CameraDevice | null {
  if (cameras.length === 0) return null;

  const backCamera = cameras.find((cam) => {
    const label = cam.label.toLowerCase();
    return label.includes("back") || label.includes("rear") || label.includes("environment");
  });

  return backCamera ?? cameras[0];
}

/**
 * Tarayıcı/kamera API'lerinden gelen hataları, operatörün ne yapması
 * gerektiğini anlayacağı Türkçe mesajlara çevirir. Ham `err.message`
 * teknik ve İngilizce olduğu için doğrudan kullanıcıya gösterilmez.
 */
export function mapCameraError(err: unknown): string {
  const name = getErrorName(err);

  switch (name) {
    case "NotAllowedError":
      return "Kamera izni reddedildi. Tarayıcı ayarlarından bu site için kamera iznini açıp tekrar deneyin.";
    case "NotFoundError":
      return "Cihazda kullanılabilir bir kamera bulunamadı.";
    case "NotReadableError":
      return "Kameraya erişilemiyor — başka bir uygulama kamerayı kullanıyor olabilir. Diğer kamera uygulamalarını kapatıp tekrar deneyin.";
    case "OverconstrainedError":
      return "İstenen kamera ayarları bu cihazda desteklenmiyor. Farklı bir kamera seçilmeye çalışılacak.";
    case "AbortError":
      return "Kamera başlatma işlemi yarıda kesildi. Lütfen tekrar deneyin.";
    case "SecurityError":
      return "Kamera erişimi güvenlik nedeniyle engellendi. Sayfaya HTTPS veya localhost üzerinden erişildiğinden emin olun.";
    case "TypeError":
      return "Kamera başlatılırken bir yapılandırma hatası oluştu.";
    default:
      return "Kamera açılamadı. Bilinmeyen bir hata oluştu, lütfen tekrar deneyin.";
  }
}

function getErrorName(err: unknown): string | undefined {
  if (err instanceof DOMException) return err.name;
  if (typeof err === "object" && err !== null && "name" in err) {
    const value = (err as { name: unknown }).name;
    if (typeof value === "string") return value;
  }
  return undefined;
}
