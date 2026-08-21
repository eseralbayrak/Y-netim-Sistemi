import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import {
  isMediaDevicesSupported,
  isSecureCameraContext,
  mapCameraError,
  pickBackCamera,
} from "../lib/qrCamera";

export type QrCameraStatus = "idle" | "starting" | "scanning" | "error";

interface UseQrCameraScannerResult {
  status: QrCameraStatus;
  errorMessage: string | null;
  /** Kamerayı başlatır. `elementId` ile eşleşen DOM elemanı zaten sayfada olmalı. */
  start: (elementId: string) => void;
  /** Kamerayı güvenli şekilde durdurur ve kaynakları serbest bırakır. */
  stop: () => void;
  /** Kamera hatası oluştuğunda yeniden başlatmayı dener. */
  retry: (elementId: string) => void;
  /** Yüklenen resim dosyasından QR okur. */
  scanFile: (file: File) => Promise<string | null>;
}

export function useQrCameraScanner(
  onDecoded: (decodedText: string) => void
): UseQrCameraScannerResult {
  const [status, setStatus] = useState<QrCameraStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startTokenRef = useRef(0);
  const decodedRef = useRef(false);
  const onDecodedRef = useRef(onDecoded);
  onDecodedRef.current = onDecoded;

  const stop = useCallback(() => {
    startTokenRef.current += 1;
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) {
      setStatus("idle");
      return;
    }

    void (async () => {
      try {
        if (
          scanner.getState() === Html5QrcodeScannerState.SCANNING ||
          scanner.getState() === Html5QrcodeScannerState.PAUSED
        ) {
          await scanner.stop();
        }
      } catch {
        // ignore
      }
      try {
        scanner.clear();
      } catch {
        // ignore
      }
    })();

    setStatus("idle");
    setErrorMessage(null);
  }, []);

  const start = useCallback(
    (elementId: string) => {
      const myToken = ++startTokenRef.current;
      decodedRef.current = false;

      if (scannerRef.current) return;

      if (!isSecureCameraContext()) {
        setStatus("error");
        setErrorMessage("Kamera yalnızca güvenli bağlantıda (HTTPS) çalışır.");
        return;
      }

      if (!isMediaDevicesSupported()) {
        setStatus("error");
        setErrorMessage("Bu tarayıcı kamera erişimini desteklemiyor.");
        return;
      }

      setStatus("starting");
      setErrorMessage(null);

      void (async () => {
        // DOM elementinin hazır olmasını bekle
        await new Promise((res) => setTimeout(res, 50));
        if (myToken !== startTokenRef.current) return;

        const el = document.getElementById(elementId);
        if (!el) {
          setStatus("error");
          setErrorMessage("Kamera alanı yüklenemedi. Lütfen tekrar deneyin.");
          return;
        }

        try {
          const scanner = new Html5Qrcode(elementId);
          scannerRef.current = scanner;

          let cameraConfig: string | { facingMode: string } = { facingMode: "environment" };

          try {
            const cameras = await Html5Qrcode.getCameras();
            if (myToken !== startTokenRef.current) return;
            const picked = pickBackCamera(cameras);
            if (picked) {
              cameraConfig = picked.id;
            }
          } catch {
            // getCameras başarısız olursa facingMode fallback kullanılır
          }

          const qrBoxSize = Math.min(window.innerWidth - 60, 250);

          const handleSuccess = (decodedText: string) => {
            if (decodedRef.current) return;
            decodedRef.current = true;
            onDecodedRef.current(decodedText);
            stop();
          };

          const startScanWithConfig = async (config: any) => {
            await scanner.start(
              config,
              { fps: 10, qrbox: { width: qrBoxSize, height: qrBoxSize } },
              handleSuccess,
              () => {}
            );
          };

          try {
            await startScanWithConfig(cameraConfig);
          } catch {
            if (myToken !== startTokenRef.current) return;
            // Eğer cihaz meşgulse 500ms bekleyip tekrar dene
            await new Promise((res) => setTimeout(res, 500));
            if (myToken !== startTokenRef.current) return;

            try {
              await startScanWithConfig({ facingMode: "environment" });
            } catch {
              // Son çare varsayılan kamera
              if (myToken !== startTokenRef.current) return;
              await startScanWithConfig({});
            }
          }

          if (myToken !== startTokenRef.current) {
            stop();
            return;
          }

          setStatus("scanning");
        } catch (err) {
          if (myToken !== startTokenRef.current) return;
          setStatus("error");
          setErrorMessage(mapCameraError(err));
          scannerRef.current = null;
        }
      })();
    },
    [stop]
  );

  const retry = useCallback(
    (elementId: string) => {
      stop();
      setTimeout(() => {
        start(elementId);
      }, 300);
    },
    [start, stop]
  );

  const scanFile = useCallback(async (file: File): Promise<string | null> => {
    try {
      const html5QrCode = new Html5Qrcode("qr-file-temp-region", false);
      const decodedText = await html5QrCode.scanFile(file, true);
      if (decodedText) {
        onDecodedRef.current(decodedText);
        return decodedText;
      }
      return null;
    } catch (err) {
      throw new Error("Görselde okunabilir bir barkod bulunamadı.");
    }
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { status, errorMessage, start, stop, retry, scanFile };
}

