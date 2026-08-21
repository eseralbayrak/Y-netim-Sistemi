import { useMemo } from "react";
import type { LotRow } from "./stockUtils";
import { formatKg } from "./stockUtils";

interface Props {
  rows: LotRow[];
}

function Icon({ name }: { name: string }) {
  switch (name) {
    case "lots":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 9h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "stock":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 12h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M4 6h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          <path d="M4 18h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
        </svg>
      );
    case "avg":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 12l4-4 4 8 4-6 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      );
    case "date":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M16 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M8 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "critical":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="12" cy="19" r="2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    default:
      return null;
  }
}

export default function SummaryCards({ rows }: Props) {
  const stats = useMemo(() => {
    const stoktaOlanlar = rows.filter((r) => r.kalanMiktar > 0);
    const toplamStok = stoktaOlanlar.reduce((sum, r) => sum + r.kalanMiktar, 0);
    const ortalamaLot = stoktaOlanlar.length > 0 ? toplamStok / stoktaOlanlar.length : 0;
    const tarihler = rows.map((r) => r.girisTarihi).filter(Boolean).sort();
    const enEski = tarihler[0];
    const sonGiris = tarihler[tarihler.length - 1];
    const kritikSayisi = rows.filter((r) => r.durum === "KRITIK").length;
    
    // Additional metrics
    const farkliMalzemeler = new Set(stoktaOlanlar.map((r) => r.malzemeAdi || r.malzemeKodu)).size;
    const sertifikaliLotlar = rows.filter((r) => r.sertifikaNo && r.sertifikaNo !== "—").length;

    return {
      toplamLot: rows.length,
      stoktaLotSayisi: stoktaOlanlar.length,
      toplamStok,
      ortalamaLot,
      enEski,
      sonGiris,
      kritikSayisi,
      farkliMalzemeler,
      sertifikaliLotlar,
    };
  }, [rows]);

  const cards = [
    { key: "lots", label: "Toplam Lot (Aktif Stoklu)", value: `${stats.stoktaLotSayisi} / ${stats.toplamLot} LOT`, icon: "lots" },
    { key: "stock", label: "Toplam Stok Miktarı", value: `${formatKg(stats.toplamStok)} KG`, icon: "stock", spark: true },
    { key: "mat", label: "Aktif Malzeme Çeşidi", value: `${stats.farkliMalzemeler} Çeşit`, icon: "avg" },
    { key: "avg", label: "Ortalama Lot Miktarı", value: `${formatKg(stats.ortalamaLot)} KG`, icon: "avg" },
    { key: "cert", label: "Sertifikalı Lot Sayısı", value: `${stats.sertifikaliLotlar} Lot`, icon: "date" },
    { key: "last", label: "Son Giriş Tarihi", value: stats.sonGiris || "—", icon: "date" },
    { key: "krit", label: "Kritik / Tükenen Lot", value: `${stats.kritikSayisi} LOT`, icon: "critical", critical: stats.kritikSayisi > 0 },
  ];

  return (
    <div className="dashboard-cards">
      {cards.map((c) => (
        <div key={c.key} className={`dash-card ${c.critical ? "dash-card-critical" : ""}`}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="dash-card-icon" aria-hidden>
              <Icon name={c.icon} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="dash-card-label">{c.label}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div className={`dash-card-value ${typeof c.value === "string" && c.value.length > 12 ? "dash-card-value-sm" : ""}`}>
                  {c.value}
                </div>
                {c.spark ? <Sparkline rows={rows} /> : null}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Sparkline({ rows }: { rows: LotRow[] }) {
  // Build last-6-month totals from `girisTarihi` using kalanMiktar
  const months: { label: string; value: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: d.toLocaleString("tr-TR", { month: "short" }), value: 0 });
  }
  const byKey = new Map(months.map((m, idx) => [idx, m]));
  rows.forEach((r) => {
    if (!r.girisTarihi) return;
    const d = new Date(r.girisTarihi);
    if (isNaN(d.getTime())) return;
    const diffMonths = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
    if (diffMonths > 0 || diffMonths < -5) return;
    const idx = 5 + diffMonths; // map to 0..5
    const current = byKey.get(idx);
    if (current) current.value += r.kalanMiktar || 0;
  });

  const values = months.map((m) => m.value);
  const max = Math.max(...values, 1);
  const w = 80;
  const h = 28;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (w - 4) + 2;
    const y = h - (v / max) * (h - 6) - 3;
    return [x, y];
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');

  return (
    <svg className="sparkline-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.6} strokeOpacity={0.95} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
