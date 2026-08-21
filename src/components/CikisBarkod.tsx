import { useCallback, useEffect, useRef, useState } from "react";
import { consumeLot, findReceiptByLotNo, undoMovement } from "../lib/storage";
import { findMaterial } from "../lib/materialsStorage";
import { useQrCameraScanner } from "../hooks/useQrCameraScanner";
import { playBarcodeBeep, playErrorBuzz } from "../utils/scannerAudio";
import { normalizeBarcodeToken } from "../utils/barcode";
import type { StockLot } from "../types";
import { IATFFormFooter } from "./IATFFormFooter";

interface Props {
  lots: StockLot[];
  onChanged: () => void;
}

interface ScanHistoryItem {
  id: string;
  movementId: string;
  malzemeKodu: string;
  firma: string;
  lotNo: string;
  miktar: number;
  kalanSonrasi: number;
  tarih: string;
  kullanici?: string;
  undone: boolean;
}

const BARCODE_CAMERA_REGION_ID = "barcode-camera-region";

export default function CikisBarkod({ lots, onChanged }: Props) {
  const [scanValue, setScanValue] = useState("");
  const [kullanici, setKullanici] = useState("");
  const [autoDeductStandard, setAutoDeductStandard] = useState(true);
  const [keepFocus, setKeepFocus] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Manual fallback state when material doesn't have standard package
  const [manualLot, setManualLot] = useState<StockLot | null>(null);
  const [manualMiktar, setManualMiktar] = useState("");

  // Scan session history
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [lastScanResult, setLastScanResult] = useState<ScanHistoryItem | null>(null);

  const [message, setMessage] = useState<{ type: "ok" | "error" | "info"; text: string } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isFocused, setIsFocused] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);

  // Keep focus on input for handheld barcode guns
  useEffect(() => {
    if (!keepFocus) return;

    const interval = setInterval(() => {
      if (document.activeElement !== inputRef.current && !manualLot && !cameraOpen) {
        inputRef.current?.focus();
      }
    }, 1500);

    inputRef.current?.focus();
    return () => clearInterval(interval);
  }, [keepFocus, manualLot, cameraOpen]);

  // Global keydown listener for high-speed USB/Bluetooth barcode guns
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // If user presses Enter or scans while not in a form input, focus scan box
      if (
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        !manualLot &&
        !cameraOpen
      ) {
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [manualLot, cameraOpen]);

  const handleScan = useCallback(
    async (raw: string) => {
      const cleanRaw = String(raw || "").trim();
      if (!cleanRaw) return;

      // GK4 formatı: LOT/SIPARIS. GK3 eski etiketlerle geriye dönük desteklenir.
      const slashParts = cleanRaw.split("/").map((part) => part.trim());
      const pipeParts = cleanRaw.split("|").map((part) => part.trim());
      const isSlashStructured = slashParts[0].toUpperCase() === "GK3" || slashParts[0].toUpperCase() === "GK4";
      const isPipeStructured = pipeParts[0].toUpperCase() === "GK1" || pipeParts[0].toUpperCase() === "GK2";
      const isStructured = isSlashStructured || isPipeStructured;
      const structuredParts = isSlashStructured ? slashParts : pipeParts;
      const lotNo = (isStructured ? structuredParts[1] : cleanRaw.split("|")[0]).trim();
      const isOrderOnlyBarcode = isSlashStructured && slashParts[0].toUpperCase() === "GK4";
      const irsaliyeNo = isOrderOnlyBarcode ? "-" : (isSlashStructured ? structuredParts[2] || "-" : (isPipeStructured ? pipeParts[2] || "-" : "-"));
      const siparisNo = isOrderOnlyBarcode ? structuredParts[2] || "-" : (isSlashStructured ? structuredParts[3] || "-" : (isPipeStructured ? pipeParts[3] || "-" : "-"));
      const lot = lots.find(
        (l) => l.lotNo.toLowerCase() === lotNo.toLowerCase() || l.lotNo.trim() === lotNo
      );

      setManualLot(null);

      if (!lot) {
        if (soundEnabled) playErrorBuzz();
        setMessage({
          type: "error",
          text: `Barkod / Lot bulunamadı: "${lotNo}". Lütfen barkodun sisteme kayıtlı olduğunu kontrol edin.`,
        });
        return;
      }

      if (isStructured) {
        const receipt = await findReceiptByLotNo(lot.lotNo);
        const receiptIrsaliye = receipt?.irsaliyeNo?.trim();
        const receiptSiparis = receipt?.siparisNo?.trim();
        const normalizedReceiptIrsaliye = normalizeBarcodeToken(receiptIrsaliye);
        const normalizedReceiptSiparis = normalizeBarcodeToken(receiptSiparis);
        const normalizedScannedIrsaliye = normalizeBarcodeToken(irsaliyeNo);
        const normalizedScannedSiparis = normalizeBarcodeToken(siparisNo);

        const irsaliyeMismatch = receiptIrsaliye && irsaliyeNo !== "-" && normalizedReceiptIrsaliye.toLowerCase() !== normalizedScannedIrsaliye.toLowerCase();
        const siparisMismatch = receiptSiparis && siparisNo !== "-" && normalizedReceiptSiparis.toLowerCase() !== normalizedScannedSiparis.toLowerCase();

        if (irsaliyeMismatch || siparisMismatch) {
          if (soundEnabled) playErrorBuzz();
          setMessage({
            type: "error",
            text: `Barkod bilgileri lot kaydıyla eşleşmiyor. İrsaliye: ${irsaliyeNo}, Sipariş: ${siparisNo}`,
          });
          return;
        }
      }

      if (lot.kalanMiktar <= 0) {
        if (soundEnabled) playErrorBuzz();
        setMessage({
          type: "error",
          text: `Stok Yetersiz: ${lot.malzemeKodu} (Lot: ${lot.lotNo}) tükendi (0 KG).`,
        });
        return;
      }

      setBusy(true);
      try {
        const material = await findMaterial(lot.malzemeKodu);
        const standart = material?.ambalajMiktariStandart;

        // Otomatik standart ambalaj düşümü veya manuel onay
        if (autoDeductStandard && standart && standart > 0) {
          const miktar = Math.min(standart, lot.kalanMiktar);
          const { movement } = await consumeLot(lot.lotNo, miktar, kullanici || undefined);

          if (soundEnabled) playBarcodeBeep();

          const resultItem: ScanHistoryItem = {
            id: String(Date.now()),
            movementId: movement.id,
            malzemeKodu: lot.malzemeKodu,
            firma: lot.firma,
            lotNo: lot.lotNo,
            miktar,
            kalanSonrasi: Math.max(0, Math.round((lot.kalanMiktar - miktar) * 100) / 100),
            tarih: new Date().toLocaleTimeString("tr-TR"),
            kullanici: kullanici || "Depo Görevlisi",
            undone: false,
          };

          setLastScanResult(resultItem);
          setScanHistory((prev) => [resultItem, ...prev.slice(0, 49)]);
          setMessage({
            type: "ok",
            text: `✓ BARKOD OKUNDU: ${lot.malzemeKodu} (Lot: ${lot.lotNo}) — ${miktar} KG stoktan düşüldü. İrsaliye: ${irsaliyeNo}, Sipariş: ${siparisNo}`,
          });
          onChanged();
        } else {
          // Standart ambalaj tanımlı değilse veya otomatik mod kapalıysa miktar sor
          if (soundEnabled) playBarcodeBeep();
          setManualLot(lot);
          setManualMiktar(standart ? String(standart) : String(lot.kalanMiktar));
          setMessage({
            type: "info",
            text: `Barkod algılandı (${lot.malzemeKodu}). Çıkış miktarını onaylayın.`,
          });
        }
      } catch (err: any) {
        if (soundEnabled) playErrorBuzz();
        setMessage({ type: "error", text: err.message || "Barkod işlenirken hata oluştu." });
      } finally {
        setBusy(false);
        setScanValue("");
        inputRef.current?.focus();
      }
    },
    [autoDeductStandard, kullanici, lots, onChanged, soundEnabled]
  );

  const {
    status: cameraStatus,
    errorMessage: cameraErrorMessage,
    start: startCamera,
    stop: stopCamera,
    retry: retryCamera,
    scanFile,
  } = useQrCameraScanner((decodedText) => {
    handleScan(decodedText);
    setCameraOpen(false);
  });

  const [fileScanning, setFileScanning] = useState(false);

  const toggleCamera = () => {
    if (cameraOpen) {
      stopCamera();
      setCameraOpen(false);
    } else {
      setCameraOpen(true);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileScanning(true);
    try {
      const decoded = await scanFile(file);
      if (decoded) {
        setMessage({ type: "ok", text: "Barkod görselden başarıyla okundu." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Görselden barkod okunamadı." });
    } finally {
      setFileScanning(false);
      e.target.value = "";
    }
  };

  useEffect(() => {
    if (cameraOpen) {
      startCamera(BARCODE_CAMERA_REGION_ID);
    } else {
      stopCamera();
    }
  }, [cameraOpen, startCamera, stopCamera]);

  function handleScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scanValue.trim()) return;
    handleScan(scanValue);
  }

  async function handleConfirmManual() {
    if (!manualLot) return;
    const m = parseFloat(manualMiktar.replace(",", "."));
    if (isNaN(m) || m <= 0) {
      setMessage({ type: "error", text: "Geçerli bir çıkış miktarı (KG) girin." });
      return;
    }
    if (m > manualLot.kalanMiktar) {
      setMessage({
        type: "error",
        text: `Girilen miktar (${m} KG) depodaki mevcut stoktan (${manualLot.kalanMiktar} KG) fazla olamaz.`,
      });
      return;
    }

    setBusy(true);
    try {
      const { movement } = await consumeLot(manualLot.lotNo, m, kullanici || undefined);
      if (soundEnabled) playBarcodeBeep();

      const resultItem: ScanHistoryItem = {
        id: String(Date.now()),
        movementId: movement.id,
        malzemeKodu: manualLot.malzemeKodu,
        firma: manualLot.firma,
        lotNo: manualLot.lotNo,
        miktar: m,
        kalanSonrasi: Math.max(0, Math.round((manualLot.kalanMiktar - m) * 100) / 100),
        tarih: new Date().toLocaleTimeString("tr-TR"),
        kullanici: kullanici || "Depo Görevlisi",
        undone: false,
      };

      setLastScanResult(resultItem);
      setScanHistory((prev) => [resultItem, ...prev.slice(0, 49)]);
      setMessage({
        type: "ok",
        text: `✓ ${m} KG düşüldü. Lot: ${manualLot.lotNo} (${manualLot.malzemeKodu})`,
      });
      setManualLot(null);
      setManualMiktar("");
      onChanged();
      inputRef.current?.focus();
    } catch (err: any) {
      if (soundEnabled) playErrorBuzz();
      setMessage({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleUndoItem(item: ScanHistoryItem) {
    try {
      await undoMovement(item.movementId);
      setScanHistory((prev) =>
        prev.map((h) => (h.movementId === item.movementId ? { ...h, undone: true } : h))
      );
      if (lastScanResult?.movementId === item.movementId) {
        setLastScanResult({ ...lastScanResult, undone: true });
      }
      setMessage({
        type: "info",
        text: `↩ Çıkış işlemi geri alındı: ${item.malzemeKodu} (Lot: ${item.lotNo}, ${item.miktar} KG iade edildi).`,
      });
      onChanged();
    } catch (err: any) {
      setMessage({ type: "error", text: "Geri alma başarısız: " + err.message });
    }
  }

  // Active available stock lots for quick-test simulation chips
  const activeStockLots = lots.filter((l) => l.kalanMiktar > 0).slice(0, 6);

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span>📦</span> 4. Depo Çıkışı — El Barkod Okutucu
          </h2>
          <p className="muted" style={{ margin: "4px 0 0 0", fontSize: "0.9rem" }}>
            USB / Bluetooth El Barkod Okuyucu (Barkod Tabancası) ile barkodu okutun. Stoktan otomatik düşüm yapılır.
          </p>
        </div>

        {/* Live scanner status indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: "9999px",
              fontSize: "0.85rem",
              fontWeight: 600,
              background: isFocused ? "#10b98120" : "#f59e0b20",
              color: isFocused ? "#10b981" : "#f59e0b",
              border: `1px solid ${isFocused ? "#10b98140" : "#f59e0b40"}`,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: isFocused ? "#10b981" : "#f59e0b",
                boxShadow: isFocused ? "0 0 8px #10b981" : "none",
                display: "inline-block",
              }}
            />
            {isFocused ? "El Barkod Okuyucu Aktif (Dinliyor)" : "Okuyucu Beklemede"}
          </span>

          <button
            type="button"
            className="btn-secondary btn-small"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title="Bip Sesi Aç/Kapat"
            style={{ padding: "6px 10px", fontSize: "0.85rem" }}
          >
            {soundEnabled ? "🔊 Ses Açık" : "🔇 Sessiz"}
          </button>
        </div>
      </div>

      {/* Operator and Scanner Mode Settings */}
      <div className="card" style={{ marginBottom: 16, background: "var(--card-bg, #1e293b)", padding: 14 }}>
        <div className="grid2" style={{ gap: 12 }}>
          <label style={{ margin: 0 }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Çıkış Yapan / Malzemeci (Opsiyonel):</span>
            <input
              value={kullanici}
              onChange={(e) => setKullanici(e.target.value)}
              placeholder="örn. Ahmet Usta / Vardiya-1"
              style={{ marginTop: 4 }}
            />
          </label>

          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.88rem", margin: 0 }}>
              <input
                type="checkbox"
                checked={autoDeductStandard}
                onChange={(e) => setAutoDeductStandard(e.target.checked)}
              />
              <strong>Otomatik Düşüm:</strong> Standart ambalaj miktarı (örn. 25 KG) kadar anında düş
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.88rem", margin: 0 }}>
              <input
                type="checkbox"
                checked={keepFocus}
                onChange={(e) => setKeepFocus(e.target.checked)}
              />
              <strong>Sürekli Odak:</strong> Barkod tabancası için giriş alanını daima odakta tut
            </label>
          </div>
        </div>
      </div>

      {/* Main Barcode Scanner Input Box */}
      <div
        style={{
          border: isFocused ? "2px solid #3b82f6" : "2px solid var(--panel-border, #334155)",
          borderRadius: 8,
          padding: 16,
          background: isFocused ? "rgba(59, 130, 246, 0.04)" : "transparent",
          marginBottom: 16,
          transition: "all 0.2s ease",
        }}
        onClick={() => inputRef.current?.focus()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <label htmlFor="barcode-gun-input" style={{ fontWeight: 700, fontSize: "1rem", color: "var(--accent, #60a5fa)", margin: 0 }}>
            🏷️ El Barkod Okuyucu Girişi (Code 128 / Barkod Tabancası):
          </label>
          <span className="muted" style={{ fontSize: "0.8rem" }}>
            Okutulduğunda otomatik Enter yapılır
          </span>
        </div>

        <form onSubmit={handleScanSubmit} style={{ display: "flex", gap: 8 }}>
          <input
            id="barcode-gun-input"
            ref={inputRef}
            autoFocus
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Barkod tabancası ile etiketi okutun veya Lot No yazıp Enter'a basın..."
            className="scan-input"
            style={{
              fontSize: "1.15rem",
              padding: "14px 16px",
              fontFamily: "monospace",
              letterSpacing: "1px",
              fontWeight: 600,
            }}
            disabled={busy}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={busy || !scanValue.trim()}
            style={{ padding: "0 24px", fontSize: "1rem", whiteSpace: "nowrap" }}
          >
            {busy ? "İşleniyor..." : "Barkod Oku ↵"}
          </button>
        </form>

        {/* Quick Test Chips for Existing Stock Lots */}
        {activeStockLots.length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed var(--panel-border, #334155)" }}>
            <span className="muted" style={{ fontSize: "0.8rem", display: "block", marginBottom: 6 }}>
              💡 <strong>Hızlı Test:</strong> Barkod tabancası olmadan stoktaki barkodları simüle etmek için tıklayın:
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {activeStockLots.map((l) => (
                <button
                  key={l.lotNo}
                  type="button"
                  className="btn-secondary btn-small"
                  onClick={() => handleScan(l.lotNo)}
                  disabled={busy}
                  style={{
                    fontSize: "0.8rem",
                    padding: "4px 8px",
                    fontFamily: "monospace",
                    background: "#1e293b",
                  }}
                  title={`${l.firma} - ${l.malzemeKodu} (${l.kalanMiktar} KG)`}
                >
                  🏷️ {l.lotNo} ({l.kalanMiktar} KG)
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Camera / Image Upload Alternate Modes */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button
          type="button"
          className="btn-secondary"
          onClick={toggleCamera}
          style={{ fontSize: "0.9rem" }}
        >
          {cameraOpen ? "✖ Kamerayı Kapat" : "📷 Kamera ile Barkod Tara"}
        </button>

        <label
          className="btn-secondary"
          style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", fontSize: "0.9rem" }}
        >
          {fileScanning ? "⏳ Görsel Okunuyor..." : "📁 Fotoğraftan Barkod Oku"}
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileUpload}
            disabled={fileScanning}
          />
        </label>
      </div>

      {cameraOpen && (
        <div className="card" style={{ marginBottom: 16, background: "var(--card-bg, #1e293b)" }}>
          {cameraStatus === "starting" && (
            <p className="muted" style={{ padding: "12px 0" }}>⏳ Kamera başlatılıyor...</p>
          )}
          {cameraErrorMessage && (
            <div style={{ marginBottom: 12 }}>
              <p className="error" style={{ marginBottom: 8 }}>{cameraErrorMessage}</p>
              <button
                type="button"
                className="btn-small btn-secondary"
                onClick={() => retryCamera(BARCODE_CAMERA_REGION_ID)}
              >
                🔄 Kamerayı Yeniden Dene
              </button>
            </div>
          )}
          <div id={BARCODE_CAMERA_REGION_ID} className="qr-camera-region" style={{ minHeight: 240 }} />
          <p className="muted" style={{ marginTop: 8, fontSize: "0.85rem", textAlign: "center" }}>
            Barkodu veya QR etiketi kamera çerçevesinin içine getirin, otomatik taranacaktır.
          </p>
        </div>
      )}

      {/* Hidden container for file-based decoding */}
      <div id="qr-file-temp-region" style={{ display: "none" }} />

      {/* Status Messages */}
      {message && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 6,
            marginBottom: 16,
            fontWeight: 600,
            fontSize: "0.92rem",
            background:
              message.type === "ok"
                ? "#10b98120"
                : message.type === "info"
                ? "#3b82f620"
                : "#ef444420",
            color:
              message.type === "ok"
                ? "#10b981"
                : message.type === "info"
                ? "#60a5fa"
                : "#f87171",
            border: `1px solid ${
              message.type === "ok"
                ? "#10b98150"
                : message.type === "info"
                ? "#3b82f650"
                : "#ef444450"
            }`,
          }}
        >
          {message.text}
        </div>
      )}

      {/* Last Scanned Item Banner */}
      {lastScanResult && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            borderLeft: `4px solid ${lastScanResult.undone ? "#64748b" : "#10b981"}`,
            background: lastScanResult.undone ? "rgba(100, 116, 139, 0.08)" : "rgba(16, 185, 129, 0.08)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{lastScanResult.malzemeKodu}</div>
              <div className="muted" style={{ fontSize: "0.85rem" }}>
                Firma: {lastScanResult.firma} · Lot: <strong>{lastScanResult.lotNo}</strong>
              </div>
            </div>

            {!lastScanResult.undone ? (
              <button
                type="button"
                className="btn-danger btn-small"
                onClick={() => handleUndoItem(lastScanResult)}
              >
                ↩ İşlemi Geri Al
              </button>
            ) : (
              <span className="badge" style={{ background: "#64748b25", color: "#94a3b8" }}>
                İade Edildi
              </span>
            )}
          </div>

          <div style={{ marginTop: 8, fontSize: "0.95rem" }}>
            {lastScanResult.undone ? (
              <span className="muted">↩ Bu işlem geri alındı, stok eski haline getirildi.</span>
            ) : (
              <span style={{ color: "#10b981", fontWeight: 700 }}>
                ✓ {lastScanResult.miktar} KG stoktan düşüldü — Depoda Kalan: {lastScanResult.kalanSonrasi} KG
              </span>
            )}
          </div>
        </div>
      )}

      {/* Manual Weight Confirmation Card (when standard package is not set or custom) */}
      {manualLot && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            border: "2px solid #f59e0b",
            background: "rgba(245, 158, 11, 0.06)",
          }}
        >
          <div className="card-header">
            <strong>{manualLot.malzemeKodu}</strong>
            <span className="muted">{manualLot.firma}</span>
          </div>
          <div className="card-meta" style={{ marginTop: 4 }}>
            Lot: <strong>{manualLot.lotNo}</strong> · Depodaki Mevcut Stok: <strong>{manualLot.kalanMiktar} KG</strong>
          </div>
          <p className="warning-text" style={{ marginTop: 8, fontSize: "0.88rem" }}>
            Bu malzemenin standart ambalaj miktarı tanımlı değil veya manuel mod seçildi. Lütfen çıkış miktarını girip onaylayın:
          </p>
          <div className="grid2" style={{ marginTop: 8 }}>
            <label>
              Çıkış Miktarı (KG)
              <input
                autoFocus
                value={manualMiktar}
                onChange={(e) => setManualMiktar(e.target.value)}
                placeholder="örn. 25"
                inputMode="decimal"
              />
            </label>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={handleConfirmManual}
                style={{ flex: 1, height: 42 }}
              >
                ✓ Çıkışı Onayla — Stoktan Düş
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setManualLot(null)}
                style={{ height: 42 }}
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scan Session History Table */}
      {scanHistory.length > 0 && (
        <div className="card" style={{ marginTop: 16, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: "1rem" }}>
              📋 Bu Oturumda Barkodla Yapılan Çıkışlar ({scanHistory.length} İşlem)
            </h3>
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              Toplam Düşülen:{" "}
              <strong>
                {scanHistory
                  .filter((h) => !h.undone)
                  .reduce((acc, curr) => acc + curr.miktar, 0)
                  .toFixed(2)}{" "}
                KG
              </strong>
            </span>
          </div>

          <div className="table-wrap" style={{ maxHeight: 300, overflowY: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Saat</th>
                  <th>Malzeme Kodu</th>
                  <th>Lot No</th>
                  <th>Firma</th>
                  <th>Düşülen Miktar</th>
                  <th>Kalan Stok</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {scanHistory.map((item) => (
                  <tr
                    key={item.id}
                    style={{
                      opacity: item.undone ? 0.5 : 1,
                      textDecoration: item.undone ? "line-through" : "none",
                    }}
                  >
                    <td style={{ fontSize: "0.85rem" }}>{item.tarih}</td>
                    <td>
                      <strong>{item.malzemeKodu}</strong>
                    </td>
                    <td style={{ fontFamily: "monospace" }}>{item.lotNo}</td>
                    <td>{item.firma}</td>
                    <td style={{ fontWeight: 700, color: item.undone ? "inherit" : "#10b981" }}>
                      {item.miktar} KG
                    </td>
                    <td>{item.kalanSonrasi} KG</td>
                    <td>
                      {!item.undone ? (
                        <button
                          type="button"
                          className="btn-danger btn-small"
                          onClick={() => handleUndoItem(item)}
                          style={{ padding: "2px 8px", fontSize: "0.75rem" }}
                        >
                          Geri Al
                        </button>
                      ) : (
                        <span className="muted" style={{ fontSize: "0.75rem" }}>
                          İade Edildi
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <IATFFormFooter
        formId="DEP_F05"
        defaultKodu="DEP/F05"
        defaultAdi="Üretime Hammadde Barkodlu Çıkış Formu"
      />
    </div>
  );
}
