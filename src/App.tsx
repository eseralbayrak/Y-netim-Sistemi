import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import GirisForm from "./components/GirisForm";
import KaliteKontrol from "./components/KaliteKontrol";
import EtiketYazdir from "./components/EtiketYazdir";
import CikisBarkod from "./components/CikisBarkod";
import StockDashboard from "./components/stock/StockDashboard";
import Gecmis from "./components/Gecmis";
import MalzemeTanimlari from "./components/MalzemeTanimlari";
import YardimciParcaTanimlari from "./components/YardimciParcaTanimlari";
import SatinAlma from "./components/SatinAlma";
import Yedekleme from "./components/Yedekleme";
import Login from "./components/Login";
import YonetimPaneli from "./components/YonetimPaneli";
import { loadDb } from "./lib/storage";
import { fetchMe, getStoredUser, login, logout, setUnauthorizedHandler } from "./lib/auth";
import type { AuthUser, Database, Role } from "./types";

import YariMamulTanimlari from "./components/YariMamulTanimlari";
import MamulTanimlari from "./components/MamulTanimlari";

type SubDefTab = "malzeme" | "yardimciParca" | "yariMamul" | "mamul";

type Tab =
  | "satinAlma"
  | "giris"
  | "kalite"
  | "etiket"
  | "cikis"
  | "stok"
  | "tanimlar"
  | SubDefTab
  | "gecmis"
  | "yedek"
  | "yonetim";

const DEFINITION_TABS: { key: SubDefTab; label: string; icon: string }[] = [
  { key: "malzeme", label: "1. Hammadde Tanımları", icon: "🧪" },
  { key: "yardimciParca", label: "2. Yardımcı Parça Tanımları", icon: "🔩" },
  { key: "yariMamul", label: "3. Yarı Mamül & Kalıplar", icon: "🧩" },
  { key: "mamul", label: "4. Mamül Tanımları", icon: "📦" },
];

const MAIN_NAV_ITEMS: { key: Tab; label: string; isTreeGroup?: boolean }[] = [
  { key: "satinAlma", label: "Satın Alma & Siparişler" },
  { key: "giris", label: "1. Mal Kabul" },
  { key: "kalite", label: "2. Kalite Kontrol" },
  { key: "etiket", label: "3. Etiket Basım" },
  { key: "cikis", label: "4. Depo Çıkışı" },
  { key: "stok", label: "Stok Yönetimi (4 Kategori)" },
  { key: "tanimlar", label: "📁 Sistem Tanımları", isTreeGroup: true },
  { key: "gecmis", label: "Geçmiş" },
  { key: "yedek", label: "Yedekleme" },
  { key: "yonetim", label: "Yönetim Paneli" },
];

// Her rolün görebileceği sekmeler.
const ROLE_TABS: Record<Role, Tab[]> = {
  "Yönetici": ["satinAlma", "giris", "kalite", "etiket", "cikis", "stok", "tanimlar", "malzeme", "yardimciParca", "yariMamul", "mamul", "gecmis", "yedek", "yonetim"],
  "Giriş Kalite": ["giris", "kalite", "etiket", "satinAlma", "stok", "tanimlar", "malzeme", "yardimciParca", "yariMamul", "mamul", "gecmis"],
  "Depo": ["cikis", "stok", "tanimlar", "yariMamul", "mamul", "gecmis"],
  "Satın Alma": ["satinAlma", "tanimlar", "malzeme", "yardimciParca", "yariMamul", "mamul", "stok", "gecmis"],
  "Üretim": ["cikis", "stok", "tanimlar", "yariMamul", "mamul"],
  "Raporlama": ["stok", "gecmis"],
  "Misafir": ["stok"],
};

const DEMO_USERS_MAP: Record<string, { u: string; p: string }> = {
  "Yönetici": { u: "admin", p: "admin123" },
  "Giriş Kalite": { u: "kalite", p: "kalite123" },
  "Depo": { u: "depo", p: "depo123" },
  "Satın Alma": { u: "satinalma", p: "satinalma123" },
};

const AUTO_REFRESH_MS = 8000;

function App() {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<Tab | null>(null);
  const [db, setDb] = useState<Database | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [prefillReception, setPrefillReception] = useState<{
    siparisNo?: string;
    firma?: string;
    malzemeKodu?: string;
    miktar?: number;
  } | null>(null);

  const handleStartReception = useCallback((poData: { siparisNo: string; firma: string; malzemeKodu: string; miktar?: number }) => {
    setPrefillReception(poData);
    setTab("giris");
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setTab(null);
    });
  }, []);

  useEffect(() => {
    fetchMe().then(async (me) => {
      if (!me) {
        // Oturum yoksa önizleme için otomatik varsayılan yönetici olarak oturum aç
        try {
          const autoUser = await login("admin", "admin123");
          setUser(autoUser);
        } catch {
          setUser(null);
        }
      } else {
        setUser(me);
      }
      setAuthChecked(true);
    });
  }, []);

  const allowedKeys = useMemo(() => {
    if (!user) return [];
    if (user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0) {
      const keys = [...user.permissions] as Tab[];
      if (
        keys.some((k) => ["malzeme", "yardimciParca", "yariMamul", "mamul"].includes(k)) &&
        !keys.includes("tanimlar")
      ) {
        keys.push("tanimlar");
      }
      return keys;
    }
    return ROLE_TABS[user.role] || [];
  }, [user]);

  const allowedNavItems = useMemo(() => {
    return MAIN_NAV_ITEMS.filter((item) => allowedKeys.includes(item.key));
  }, [allowedKeys]);

  const allowedDefTabs = useMemo(() => {
    return DEFINITION_TABS.filter((dt) => allowedKeys.includes(dt.key));
  }, [allowedKeys]);

  const isDefActive = useMemo(() => {
    return tab === "tanimlar" || (tab && ["malzeme", "yardimciParca", "yariMamul", "mamul"].includes(tab));
  }, [tab]);

  useEffect(() => {
    if (user) {
      if (!tab) {
        const first = allowedNavItems[0]?.key;
        if (first === "tanimlar") {
          setTab(allowedDefTabs[0]?.key || "malzeme");
        } else if (first) {
          setTab(first);
        }
      }
    }
  }, [user, allowedNavItems, allowedDefTabs, tab]);

  const refresh = useCallback(() => {
    loadDb()
      .then((data) => {
        setDb(data);
        setConnectionError(false);
      })
      .catch(() => setConnectionError(true));
  }, []);

  useEffect(() => {
    if (!user) return;
    refresh();
    const interval = setInterval(refresh, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [refresh, user]);

  async function handleQuickRoleSwitch(roleName: string) {
    const cred = DEMO_USERS_MAP[roleName];
    if (!cred) return;
    setSwitchingRole(true);
    try {
      const newUser = await login(cred.u, cred.p);
      setUser(newUser);
      setTab(null);
    } catch (e) {
      console.error("Rol değiştirilemedi:", e);
    } finally {
      setSwitchingRole(false);
    }
  }

  function handleLogout() {
    logout();
    setUser(null);
    setTab(null);
    setDb(null);
  }

  if (!authChecked) {
    return (
      <div className="app-shell" style={{ textAlign: "center", paddingTop: 80 }}>
        <p className="muted" style={{ fontSize: 16 }}>
          Yükleniyor...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <Login
        onSuccess={(u) => {
          setUser(u);
        }}
      />
    );
  }

  if (connectionError) {
    return (
      <div className="app-shell">
        <div className="panel" style={{ marginTop: 40 }}>
          <h2 style={{ color: "var(--ng)" }}>Sunucuya bağlanılamıyor</h2>
          <p className="muted">
            Yönetim Sistemi sunucusuna erişilemedi. Sunucunun çalıştığından ve bu cihazın aynı ağda
            olduğundan emin olun, sonra sayfayı yenileyin.
          </p>
        </div>
      </div>
    );
  }

  if (!db) {
    return (
      <div className="app-shell" style={{ textAlign: "center", paddingTop: 80 }}>
        <p className="muted" style={{ fontSize: 16 }}>
          Veriler yükleniyor...
        </p>
      </div>
    );
  }

  const pendingCount = db.receipts.filter((r) => r.durum === "BEKLIYOR").length;
  const readyLabelCount = db.receipts.filter((r) => r.durum === "ONAYLANDI").length;

  return (
    <div className="app-shell">
      <header className="app-header no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Yönetim Sistemi</h1>
          <p className="muted" style={{ margin: "2px 0 0" }}>B.R. Levent Plastik · Kalite, Depo, Yarı Mamül & Stok Yönetimi</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Hızlı Rol Değiştirici */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", padding: "4px 8px", borderRadius: 6, border: "1px solid var(--panel-border)" }}>
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Rol:</span>
            <select
              disabled={switchingRole}
              value={user.role}
              onChange={(e) => handleQuickRoleSwitch(e.target.value)}
              style={{
                background: "var(--panel-bg)",
                color: "var(--text)",
                border: "1px solid var(--panel-border)",
                borderRadius: 4,
                padding: "2px 6px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <option value="Yönetici">👑 Yönetici (admin)</option>
              <option value="Giriş Kalite">🔍 Giriş Kalite (kalite)</option>
              <option value="Depo">📦 Depo (depo)</option>
              <option value="Satın Alma">🛒 Satın Alma (satinalma)</option>
            </select>
          </div>

          <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              <strong style={{ color: "var(--text)" }}>{user.username}</strong>
            </span>
            <button className="btn-secondary btn-small" onClick={handleLogout}>
              Çıkış
            </button>
          </div>
        </div>
      </header>

      <nav className="tabs no-print">
        {allowedNavItems.map((t) => {
          const isActive = t.key === "tanimlar" ? isDefActive : tab === t.key;
          return (
            <button
              key={t.key}
              className={`tab-btn ${isActive ? "active" : ""}`}
              onClick={() => {
                if (t.key === "tanimlar") {
                  setTab(allowedDefTabs[0]?.key || "malzeme");
                } else {
                  setTab(t.key);
                }
              }}
            >
              {t.label} {t.isTreeGroup ? (isDefActive ? "▾" : "▸") : ""}
              {t.key === "kalite" && pendingCount > 0 && (
                <span className="badge">{pendingCount}</span>
              )}
              {t.key === "etiket" && readyLabelCount > 0 && (
                <span className="badge">{readyLabelCount}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Tanımlar Alt Ağaç Menüsü */}
      {isDefActive && allowedDefTabs.length > 0 && (
        <div className="tree-subnav no-print">
          <span className="tree-subnav-label">📂 Tanım Ağacı:</span>
          {allowedDefTabs.map((dt) => {
            const isSubActive =
              tab === dt.key || (tab === "tanimlar" && allowedDefTabs[0]?.key === dt.key);
            return (
              <button
                key={dt.key}
                className={`tree-subnav-btn ${isSubActive ? "active" : ""}`}
                onClick={() => setTab(dt.key)}
              >
                {dt.icon} {dt.label}
              </button>
            );
          })}
        </div>
      )}

      <main className="app-main">
        {tab === "satinAlma" && <SatinAlma onStartReception={handleStartReception} />}
        {tab === "giris" && <GirisForm onCreated={refresh} prefillData={prefillReception} />}
        {tab === "kalite" && <KaliteKontrol receipts={db.receipts} onChanged={refresh} />}
        {tab === "etiket" && <EtiketYazdir receipts={db.receipts} onChanged={refresh} />}
        {tab === "cikis" && <CikisBarkod lots={Object.values(db.lots)} onChanged={refresh} />}
        {tab === "stok" && (
          <StockDashboard
            receipts={db.receipts}
            movements={db.movements}
            lots={Object.values(db.lots)}
            onChanged={refresh}
          />
        )}

        {/* Tanım Sayfaları Render Logic */}
        {(tab === "malzeme" || (tab === "tanimlar" && allowedDefTabs[0]?.key === "malzeme")) && (
          <MalzemeTanimlari />
        )}
        {(tab === "yardimciParca" || (tab === "tanimlar" && allowedDefTabs[0]?.key === "yardimciParca")) && (
          <YardimciParcaTanimlari />
        )}
        {(tab === "yariMamul" || (tab === "tanimlar" && allowedDefTabs[0]?.key === "yariMamul")) && (
          <YariMamulTanimlari />
        )}
        {(tab === "mamul" || (tab === "tanimlar" && allowedDefTabs[0]?.key === "mamul")) && (
          <MamulTanimlari />
        )}

        {tab === "gecmis" && <Gecmis movements={db.movements} receipts={db.receipts} />}
        {tab === "yedek" && <Yedekleme />}
        {tab === "yonetim" && <YonetimPaneli currentUser={user} />}
      </main>
    </div>
  );
}

export default App;
