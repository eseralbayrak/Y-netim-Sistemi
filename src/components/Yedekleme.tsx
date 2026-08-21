import { useRef, useState } from "react";
import { downloadJsonBackup, restoreFromFile } from "../lib/backup";

export default function Yedekleme() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleBackupNow() {
    setBusy(true);
    setMessage(null);
    try {
      await downloadJsonBackup();
      setMessage({ type: "ok", text: "Yedek dosyası indirildi." });
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "Yedekleme başarısız oldu." });
    } finally {
      setBusy(false);
    }
  }

  async function handleRestoreFile(file: File | null) {
    if (!file) return;
    setMessage(null);
    if (
      !window.confirm(
        "Bu yedek dosyasını geri yüklersen, sunucudaki MEVCUT tüm veri (giriş fişleri, lotlar, malzemeler) yedekteki veriyle DEĞİŞTİRİLECEK. Bu, ağdaki TÜM kullanıcıları etkiler. Devam edilsin mi?"
      )
    )
      return;
    setBusy(true);
    try {
      await restoreFromFile(file);
      setMessage({ type: "ok", text: "Geri yükleme tamamlandı. Sayfa yenileniyor..." });
      setTimeout(() => window.location.reload(), 1200);
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "Geri yükleme başarısız oldu." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2>Yedekleme ve Geri Yükleme</h2>
      <p className="muted">
        Tüm veri (giriş fişleri, lotlar, malzemeler ve yüklenen PDF'ler) artık paylaşımlı sunucuda,
        ağdaki Data klasöründe gerçek dosyalar olarak tutuluyor. Bilgisayar veya tarayıcı değiştirseniz
        bile veri kaybolmaz; her zaman aynı sunucudan gelir.
      </p>
      <p className="muted">
        Aşağıdaki "Tam Yedek İndir" seçeneği, ekstra bir güvenlik kopyasıdır. Bu, sunucu değişikliği veya
        felaket kurtarma için tüm veritabanının anlık görüntüsünü tek bir .json dosyasına alır.
      </p>

      <div className="actions-row">
        <button className="btn-primary" disabled={busy} onClick={handleBackupNow}>
          {busy ? "İşleniyor..." : "Tam Yedek İndir (.json)"}
        </button>
        <button
          className="btn-secondary"
          style={{ marginLeft: 8 }}
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          Yedekten Geri Yükle
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={(e) => handleRestoreFile(e.target.files?.[0] || null)}
        />
      </div>

      {message && (
        <p className={message.type === "ok" ? "success-text" : "error"}>{message.text}</p>
      )}
    </div>
  );
}
