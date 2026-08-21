import { useState } from "react";
import type { LabelSettings } from "../types";
import { saveLabelSettings } from "../lib/storage";

interface Props {
  settings: LabelSettings;
  onChanged: (s: LabelSettings) => void;
}

const PRESETS: { label: string; widthMm: number; heightMm: number }[] = [
  { label: "100 x 75 mm (Standart Tanıtım Etiketi)", widthMm: 100, heightMm: 75 },
  { label: "100 x 80 mm", widthMm: 100, heightMm: 80 },
  { label: "100 x 100 mm", widthMm: 100, heightMm: 100 },
  { label: "80 x 60 mm", widthMm: 80, heightMm: 60 },
];

export default function EtiketAyarlari({ settings, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<LabelSettings>(settings);

  function apply(next: LabelSettings) {
    setLocal(next);
    saveLabelSettings(next).catch(() => {});
    onChanged(next);
  }

  return (
    <div className="panel no-print settings-panel">
      <div className="settings-header" onClick={() => setOpen(!open)}>
        <h2 style={{ margin: 0 }}>Etiket / Yazıcı Ayarları (Argox CP-2140)</h2>
        <span className="muted">{open ? "▲ kapat" : "▼ aç"}</span>
      </div>

      {open && (
        <div className="settings-body">
          <p className="muted">
            Argox CP-2140'ta yazdırmadan önce Windows'ta yazıcı özelliklerinden kağıt/etiket
            boyutunu burada girdiğin ölçüyle aynı yap. Yazdır penceresinde "Üst bilgiler ve alt
            bilgiler" seçeneğini kapat — tarayıcının kendi tarih/URL yazısı bu şekilde çıkmaz.
          </p>

          <div className="grid2">
            <label>
              Etiket Genişliği (mm)
              <input
                value={local.widthMm}
                onChange={(e) =>
                  apply({ ...local, widthMm: parseFloat(e.target.value) || local.widthMm })
                }
                inputMode="decimal"
              />
            </label>
            <label>
              Etiket Yüksekliği (mm)
              <input
                value={local.heightMm}
                onChange={(e) =>
                  apply({ ...local, heightMm: parseFloat(e.target.value) || local.heightMm })
                }
                inputMode="decimal"
              />
            </label>
          </div>

          <div className="preset-row">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                className="btn-secondary btn-small"
                onClick={() => apply({ ...local, widthMm: p.widthMm, heightMm: p.heightMm })}
              >
                {p.label}
              </button>
            ))}
          </div>

          <label>
            Etiket Üst Bilgi Metni
            <input
              value={local.headerText}
              onChange={(e) => apply({ ...local, headerText: e.target.value })}
              placeholder="örn. B.R. LEVENT PLASTİK"
            />
          </label>

          <label>
            Etiket Alt Bilgi Metni
            <input
              value={local.footerText}
              onChange={(e) => apply({ ...local, footerText: e.target.value })}
              placeholder="örn. GİRİŞ KALİTE ONAYLI — DEPO KULLANIMI İÇİNDİR"
            />
          </label>
        </div>
      )}
    </div>
  );
}
