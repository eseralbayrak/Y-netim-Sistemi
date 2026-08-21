import { useMemo } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";
import type { LotRow } from "./stockUtils";
import type { Movement } from "../../types";
import { formatKg } from "./stockUtils";

interface Props {
  rows: LotRow[];
  movements: Movement[];
}

const PALETTE = [
  "#4d9fff", "#35c281", "#ff8a3d", "#ef5c5c", "#c084fc",
  "#f5d90a", "#22d3ee", "#f472b6", "#a3e635", "#94a3b8",
];

function TooltipBox({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="chart-tooltip">
      {label && <div className="chart-tooltip-label">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i}>
          {p.name}: <strong style={{ color: PALETTE[i % PALETTE.length] }}>{formatKg(p.value)} KG</strong>
        </div>
      ))}
    </div>
  );
}

export default function StockCharts({ rows, movements }: Props) {
  const malzemeDagilimi = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      if (r.kalanMiktar <= 0) return;
      map.set(r.malzemeAdi, (map.get(r.malzemeAdi) || 0) + r.kalanMiktar);
    });
    const arr = Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const top = arr.slice(0, 8);
    const rest = arr.slice(8).reduce((sum, x) => sum + x.value, 0);
    if (rest > 0) top.push({ name: "Diğer", value: rest });
    return top;
  }, [rows]);

  const lotBazliStok = useMemo(
    () =>
      rows
        .filter((r) => r.kalanMiktar > 0)
        .sort((a, b) => b.kalanMiktar - a.kalanMiktar)
        .slice(0, 30)
        .map((r) => ({ lotNo: r.lotNo, kalanKg: r.kalanMiktar })),
    [rows]
  );

  const firmaBazliStok = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      if (r.kalanMiktar <= 0) return;
      map.set(r.firma, (map.get(r.firma) || 0) + r.kalanMiktar);
    });
    return Array.from(map.entries())
      .map(([firma, toplamKg]) => ({ firma, toplamKg }))
      .sort((a, b) => b.toplamKg - a.toplamKg)
      .slice(0, 15);
  }, [rows]);

  const aylikTrend = useMemo(() => {
    const rowLotSet = new Set(rows.map((r) => r.lotNo));
    const relevant = movements.filter((m) => m.tip === "GIRIS" && rowLotSet.has(m.lotNo));

    const now = new Date();
    const months: { key: string; label: string; miktar: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
      months.push({ key, label, miktar: 0 });
    }
    const byKey = new Map(months.map((m) => [m.key, m]));
    relevant.forEach((m) => {
      const key = m.tarih.slice(0, 7);
      const bucket = byKey.get(key);
      if (bucket) bucket.miktar += m.miktar;
    });
    return months;
  }, [rows, movements]);

  return (
    <div className="charts-grid">
      <div className="chart-card">
        <h3 className="sub-heading">Malzeme Bazında Stok Dağılımı</h3>
        {malzemeDagilimi.length === 0 ? (
          <p className="muted">Gösterilecek veri yok.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={malzemeDagilimi}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={2}
              >
                {malzemeDagilimi.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip content={<TooltipBox />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="chart-card">
        <h3 className="sub-heading">Lot Bazında Kalan Stok</h3>
        {lotBazliStok.length === 0 ? (
          <p className="muted">Gösterilecek veri yok.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={lotBazliStok}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3340" />
              <XAxis dataKey="lotNo" tick={{ fontSize: 10, fill: "#8b98a9" }} hide={lotBazliStok.length > 10} />
              <YAxis tick={{ fontSize: 11, fill: "#8b98a9" }} />
              <Tooltip content={<TooltipBox />} />
              <Bar dataKey="kalanKg" name="Kalan KG" fill="#ff8a3d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        {lotBazliStok.length >= 30 && (
          <p className="muted" style={{ marginTop: 4 }}>
            İlk 30 lot gösteriliyor.
          </p>
        )}
      </div>

      <div className="chart-card">
        <h3 className="sub-heading">Firma Bazında Toplam Stok</h3>
        {firmaBazliStok.length === 0 ? (
          <p className="muted">Gösterilecek veri yok.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(260, firmaBazliStok.length * 32)}>
            <BarChart data={firmaBazliStok} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3340" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#8b98a9" }} />
              <YAxis
                type="category"
                dataKey="firma"
                width={130}
                tick={{ fontSize: 10, fill: "#8b98a9" }}
              />
              <Tooltip content={<TooltipBox />} />
              <Bar dataKey="toplamKg" name="Toplam KG" fill="#4d9fff" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="chart-card">
        <h3 className="sub-heading">Aylık Giriş Trendi (Son 12 Ay)</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={aylikTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3340" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8b98a9" }} />
            <YAxis tick={{ fontSize: 11, fill: "#8b98a9" }} />
            <Tooltip content={<TooltipBox />} />
            <Line
              type="monotone"
              dataKey="miktar"
              name="Giriş KG"
              stroke="#35c281"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
