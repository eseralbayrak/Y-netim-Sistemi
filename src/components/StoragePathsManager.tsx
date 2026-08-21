import { useEffect, useState } from "react";
import {
  getStoragePaths,
  updateStoragePaths,
  createStorageDirectory,
  scanStorageDirectory,
  reconcileStorageFiles,
  type ReconcileMatchItem,
} from "../lib/storageService";
import type { StoragePathsConfig, StorageScanResult, ScannedFileItem } from "../types";
import { formatDateTR } from "../lib/dateUtils";

const CATEGORY_ICONS: Record<string, string> = {
  msds: "🧪",
  tds: "📋",
  coa: "📜",
  yardimciParca: "🔩",
  kaliteRaporlari: "🔬",
  genel: "📁",
};

export function StoragePathsManager() {
  const [paths, setPaths] = useState<StoragePathsConfig | null>(null);
  const [editedPaths, setEditedPaths] = useState<Record<string, string>>({});
  const [rootBatchPath, setRootBatchPath] = useState<string>("C:\\GKYS_Arsiv");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Scan & Reconciliation state
  const [selectedScanKind, setSelectedScanKind] = useState<string>("all");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<StorageScanResult | null>(null);
  const [selectedFilesToReconcile, setSelectedFilesToReconcile] = useState<Record<string, boolean>>({});
  const [manualAssignments, setManualAssignments] = useState<
    Record<string, { targetType: "material" | "auxiliaryPart" | "receipt"; targetId: string; fieldName: any }>
  >({});
  const [reconciling, setReconciling] = useState(false);

  // Filter state for scanned files table
  const [scanFilter, setScanFilter] = useState<"all" | "exact" | "suggested" | "unmatched">("all");
  const [scanSearch, setScanSearch] = useState("");

  async function handleBrowseDirectory(key?: string) {
    if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        if (dirHandle && dirHandle.name) {
          const defaultDrive = "C:\\";
          const chosenName = dirHandle.name;
          if (key) {
            const suggested = `C:\\${chosenName}`;
            setEditedPaths((prev) => ({ ...prev, [key]: suggested }));
            setMessage({
              type: "info",
              text: `📁 "${chosenName}" klasörü seçildi. Konum '${suggested}' olarak ayarlandı. Dilerseniz yolu tam olarak düzenleyip '💾 Konumları Kaydet' butonuna basabilirsiniz.`,
            });
          } else {
            const root = `C:\\${chosenName}`;
            setRootBatchPath(root);
            applyBatchRoot(root);
            setMessage({
              type: "info",
              text: `📁 "${chosenName}" ana klasörü seçildi. Tüm alt kategoriler '${root}\\...' olarak güncellendi.`,
            });
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setMessage({ type: "error", text: `Klasör seçme hatası: ${err.message}` });
        }
      }
    } else {
      // Fallback prompt
      const current = key ? (editedPaths[key] || "") : rootBatchPath;
      const input = window.prompt("Lütfen Windows klasör yolunu giriniz (Örn: C:\\GKYS_Arsiv\\MSDS):", current);
      if (input !== null) {
        if (key) {
          setEditedPaths((prev) => ({ ...prev, [key]: input.trim() }));
        } else {
          setRootBatchPath(input.trim());
          applyBatchRoot(input.trim());
        }
      }
    }
  }

  function applyBatchRoot(basePath: string) {
    const cleanBase = (basePath || "").trim().replace(/[/\\]+$/, "");
    if (!cleanBase) return;
    const subMap: Record<string, string> = {
      msds: `${cleanBase}\\MSDS`,
      tds: `${cleanBase}\\TDS`,
      coa: `${cleanBase}\\COA`,
      yardimciParca: `${cleanBase}\\YardimciParca`,
      kaliteRaporlari: `${cleanBase}\\KaliteRaporlari`,
      genel: `${cleanBase}\\GenelArsiv`,
    };
    setEditedPaths((prev) => ({
      ...prev,
      ...subMap,
    }));
    setMessage({
      type: "info",
      text: `⚡ Tüm alt kategoriler '${cleanBase}' altına başarıyla atandı. '💾 Konumları Kaydet' butonuna basarak onaylayabilirsiniz.`,
    });
  }

  async function loadData() {
    setLoading(true);
    try {
      const data = await getStoragePaths();
      setPaths(data);
      const initialEdited: Record<string, string> = {};
      Object.entries(data).forEach(([k, v]) => {
        initialEdited[k] = v.path || "";
      });
      setEditedPaths(initialEdited);
    } catch (err: any) {
      setMessage({ type: "error", text: `Konumlar yüklenemedi: ${err.message}` });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSavePaths() {
    setSaving(true);
    setMessage(null);
    try {
      const payload: Record<string, { path: string }> = {};
      Object.entries(editedPaths).forEach(([k, p]) => {
        payload[k] = { path: p.trim() };
      });
      const updated = await updateStoragePaths(payload as any);
      setPaths(updated);
      setMessage({ type: "success", text: "Klasör konumları başarıyla güncellendi ve doğrulandı." });
    } catch (err: any) {
      setMessage({ type: "error", text: `Kaydetme hatası: ${err.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateFolder(dirPath: string) {
    if (!dirPath || !dirPath.trim()) return;
    try {
      await createStorageDirectory(dirPath.trim());
      setMessage({ type: "success", text: `Klasör başarıyla oluşturuldu: ${dirPath}` });
      loadData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    }
  }

  async function handleScan(kind: string = selectedScanKind) {
    setScanning(true);
    setMessage(null);
    try {
      const res = await scanStorageDirectory(kind);
      setScanResult(res);

      // Auto-select exact matches
      const initialSelected: Record<string, boolean> = {};
      res.files.forEach((f) => {
        if (f.matchStatus === "exact" && !f.isAlreadyAttached) {
          initialSelected[f.filename] = true;
        }
      });
      setSelectedFilesToReconcile(initialSelected);

      if (res.totalFiles === 0) {
        setMessage({
          type: "error",
          text: `Seçilen konumda (${res.scannedPath}) taranacak PDF veya doküman dosyası bulunamadı.`,
        });
      } else {
        setMessage({
          type: "success",
          text: `Tarama tamamlandı: ${res.totalFiles} dosya incelendi, ${res.matchedCount} dosya sistem kayıtlarıyla tam eşleşti.`,
        });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: `Tarama hatası: ${err.message}` });
    } finally {
      setScanning(false);
    }
  }

  async function handleReconcileSelected() {
    if (!scanResult) return;
    setReconciling(true);
    setMessage(null);
    try {
      const itemsToReconcile: ReconcileMatchItem[] = [];

      scanResult.files.forEach((f) => {
        if (!selectedFilesToReconcile[f.filename]) return;

        const manual = manualAssignments[f.filename];
        if (manual && manual.targetId) {
          itemsToReconcile.push({
            filename: f.filename,
            kind: f.kind,
            targetType: manual.targetType,
            targetId: manual.targetId,
            fieldName: manual.fieldName,
          });
        } else if (f.matchedEntity) {
          itemsToReconcile.push({
            filename: f.filename,
            kind: f.kind,
            targetType: f.matchedEntity.type,
            targetId: f.matchedEntity.id,
            fieldName: f.matchedEntity.fieldName,
          });
        }
      });

      if (itemsToReconcile.length === 0) {
        setMessage({ type: "error", text: "Lütfen sisteme bağlanacak en az bir dosya seçin." });
        setReconciling(false);
        return;
      }

      const res = await reconcileStorageFiles(itemsToReconcile);
      setMessage({
        type: "success",
        text: `🎉 ${res.attachedCount} adet PDF dokümanı sistemdeki ilgili hammadde, parça ve partilere başarıyla bağlandı!`,
      });

      // Refresh scan
      handleScan(selectedScanKind);
    } catch (err: any) {
      setMessage({ type: "error", text: `Eşleştirme aktarımı sırasında hata: ${err.message}` });
    } finally {
      setReconciling(false);
    }
  }

  function formatBytes(bytes: number) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const dm = 1;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }

  const filteredScanFiles = (scanResult?.files || []).filter((f) => {
    if (scanFilter === "exact" && f.matchStatus !== "exact") return false;
    if (scanFilter === "suggested" && f.matchStatus !== "suggested") return false;
    if (scanFilter === "unmatched" && f.matchStatus !== "unmatched") return false;
    if (scanSearch.trim()) {
      const s = scanSearch.toLowerCase();
      const matchName = f.filename.toLowerCase().includes(s);
      const matchEntity = f.matchedEntity?.name.toLowerCase().includes(s) || false;
      const matchCode = f.matchedEntity?.code.toLowerCase().includes(s) || false;
      if (!matchName && !matchEntity && !matchCode) return false;
    }
    return true;
  });

  const selectedCount = Object.values(selectedFilesToReconcile).filter(Boolean).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header & Description */}
      <div className="panel" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}>
              <span>📂</span> Belge & PDF Dizin Konumları Yönetimi
            </h3>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
              MSDS, TDS, CoA ve Rapor dosyalarının bilgisayarınızda hangi klasörlerde saklanacağını belirleyin.
              Klasördeki mevcut dosyaları sistem kayıtları ile otomatik tarayıp eşleştirebilirsiniz.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn-secondary"
              disabled={loading || scanning}
              onClick={loadData}
              style={{ fontSize: 13, padding: "8px 14px" }}
            >
              🔄 Yenile
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={saving || loading}
              onClick={handleSavePaths}
              style={{ fontSize: 13, padding: "8px 16px" }}
            >
              {saving ? "Kaydediliyor..." : "💾 Konumları Kaydet"}
            </button>
          </div>
        </div>

        {/* Bilgilendirme ve Rehber Kutusu */}
        <div
          style={{
            marginTop: 14,
            padding: "12px 16px",
            borderRadius: 8,
            backgroundColor: "rgba(59, 130, 246, 0.08)",
            border: "1px solid rgba(59, 130, 246, 0.25)",
            fontSize: 12.5,
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 700, color: "#3b82f6", display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span>ℹ️</span> Klasör Seçimi Nasıl Çalışır?
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-color)" }}>
            <li>
              <strong>Bilgisayarınızda (localhost:3000):</strong> Program doğrudan Windows disklerinize erişir. İstediğiniz klasör yolunu (Örn: <code>C:\GKYS_Arsiv\MSDS</code> veya ağ sürücüsü <code>Z:\Fabrika\TDS</code>) belirleyebilir veya <strong>"📁 Gözat"</strong> ile seçebilirsiniz.
            </li>
            <li>
              <strong>Şu anki Bulut Önizlemede:</strong> Tarayıcı güvenlik kısıtlamaları nedeniyle yerel sabit diskinize doğrudan klasör açılamaz; ancak dilediğiniz klasör şablonlarını buraya yazıp kaydedebilirsiniz. Programı bilgisayarınıza indirip <code>KURULUM_VE_BASLAT.bat</code> ile çalıştırdığınızda girdiğiniz tüm Windows klasörleri anında aktif olur.
            </li>
            <li>
              <strong>Hızlı Kurulum:</strong> Aşağıdaki <em>"Toplu Kök Dizin Belirle"</em> aracını kullanarak tek tıkla tüm alt kategorilere klasör atayabilirsiniz.
            </li>
          </ul>
        </div>

        {/* Toplu Kök Klasör Belirleyici */}
        <div
          style={{
            marginTop: 16,
            padding: "14px 16px",
            borderRadius: 8,
            backgroundColor: "var(--panel-bg)",
            border: "1px solid var(--panel-border)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              <span>⚡</span> Hızlı Kurulum: Ana Arşiv Kök Klasörü Belirle
            </span>
            <span className="muted" style={{ fontSize: 11 }}>
              Tüm MSDS, TDS, COA alt klasörlerini tek tıkla bu ana dizin altına bağlar
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Örn: C:\GKYS_Arsiv veya D:\Belgeler"
              value={rootBatchPath}
              onChange={(e) => setRootBatchPath(e.target.value)}
              style={{ flex: 1, minWidth: 240, fontSize: 13, fontFamily: "monospace", padding: "6px 10px" }}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => handleBrowseDirectory()}
              style={{ fontSize: 12, padding: "6px 12px", display: "flex", alignItems: "center", gap: 4 }}
              title="Bilgisayarınızdan klasör seçer"
            >
              📁 Klasör Seç (Gözat)
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => applyBatchRoot(rootBatchPath)}
              style={{ fontSize: 12, padding: "6px 14px", fontWeight: 600 }}
            >
              ⚡ Tüm Alt Klasörleri Ata
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 11 }}>
            <span className="muted">Hızlı Şablonlar:</span>
            <button
              type="button"
              className="btn-secondary btn-small"
              onClick={() => {
                setRootBatchPath("C:\\GKYS_Arsiv");
                applyBatchRoot("C:\\GKYS_Arsiv");
              }}
              style={{ fontSize: 11, padding: "2px 8px" }}
            >
              C:\GKYS_Arsiv
            </button>
            <button
              type="button"
              className="btn-secondary btn-small"
              onClick={() => {
                setRootBatchPath("D:\\B_R_Levent\\Arsiv");
                applyBatchRoot("D:\\B_R_Levent\\Arsiv");
              }}
              style={{ fontSize: 11, padding: "2px 8px" }}
            >
              D:\B_R_Levent\Arsiv
            </button>
            <button
              type="button"
              className="btn-secondary btn-small"
              onClick={() => {
                setRootBatchPath("C:\\Fabrika_Kalite_Belgeleri");
                applyBatchRoot("C:\\Fabrika_Kalite_Belgeleri");
              }}
              style={{ fontSize: 11, padding: "2px 8px" }}
            >
              C:\Fabrika_Kalite_Belgeleri
            </button>
            <button
              type="button"
              className="btn-secondary btn-small"
              onClick={() => {
                const emptyAll: Record<string, string> = {};
                if (paths) {
                  Object.keys(paths).forEach((k) => (emptyAll[k] = ""));
                }
                setEditedPaths(emptyAll);
                setMessage({ type: "info", text: "Tüm konumlar varsayılan iç depolama klasörlerine sıfırlandı." });
              }}
              style={{ fontSize: 11, padding: "2px 8px" }}
            >
              ↺ Varsayılan İç Klasörlere Sıfırla
            </button>
          </div>
        </div>

        {message && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 14px",
              borderRadius: 6,
              fontSize: 13,
              backgroundColor:
                message.type === "success"
                  ? "rgba(16, 185, 129, 0.15)"
                  : message.type === "info"
                  ? "rgba(59, 130, 246, 0.15)"
                  : "rgba(239, 68, 68, 0.15)",
              color:
                message.type === "success"
                  ? "var(--ok, #10b981)"
                  : message.type === "info"
                  ? "#3b82f6"
                  : "var(--ng, #ef4444)",
              border: `1px solid ${
                message.type === "success" ? "#10b981" : message.type === "info" ? "#3b82f6" : "#ef4444"
              }`,
            }}
          >
            {message.text}
          </div>
        )}
      </div>

      {/* Directory Settings Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
        {paths &&
          Object.entries(paths).map(([key, conf]) => {
            const currentVal = editedPaths[key] ?? conf.path ?? "";
            const isCustom = Boolean(currentVal && currentVal.trim());
            const icon = CATEGORY_ICONS[key] || "📁";

            return (
              <div
                key={key}
                className="panel"
                style={{
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 12,
                  border: isCustom ? "1px solid var(--accent, #3b82f6)" : "1px solid var(--panel-border)",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <h4 style={{ margin: 0, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>{icon}</span> {conf.label}
                    </h4>
                    {conf.exists ? (
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 12,
                          backgroundColor: "rgba(16, 185, 129, 0.15)",
                          color: "#10b981",
                          fontWeight: 600,
                        }}
                      >
                        🟢 {conf.fileCount} Dosya ({formatBytes(conf.totalSizeBytes)})
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 12,
                          backgroundColor: "rgba(245, 158, 11, 0.15)",
                          color: "#f59e0b",
                          fontWeight: 600,
                        }}
                      >
                        🟡 Klasör Yok
                      </span>
                    )}
                  </div>

                  <p className="muted" style={{ margin: "0 0 10px", fontSize: 12, lineHeight: 1.4 }}>
                    {conf.description}
                  </p>

                  <label style={{ fontSize: 12, fontWeight: 600 }}>
                    Klasör Yolu (Windows Konumu)
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <input
                        type="text"
                        placeholder={`Örn: C:\\GKYS_Arsiv\\${key.toUpperCase()} (veya boş bırakın: ${conf.defaultPath})`}
                        value={currentVal}
                        onChange={(e) => setEditedPaths({ ...editedPaths, [key]: e.target.value })}
                        style={{ flex: 1, fontSize: 12, fontFamily: "monospace" }}
                      />
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => handleBrowseDirectory(key)}
                        style={{ fontSize: 11, padding: "4px 8px", whiteSpace: "nowrap" }}
                        title="Bilgisayarınızdan klasör seçin"
                      >
                        📁 Gözat
                      </button>
                    </div>
                  </label>
                  <p className="muted" style={{ fontSize: 11, margin: "4px 0 0" }}>
                    Aktif Yol: <code style={{ fontSize: 11 }}>{conf.resolvedPath}</code>
                  </p>
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", paddingTop: 8, borderTop: "1px solid var(--panel-border)" }}>
                  {!conf.exists && currentVal.trim() && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleCreateFolder(currentVal.trim())}
                      style={{ fontSize: 11, padding: "4px 8px" }}
                    >
                      ➕ Klasör Oluştur
                    </button>
                  )}
                  {isCustom && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setEditedPaths({ ...editedPaths, [key]: "" })}
                      style={{ fontSize: 11, padding: "4px 8px" }}
                      title="Varsayılan iç klasöre sıfırlar"
                    >
                      ↺ Sıfırla
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={scanning}
                    onClick={() => {
                      setSelectedScanKind(key);
                      handleScan(key);
                    }}
                    style={{ fontSize: 11, padding: "4px 10px", fontWeight: 600 }}
                  >
                    🔍 Bu Klasörü Tara
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {/* Auto-Scan & Reconciliation Engine Section */}
      <div className="panel" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <span>🔍</span> Mevcut Dosyaları Tara ve Sistem Kayıtlarıyla Eşleştir
            </h3>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
              Bilgisayarınızda veya sunucunuzdaki PDF/doküman dosyalarını analiz eder; Malzeme Kodu, Parça Kodu veya Lot Numarası ile otomatik eşleştirir.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select
              value={selectedScanKind}
              onChange={(e) => setSelectedScanKind(e.target.value)}
              style={{ fontSize: 13, padding: "6px 10px", minWidth: 160 }}
            >
              <option value="all">🌐 Tüm Konumları Tara</option>
              <option value="msds">🧪 MSDS Klasörü</option>
              <option value="tds">📋 TDS Klasörü</option>
              <option value="coa">📜 COA Klasörü</option>
              <option value="yardimciParca">🔩 Yardımcı Parça Klasörü</option>
              <option value="kaliteRaporlari">🔬 Kalite Raporları</option>
              <option value="genel">📁 Genel Arşiv</option>
            </select>
            <button
              type="button"
              className="btn-primary"
              disabled={scanning}
              onClick={() => handleScan(selectedScanKind)}
              style={{ fontSize: 13, padding: "7px 16px" }}
            >
              {scanning ? "🔍 Taranıyor..." : "🚀 Taramayı Başlat"}
            </button>
          </div>
        </div>

        {/* Scan Results Summary Cards */}
        {scanResult && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  backgroundColor: "var(--panel-bg)",
                  border: "1px solid var(--panel-border)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 700 }}>{scanResult.totalFiles}</div>
                <div className="muted" style={{ fontSize: 12 }}>Toplam Bulunan Dosya</div>
              </div>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  backgroundColor: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 700, color: "#10b981" }}>{scanResult.matchedCount}</div>
                <div style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>✅ Tam Eşleşen</div>
              </div>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  backgroundColor: "rgba(245, 158, 11, 0.1)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 700, color: "#f59e0b" }}>{scanResult.suggestedCount}</div>
                <div style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>💡 Olası / Kısmi Eşleşen</div>
              </div>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  backgroundColor: "rgba(107, 114, 128, 0.1)",
                  border: "1px solid var(--panel-border)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--muted)" }}>{scanResult.unmatchedCount}</div>
                <div className="muted" style={{ fontSize: 12 }}>❓ Eşleşmeyen</div>
              </div>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  backgroundColor: "rgba(59, 130, 246, 0.1)",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 700, color: "#3b82f6" }}>{scanResult.alreadyAttachedCount}</div>
                <div style={{ fontSize: 12, color: "#3b82f6", fontWeight: 600 }}>🔗 Zaten Sisteme Bağlı</div>
              </div>
            </div>

            {/* Filter and Bulk Action Toolbar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Filtrele:</span>
                {(["all", "exact", "suggested", "unmatched"] as const).map((fKey) => (
                  <button
                    key={fKey}
                    type="button"
                    className={scanFilter === fKey ? "btn-primary" : "btn-secondary"}
                    onClick={() => setScanFilter(fKey)}
                    style={{ fontSize: 12, padding: "4px 10px" }}
                  >
                    {fKey === "all"
                      ? `Tümü (${scanResult.files.length})`
                      : fKey === "exact"
                      ? `Tam Eşleşen (${scanResult.matchedCount})`
                      : fKey === "suggested"
                      ? `Olası (${scanResult.suggestedCount})`
                      : `Eşleşmeyen (${scanResult.unmatchedCount})`}
                  </button>
                ))}
                <input
                  type="text"
                  placeholder="Dosya veya kayıt adı ara..."
                  value={scanSearch}
                  onChange={(e) => setScanSearch(e.target.value)}
                  style={{ fontSize: 12, padding: "4px 8px", width: 180 }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const allChecked: Record<string, boolean> = {};
                    filteredScanFiles.forEach((f) => {
                      if (!f.isAlreadyAttached && (f.matchedEntity || manualAssignments[f.filename])) {
                        allChecked[f.filename] = true;
                      }
                    });
                    setSelectedFilesToReconcile(allChecked);
                  }}
                  style={{ fontSize: 12, padding: "6px 10px" }}
                >
                  Tüm Eşleşenleri Seç
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSelectedFilesToReconcile({})}
                  style={{ fontSize: 12, padding: "6px 10px" }}
                >
                  Seçimi Temizle
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={reconciling || selectedCount === 0}
                  onClick={handleReconcileSelected}
                  style={{ fontSize: 12, padding: "6px 14px", fontWeight: 700, backgroundColor: "#10b981" }}
                >
                  {reconciling ? "Aktarılıyor..." : `🚀 ${selectedCount} Dosyayı Sisteme Bağla`}
                </button>
              </div>
            </div>

            {/* Scanned Files Table */}
            <div style={{ overflowX: "auto", border: "1px solid var(--panel-border)", borderRadius: 6 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--panel-bg)", borderBottom: "1px solid var(--panel-border)" }}>
                    <th style={{ padding: "8px 10px", width: 36, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={filteredScanFiles.length > 0 && filteredScanFiles.every((f) => selectedFilesToReconcile[f.filename])}
                        onChange={(e) => {
                          const updated = { ...selectedFilesToReconcile };
                          filteredScanFiles.forEach((f) => {
                            if (!f.isAlreadyAttached && (f.matchedEntity || manualAssignments[f.filename])) {
                              updated[f.filename] = e.target.checked;
                            }
                          });
                          setSelectedFilesToReconcile(updated);
                        }}
                      />
                    </th>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>Dosya Adı & Boyut</th>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>Kategori</th>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>Eşleşme Durumu</th>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>Eşleşen Sistem Kaydı</th>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>Hedef Alan</th>
                    <th style={{ padding: "8px 10px", textAlign: "center" }}>Görüntüle</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScanFiles.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 24, textAlign: "center" }} className="muted">
                        Kriterlere uygun dosya bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    filteredScanFiles.map((file) => {
                      const isSelected = Boolean(selectedFilesToReconcile[file.filename]);
                      const currentMatch = manualAssignments[file.filename] || file.matchedEntity;

                      return (
                        <tr
                          key={file.filename}
                          style={{
                            borderBottom: "1px solid var(--panel-border)",
                            backgroundColor: file.isAlreadyAttached
                              ? "rgba(59, 130, 246, 0.04)"
                              : isSelected
                              ? "rgba(16, 185, 129, 0.08)"
                              : "transparent",
                          }}
                        >
                          <td style={{ padding: "8px 10px", textAlign: "center" }}>
                            <input
                              type="checkbox"
                              disabled={file.isAlreadyAttached || (!file.matchedEntity && !manualAssignments[file.filename])}
                              checked={isSelected}
                              onChange={(e) =>
                                setSelectedFilesToReconcile({
                                  ...selectedFilesToReconcile,
                                  [file.filename]: e.target.checked,
                                })
                              }
                            />
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <div style={{ fontWeight: 600, wordBreak: "break-all" }}>{file.filename}</div>
                            <div className="muted" style={{ fontSize: 11 }}>
                              {formatBytes(file.sizeBytes)} · {formatDateTR(file.mtime)}
                            </div>
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, backgroundColor: "var(--panel-bg)" }}>
                              {CATEGORY_ICONS[file.kind] || "📁"} {file.kind}
                            </span>
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            {file.isAlreadyAttached ? (
                              <span style={{ color: "#3b82f6", fontWeight: 600 }}>🔗 Zaten Bağlı</span>
                            ) : file.matchStatus === "exact" ? (
                              <span style={{ color: "#10b981", fontWeight: 600 }}>
                                ✅ Tam Eşleşti ({file.matchedEntity?.confidenceScore}%)
                              </span>
                            ) : file.matchStatus === "suggested" ? (
                              <span style={{ color: "#f59e0b", fontWeight: 600 }}>
                                💡 Olası ({file.matchedEntity?.confidenceScore}%)
                              </span>
                            ) : (
                              <span className="muted">❓ Eşleşmedi</span>
                            )}
                            {file.matchedEntity?.matchReason && (
                              <div className="muted" style={{ fontSize: 10 }}>
                                {file.matchedEntity.matchReason}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            {file.possibleCandidates && file.possibleCandidates.length > 1 ? (
                              <select
                                value={
                                  manualAssignments[file.filename]
                                    ? `${manualAssignments[file.filename].targetType}:${manualAssignments[file.filename].targetId}`
                                    : file.matchedEntity
                                    ? `${file.matchedEntity.type}:${file.matchedEntity.id}`
                                    : ""
                                }
                                onChange={(e) => {
                                  const [type, id] = e.target.value.split(":");
                                  const cand = file.possibleCandidates?.find((c) => c.type === type && c.id === id);
                                  if (cand) {
                                    setManualAssignments({
                                      ...manualAssignments,
                                      [file.filename]: {
                                        targetType: cand.type,
                                        targetId: cand.id,
                                        fieldName: cand.fieldName as any,
                                      },
                                    });
                                    setSelectedFilesToReconcile({
                                      ...selectedFilesToReconcile,
                                      [file.filename]: true,
                                    });
                                  }
                                }}
                                style={{ fontSize: 11, padding: "2px 6px", maxWidth: 220 }}
                              >
                                {file.possibleCandidates.map((c) => (
                                  <option key={`${c.type}:${c.id}`} value={`${c.type}:${c.id}`}>
                                    {c.name} ({c.type})
                                  </option>
                                ))}
                              </select>
                            ) : file.matchedEntity ? (
                              <span style={{ fontWeight: 500 }}>{file.matchedEntity.name}</span>
                            ) : manualAssignments[file.filename] ? (
                              <span style={{ fontWeight: 500 }}>{manualAssignments[file.filename].targetId}</span>
                            ) : (
                              <span className="muted" style={{ fontSize: 11 }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <span style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 600 }}>
                              {manualAssignments[file.filename]?.fieldName || file.matchedEntity?.fieldName || "—"}
                            </span>
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "center" }}>
                            <a
                              href={`/uploads/${file.kind}/${encodeURIComponent(file.filename)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-secondary btn-small"
                              style={{ fontSize: 11, padding: "2px 8px", textDecoration: "none" }}
                            >
                              👁️ Aç
                            </a>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
