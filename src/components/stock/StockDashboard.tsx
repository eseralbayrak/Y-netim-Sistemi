import { useEffect, useMemo, useRef, useState } from "react";
import type { Receipt, Movement, StockLot, Material } from "../../types";
import { loadMaterials } from "../../lib/materialsStorage";
import SearchPanel from "./SearchPanel";
import SummaryCards from "./SummaryCards";
import StockCharts from "./StockCharts";
import StockTable from "./StockTable";
import LotDrawer from "./LotDrawer";
import ExportButtons from "./ExportButtons";
import { emptyFilters, buildLotRows, applyFilters, type StockFilters } from "./stockUtils";
import { IATFFormFooter } from "../IATFFormFooter";
import { api } from "../../lib/api";

interface Props {
  receipts: Receipt[];
  movements: Movement[];
  lots: StockLot[];
  onChanged: () => void;
}

function CertificateReminder({ rows }: { rows: any[] }) {
  const [visible, setVisible] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState<number | null>(null);
  const [missingList, setMissingList] = useState<any[] | null>(null);

  useEffect(() => {
    let mounted = true;
    async function init() {
      let currentSnoozeUntil: number | null = null;
      try {
        const r = await api.get<{ snoozeUntil: number | null }>("/reminders");
        if (!mounted) return;
        currentSnoozeUntil = r?.snoozeUntil ?? null;
        setSnoozeUntil(currentSnoozeUntil);
      } catch {}

      try {
        const m = await api.get<any[]>("/missing-certificates");
        if (!mounted) return;
        setMissingList(m || []);
        const snoozed = currentSnoozeUntil && Date.now() < currentSnoozeUntil;
        if (m && m.length > 0 && !snoozed) setVisible(true);
      } catch {}
    }

    init();

    // periodic check every 48 hours
    const id = setInterval(async () => {
      try {
        const r = await api.get<{ snoozeUntil: number | null }>("/reminders");
        if (!mounted) return;
        const currentSnoozeUntil = r?.snoozeUntil ?? null;
        setSnoozeUntil(currentSnoozeUntil);
        const snoozed = currentSnoozeUntil && Date.now() < currentSnoozeUntil;
        if (snoozed) return;
        const m = await api.get<any[]>('/missing-certificates');
        if (!mounted) return;
        setMissingList(m || []);
        if (m && m.length > 0) setVisible(true);
      } catch {
        // ignore
      }
    }, 48 * 60 * 60 * 1000);

    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  if (!visible) return null;

  const missing = missingList ?? rows.filter((r) => !r.sertifikaNo || r.sertifikaNo === "—");

  return (
    <div className="modal-overlay" style={{ position: "fixed", inset: 0, zIndex: 1200 }}>
      <div style={{ background: "var(--panel-bg)", padding: 18, borderRadius: 8, maxWidth: 720, width: "90%", margin: "60px auto" }}>
        <h3>Analiz Sertifikası Eksik Lotlar</h3>
        <p className="muted">Aşağıdaki lotlar için analiz sertifikası yüklenmemiş. Lütfen kontrol edin.</p>
        <div style={{ maxHeight: 220, overflow: "auto", marginTop: 8 }}>
          <table style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Lot No</th>
                <th style={{ textAlign: "left" }}>Malzeme</th>
                <th style={{ textAlign: "left" }}>Firma</th>
              </tr>
            </thead>
            <tbody>
              {missing.slice(0, 50).map((m) => (
                <tr key={m.lotNo}>
                  <td>{m.lotNo}</td>
                  <td className="muted">{m.malzemeAdi || m.malzemeKodu}</td>
                  <td className="muted">{m.firma}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <button
            className="btn-secondary"
            onClick={async () => {
              const until = Date.now() + 48 * 60 * 60 * 1000;
              try {
                await api.post('/reminders/snooze', { until });
                setSnoozeUntil(until);
                setVisible(false);
              } catch (error) {
                console.error("Hatırlatıcı erteleme hatası:", error);
              }
            }}
          >
            48 Saat Ertele
          </button>
          <button className="btn-secondary" onClick={() => setVisible(false)}>
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

import YardimciParcaStok from "../YardimciParcaStok";
import YariMamulTanimlari from "../YariMamulTanimlari";
import MamulTanimlari from "../MamulTanimlari";
import RetBolgesi from "../RetBolgesi";

export default function StockDashboard({ receipts, movements, lots, onChanged }: Props) {
  const [categoryTab, setCategoryTab] = useState<"hammadde" | "yardimci" | "yariMamul" | "mamul" | "retBolgesi">("hammadde");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [filters, setFilters] = useState<StockFilters>(emptyFilters);
  const [drawerLotNo, setDrawerLotNo] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMaterials().then(setMaterials);
  }, []);

  const allRows = useMemo(() => buildLotRows(lots, materials, receipts), [lots, materials, receipts]);
  const filteredRows = useMemo(() => applyFilters(allRows, filters), [allRows, filters]);

  async function withPrintMode(action: () => void | Promise<void>) {
    setPrintMode(true);
    await new Promise((r) => setTimeout(r, 80));
    await action();
    setPrintMode(false);
  }

  return (
    <div>
      {/* 4 Ana Kategori Sekmesi Header */}
      <div
        className="no-print"
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 16,
          background: "var(--panel-bg, #ffffff)",
          padding: 8,
          borderRadius: 10,
          border: "1px solid var(--border-color, #e2e8f0)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <button
          className={`btn-secondary ${categoryTab === "hammadde" ? "btn-primary" : ""}`}
          style={{ flex: 1, padding: "10px 14px", fontWeight: "bold", fontSize: "0.95rem" }}
          onClick={() => setCategoryTab("hammadde")}
        >
          🧪 1. Hammaddeler
        </button>
        <button
          className={`btn-secondary ${categoryTab === "yardimci" ? "btn-primary" : ""}`}
          style={{ flex: 1, padding: "10px 14px", fontWeight: "bold", fontSize: "0.95rem" }}
          onClick={() => setCategoryTab("yardimci")}
        >
          🔧 2. Yardımcı Parçalar
        </button>
        <button
          className={`btn-secondary ${categoryTab === "yariMamul" ? "btn-primary" : ""}`}
          style={{ flex: 1, padding: "10px 14px", fontWeight: "bold", fontSize: "0.95rem" }}
          onClick={() => setCategoryTab("yariMamul")}
        >
          🧩 3. Yarı Mamüller
        </button>
        <button
          className={`btn-secondary ${categoryTab === "mamul" ? "btn-primary" : ""}`}
          style={{ flex: 1, padding: "10px 14px", fontWeight: "bold", fontSize: "0.95rem" }}
          onClick={() => setCategoryTab("mamul")}
        >
          📦 4. Mamüller
        </button>
        <button
          className={`btn-secondary ${categoryTab === "retBolgesi" ? "btn-primary" : ""}`}
          style={{ flex: 1, padding: "10px 14px", fontWeight: "bold", fontSize: "0.95rem", color: categoryTab === "retBolgesi" ? "#ffffff" : "#ef4444", borderColor: "#ef4444" }}
          onClick={() => setCategoryTab("retBolgesi")}
        >
          🚨 5. Ret Bölgesi (Karantina)
        </button>
      </div>

      {categoryTab === "hammadde" && (
        <>
          <SearchPanel filters={filters} onChange={setFilters} />

          <div className="export-buttons-row no-print">
            <ExportButtons rows={filteredRows} dashboardRef={dashboardRef} onClearFilters={() => setFilters(emptyFilters)} withPrintMode={withPrintMode} />
          </div>

          <div ref={dashboardRef} className="dashboard-capture-area" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* 1. Lot Detay Tablosu (Üst Kısım) */}
            <StockTable rows={filteredRows} onDetay={setDrawerLotNo} onLocationChanged={onChanged} showAllRows={printMode} />

            {/* 2. Stok Dashboard & Grafikleri (Alt Kısım) */}
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                  cursor: "pointer",
                  userSelect: "none",
                }}
                onClick={() => setShowAnalytics(!showAnalytics)}
              >
                <h3 style={{ fontSize: "1.1rem", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  📊 Stok Özet Gösterge Paneli ve Analitik Grafikler
                </h3>
                <button
                  type="button"
                  className="btn-secondary btn-small no-print"
                  style={{ fontSize: "0.85rem", padding: "4px 10px" }}
                >
                  {showAnalytics ? "▲ Gösterge Panelini Gizle" : "▼ Gösterge Panelini Aç"}
                </button>
              </div>

              {showAnalytics && (
                <>
                  <SummaryCards rows={filteredRows} />
                  <StockCharts rows={filteredRows} movements={movements} />
                </>
              )}
            </div>

            <CertificateReminder rows={filteredRows} />
            <IATFFormFooter formId="STK_F01" defaultKodu="STK/F01" defaultAdi="Hammadde Stok Takip Raporu" />
          </div>

          <LotDrawer lotNo={drawerLotNo} rows={filteredRows} onClose={() => setDrawerLotNo(null)} onChanged={onChanged} />
        </>
      )}

      {categoryTab === "yardimci" && <YardimciParcaStok />}

      {categoryTab === "yariMamul" && <YariMamulTanimlari isStockView={true} />}

      {categoryTab === "mamul" && <MamulTanimlari isStockView={true} />}

      {categoryTab === "retBolgesi" && (
        <RetBolgesi receipts={receipts} movements={movements} lots={lots} onChanged={onChanged} />
      )}
    </div>
  );
}
