import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface Props {
  value: string;
  width?: number;
  height?: number;
  fontSize?: number;
  displayValue?: boolean;
  className?: string;
  lineColor?: string;
}

export default function BarcodeView({
  value,
  width = 1.5,
  height = 36,
  fontSize = 12,
  displayValue = true,
  className = "",
  lineColor = "#000000",
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;

    try {
      JsBarcode(svgRef.current, String(value).trim(), {
        format: "CODE128",
        width,
        height,
        displayValue,
        fontSize,
        font: "SFMono-Regular, Consolas, monospace",
        textMargin: 0,
        margin: 8,
        background: "transparent",
        lineColor,
      });
      svgRef.current.setAttribute("preserveAspectRatio", "none");
    } catch (e) {
      console.warn("Barcode rendering error:", e);
    }
  }, [value, width, height, fontSize, displayValue, lineColor]);

  if (!value) return null;

  return (
    <div
      className={`barcode-container ${className}`}
      style={{
        display: "inline-flex",
        width: "100%",
        height: "100%",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
        padding: "4px 8px",
        borderRadius: 4,
      }}
    >
      <svg ref={svgRef} style={{ width: "100%", maxWidth: "100%", height: "100%", display: "block" }} />
    </div>
  );
}
