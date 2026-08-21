import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface Props {
  src: string;
  title: string;
  compact?: boolean;
}

export default function PdfDocumentViewer({ src, title, compact = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setPageNumber(1);
  }, [src]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    pdfjsLib.getDocument({ url: src }).promise
      .then(async (pdf) => {
        if (cancelled) return;
        setPageCount(pdf.numPages);
        const page = await pdf.getPage(pageNumber);
        if (cancelled || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas desteklenmiyor.");

        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = canvas.parentElement?.clientWidth || baseViewport.width;
        const scale = Math.max(1, availableWidth / baseViewport.width);
        const viewport = page.getViewport({ scale });
        const deviceScale = window.devicePixelRatio || 1;
        canvas.width = Math.ceil(viewport.width * deviceScale);
        canvas.height = Math.ceil(viewport.height * deviceScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        if (!cancelled) setLoading(false);
      })
      .catch((reason) => {
        if (!cancelled) {
          setLoading(false);
          setError(reason instanceof Error ? reason.message : "PDF görüntülenemedi.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [src, pageNumber]);

  return (
    <div className={`pdf-viewer ${compact ? "pdf-viewer-compact" : ""}`}>
      {loading && <div className="pdf-viewer-status">PDF yükleniyor...</div>}
      {error ? (
        <div className="pdf-viewer-status pdf-viewer-error">
          PDF görüntülenemedi: {error}
          <a href={src} target="_blank" rel="noreferrer">Dosyayı aç</a>
        </div>
      ) : (
        <canvas ref={canvasRef} aria-label={title} />
      )}
      {!compact && pageCount > 1 && (
        <div className="pdf-viewer-controls">
          <button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber((value) => Math.max(1, value - 1))}>Önceki</button>
          <span>{pageNumber} / {pageCount}</span>
          <button type="button" disabled={pageNumber >= pageCount} onClick={() => setPageNumber((value) => Math.min(pageCount, value + 1))}>Sonraki</button>
        </div>
      )}
    </div>
  );
}
