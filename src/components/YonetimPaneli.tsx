import { useEffect, useMemo, useState } from "react";
import { createUser, deleteUser, loadAuditLog, loadUsers, updateUser } from "../lib/usersStorage";
import type { AuditLogEntry, AuthUser, Role } from "../types";
import { FormMetadataManager } from "./FormMetadataManager";
import { StoragePathsManager } from "./StoragePathsManager";
import { formatDateTR, toIsoDate } from "../lib/dateUtils";

const ROLES: Role[] = [
  "Yönetici",
  "Giriş Kalite",
  "Depo",
  "Satın Alma",
  "Üretim",
  "Raporlama",
  "Misafir",
];

export interface PanelPermission {
  key: string;
  label: string;
  group: "Operasyon" | "Stok & Raporlama" | "Sistem Tanımları" | "Sistem & Yönetim";
  icon: string;
  desc: string;
}

export const AVAILABLE_PANELS: PanelPermission[] = [
  { key: "satinAlma", label: "Satın Alma & Siparişler", group: "Operasyon", icon: "🛒", desc: "Tedarikçi siparişleri ve PO takibi" },
  { key: "giris", label: "1. Mal Kabul", group: "Operasyon", icon: "📥", desc: "İrsaliye ve parça girişi" },
  { key: "kalite", label: "2. Kalite Kontrol", group: "Operasyon", icon: "🔬", desc: "CoA onay/red ve sertifika takibi" },
  { key: "etiket", label: "3. Etiket Basım", group: "Operasyon", icon: "🏷️", desc: "Giriş kalite barkod etiket üretimi" },
  { key: "cikis", label: "4. Depo Çıkışı (Sevkiyat)", group: "Operasyon", icon: "📤", desc: "El barkod okuyucu ile anında düşüm ve sevkiyat" },

  { key: "stok", label: "Stok Yönetimi (4 Kategori)", group: "Stok & Raporlama", icon: "📊", desc: "Görsel stok kartları ve hareketler" },
  { key: "gecmis", label: "Geçmiş / İşlem Kayıtları", group: "Stok & Raporlama", icon: "📜", desc: "Log kayıtları ve denetim izi" },

  { key: "malzeme", label: "1. Hammadde Tanımları", group: "Sistem Tanımları", icon: "🧪", desc: "Plastik granüller ve spec değerleri" },
  { key: "yardimciParca", label: "2. Yardımcı Parça Tanımları", group: "Sistem Tanımları", icon: "🔩", desc: "Civata, somun, koli, ambalaj" },
  { key: "yariMamul", label: "3. Yarı Mamül & Kalıplar", group: "Sistem Tanımları", icon: "🧩", desc: "Plastik enjeksiyon parçaları & kalıplar" },
  { key: "mamul", label: "4. Mamül Tanımları & Reçete (BOM)", group: "Sistem Tanımları", icon: "📦", desc: "Nihai montajlı ürünler & parçaları" },

  { key: "yedek", label: "Yedekleme & Veri Transferi", group: "Sistem & Yönetim", icon: "💾", desc: "Veritabanı yedekleme ve geri yükleme" },
  { key: "yonetim", label: "Yönetim Paneli", group: "Sistem & Yönetim", icon: "⚙️", desc: "Kullanıcılar, yetkiler ve form metadata" },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, string[]> = {
  "Yönetici": AVAILABLE_PANELS.map((p) => p.key),
  "Giriş Kalite": ["giris", "kalite", "etiket", "satinAlma", "stok", "malzeme", "yardimciParca", "yariMamul", "mamul", "gecmis"],
  "Depo": ["cikis", "stok", "yariMamul", "mamul", "gecmis"],
  "Satın Alma": ["satinAlma", "malzeme", "yardimciParca", "yariMamul", "mamul", "stok", "gecmis"],
  "Üretim": ["cikis", "stok", "yariMamul", "mamul"],
  "Raporlama": ["stok", "gecmis"],
  "Misafir": ["stok"],
};

export default function YonetimPaneli({ currentUser }: { currentUser: AuthUser }) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Tree sub-panels collapsible states
  const [openSub1, setOpenSub1] = useState(true);
  const [openSub2, setOpenSub2] = useState(true);
  const [openSub3, setOpenSub3] = useState(true);
  const [openSub4, setOpenSub4] = useState(true);
  const [openSub5, setOpenSub5] = useState(true);

  // Audit log filter states
  const [logUserFilter, setLogUserFilter] = useState<string>("HEPSI");
  const [logDateFilter, setLogDateFilter] = useState<string>("");
  const [logSearch, setLogSearch] = useState<string>("");

  // New User Form State
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("Misafir");
  const [newPermissions, setNewPermissions] = useState<string[]>(DEFAULT_ROLE_PERMISSIONS["Misafir"]);
  const [busy, setBusy] = useState(false);

  // Modals State
  const [userToDelete, setUserToDelete] = useState<AuthUser | null>(null);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [editRole, setEditRole] = useState<Role>("Misafir");
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [editActive, setEditActive] = useState<boolean>(true);
  const [editPassword, setEditPassword] = useState<string>("");

  function refresh() {
    loadUsers().then(setUsers).catch((e) => setError(e.message));
    loadAuditLog(500).then(setLogs).catch(() => {});
  }

  useEffect(() => {
    refresh();
  }, []);

  const logUsers = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.user) set.add(l.user);
    });
    return Array.from(set).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (logUserFilter !== "HEPSI" && l.user !== logUserFilter) {
        return false;
      }
      if (logDateFilter) {
        try {
          const logDateStr = new Date(l.date).toISOString().slice(0, 10);
          if (logDateStr !== logDateFilter) return false;
        } catch {
          // ignore date parse errors
        }
      }
      if (logSearch.trim()) {
        const q = logSearch.toLowerCase().trim();
        const actionMatch = l.action?.toLowerCase().includes(q);
        const noteMatch = l.note?.toLowerCase().includes(q);
        const userMatch = l.user?.toLowerCase().includes(q);
        if (!actionMatch && !noteMatch && !userMatch) return false;
      }
      return true;
    });
  }, [logs, logUserFilter, logDateFilter, logSearch]);

  // Update new permissions preset when new role changes
  function handleNewRoleChange(role: Role) {
    setNewRole(role);
    setNewPermissions(DEFAULT_ROLE_PERMISSIONS[role] || []);
  }

  function toggleNewPermission(key: string) {
    setNewPermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function toggleEditPermission(key: string) {
    setEditPermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await createUser({
        username: newUsername.trim(),
        password: newPassword,
        role: newRole,
        permissions: newPermissions,
      });
      setUsers(updated);
      setNewUsername("");
      setNewPassword("");
      setNewRole("Misafir");
      setNewPermissions(DEFAULT_ROLE_PERMISSIONS["Misafir"]);
      setSuccess(`"${newUsername.trim()}" kullanıcısı başarıyla eklendi.`);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kullanıcı oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  }

  function openEditUserModal(user: AuthUser) {
    setEditingUser(user);
    setEditRole(user.role);
    setEditActive(user.active);
    setEditPermissions(
      user.permissions && user.permissions.length > 0
        ? user.permissions
        : DEFAULT_ROLE_PERMISSIONS[user.role] || []
    );
    setEditPassword("");
    setError(null);
  }

  async function handleSaveEditUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const patch: any = {
        role: editRole,
        active: editActive,
        permissions: editPermissions,
      };
      if (editPassword.trim()) {
        patch.password = editPassword.trim();
      }
      const updated = await updateUser(editingUser.id, patch);
      setUsers(updated);
      setEditingUser(null);
      setSuccess(`"${editingUser.username}" kullanıcısının yetkileri ve bilgileri güncellendi.`);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kullanıcı güncellenemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(user: AuthUser) {
    setError(null);
    try {
      const updated = await updateUser(user.id, { active: !user.active });
      setUsers(updated);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Güncellenemedi.");
    }
  }

  async function handleConfirmDelete() {
    if (!userToDelete) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await deleteUser(userToDelete.id);
      setUsers(updated);
      setSuccess(`"${userToDelete.username}" kullanıcısı silindi.`);
      setUserToDelete(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silinemedi.");
    } finally {
      setBusy(false);
    }
  }

  const groups: Array<"Operasyon" | "Stok & Raporlama" | "Sistem Tanımları" | "Sistem & Yönetim"> = [
    "Operasyon",
    "Stok & Raporlama",
    "Sistem Tanımları",
    "Sistem & Yönetim",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Global Error & Success Notification */}
      {error && (
        <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#f87171", padding: "10px 14px", borderRadius: 8, fontSize: "0.9rem" }}>
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid #10b981", color: "#34d399", padding: "10px 14px", borderRadius: 8, fontSize: "0.9rem" }}>
          ✅ {success}
        </div>
      )}

      {/* Ana Panel Kök Başlığı */}
      <div className="panel" style={{ borderLeft: "4px solid var(--accent, #ff8a3d)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <span>⚙️</span> Yönetim Paneli — (Ana Yönetim Merkezi)
            </h2>
            <p className="muted" style={{ margin: "4px 0 0 0", fontSize: "0.88rem" }}>
              Sistem kullanıcıları, modül erişim izinleri, IATF doküman standartları ve denetim kayıtları hiyerarşik ağaç yapısı.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn-secondary btn-small"
              onClick={() => { setOpenSub1(true); setOpenSub2(true); setOpenSub3(true); setOpenSub4(true); setOpenSub5(true); }}
            >
              📂 Tüm Dalları Aç
            </button>
            <button
              type="button"
              className="btn-secondary btn-small"
              onClick={() => { setOpenSub1(false); setOpenSub2(false); setOpenSub3(false); setOpenSub4(false); setOpenSub5(false); }}
            >
              📁 Tüm Dalları Kapat
            </button>
          </div>
        </div>
      </div>

      {/* Hiyerarşik Ağaç Dalları Konteynırı */}
      <div style={{ position: "relative", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Dikey Ağaç Dal Çizgisi */}
        <div
          style={{
            position: "absolute",
            left: 8,
            top: 20,
            bottom: 30,
            width: 2,
            background: "var(--panel-border, #334155)",
            borderRadius: 2,
          }}
        />

        {/* 1. Alt Panel : Yönetim Paneli — Kullanıcılar ve Panel Yetkileri */}
        <div style={{ position: "relative" }}>
          {/* Yatay Dal Çizgisi */}
          <div
            style={{
              position: "absolute",
              left: -14,
              top: 24,
              width: 14,
              height: 2,
              background: "var(--panel-border, #334155)",
            }}
          />
          <div className="panel" style={{ margin: 0 }}>
            <div
              onClick={() => setOpenSub1(!openSub1)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: "1.05rem" }}>👥 Yönetim Paneli — Kullanıcılar ve Panel Yetkileri</h3>
                <span className="badge-ok" style={{ fontSize: "0.78rem" }}>
                  {users.length} Kullanıcı Kayıtlı
                </span>
              </div>
              <button type="button" className="btn-secondary btn-small">
                {openSub1 ? "▲ Gizle" : "▼ Göster"}
              </button>
            </div>

            {openSub1 && (
              <div style={{ marginTop: 16, borderTop: "1px solid var(--panel-border)", paddingTop: 16, overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Kullanıcı Adı</th>
                      <th>Ana Rol</th>
                      <th>Açık Paneller / İzinler</th>
                      <th>Durum</th>
                      <th>Kayıt Tarihi</th>
                      <th style={{ textAlign: "right" }}>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const effectivePerms =
                        u.permissions && u.permissions.length > 0
                          ? u.permissions
                          : DEFAULT_ROLE_PERMISSIONS[u.role] || [];
                      const isCustom = u.permissions && u.permissions.length > 0;

                      return (
                        <tr key={u.id}>
                          <td>
                            <strong>{u.username}</strong>
                            {u.id === currentUser.id && (
                              <span className="badge-info" style={{ marginLeft: 6, fontSize: "0.75rem" }}>
                                Siz
                              </span>
                            )}
                          </td>
                          <td>
                            <span className="badge-ok" style={{ fontSize: "0.82rem" }}>
                              {u.role}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxWidth: 380 }}>
                              {effectivePerms.length === AVAILABLE_PANELS.length ? (
                                <span className="badge-ok" style={{ fontSize: "0.78rem" }}>
                                  🌐 Tüm Paneller (Tam Yetkili)
                                </span>
                              ) : (
                                effectivePerms.map((pKey) => {
                                  const pObj = AVAILABLE_PANELS.find((ap) => ap.key === pKey);
                                  return (
                                    <span
                                      key={pKey}
                                      style={{
                                        background: "rgba(255,255,255,0.06)",
                                        border: "1px solid var(--panel-border, #334155)",
                                        padding: "2px 6px",
                                        borderRadius: 4,
                                        fontSize: "0.76rem",
                                      }}
                                      title={pObj?.desc || pKey}
                                    >
                                      {pObj?.icon || "📌"} {pObj?.label || pKey}
                                    </span>
                                  );
                                })
                              )}
                              {isCustom && (
                                <span
                                  style={{
                                    fontSize: "0.72rem",
                                    color: "var(--accent, #3b82f6)",
                                    fontWeight: 600,
                                    padding: "2px 4px",
                                  }}
                                >
                                  (Özel İzin)
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className={u.active ? "tag-ok" : "tag-ng"}>
                              {u.active ? "Aktif" : "Pasif"}
                            </span>
                          </td>
                          <td className="muted" style={{ fontSize: "0.85rem" }}>
                            {formatDateTR(u.createdAt)}
                          </td>
                          <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                            <button
                              type="button"
                              className="btn-secondary btn-small"
                              style={{ marginRight: 6 }}
                              onClick={() => openEditUserModal(u)}
                            >
                              ✏️ Yetkileri Düzenle
                            </button>
                            <button
                              type="button"
                              className="btn-secondary btn-small"
                              style={{ marginRight: 6 }}
                              onClick={() => handleToggleActive(u)}
                              disabled={u.id === currentUser.id}
                            >
                              {u.active ? "Pasife Al" : "Aktifleştir"}
                            </button>
                            <button
                              type="button"
                              className="btn-danger btn-small"
                              onClick={() => setUserToDelete(u)}
                              disabled={u.id === currentUser.id}
                              title="Kullanıcıyı Sil"
                            >
                              Sil
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* 2. Alt Panel : ➕ Yeni Kullanıcı ve Panel Yetkileri Tanımla */}
        <div style={{ position: "relative" }}>
          {/* Yatay Dal Çizgisi */}
          <div
            style={{
              position: "absolute",
              left: -14,
              top: 24,
              width: 14,
              height: 2,
              background: "var(--panel-border, #334155)",
            }}
          />
          <div className="panel" style={{ margin: 0 }}>
            <div
              onClick={() => setOpenSub2(!openSub2)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: "1.05rem" }}>➕ Yeni Kullanıcı ve Panel Yetkileri Tanımla</h3>
              </div>
              <button type="button" className="btn-secondary btn-small">
                {openSub2 ? "▲ Gizle" : "▼ Göster"}
              </button>
            </div>

            {openSub2 && (
              <div style={{ marginTop: 16, borderTop: "1px solid var(--panel-border)", paddingTop: 16 }}>
                <form onSubmit={handleCreate} style={{ display: "grid", gap: 16 }}>
                  <div className="grid3" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <label>
                      <span style={{ fontWeight: 600 }}>Kullanıcı Adı *</span>
                      <input
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="ör: ahmet.yilmaz"
                        style={{ width: "100%", marginTop: 4 }}
                        required
                      />
                    </label>
                    <label>
                      <span style={{ fontWeight: 600 }}>Şifre *</span>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        style={{ width: "100%", marginTop: 4 }}
                        required
                      />
                    </label>
                    <label>
                      <span style={{ fontWeight: 600 }}>Varsayılan Şablon Rol *</span>
                      <select
                        value={newRole}
                        onChange={(e) => handleNewRoleChange(e.target.value as Role)}
                        style={{ width: "100%", marginTop: 4 }}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Panel Seçim Detayları */}
                  <div
                    style={{
                      border: "1px solid var(--panel-border)",
                      borderRadius: 8,
                      padding: 14,
                      background: "rgba(0, 0, 0, 0.2)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <strong style={{ fontSize: "0.95rem" }}>🔐 Erişebileceği Paneller & Modüller</strong>
                        <p className="muted" style={{ margin: "2px 0 0 0", fontSize: "0.8rem" }}>
                          Kullanıcının giriş yaptığında görebileceği ve işlem yapabileceği sekmeleri tek tek belirleyebilirsiniz.
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          className="btn-secondary btn-small"
                          onClick={() => setNewPermissions(AVAILABLE_PANELS.map((p) => p.key))}
                        >
                          Tümünü Seç
                        </button>
                        <button
                          type="button"
                          className="btn-secondary btn-small"
                          onClick={() => setNewPermissions([])}
                        >
                          Temizle
                        </button>
                        <button
                          type="button"
                          className="btn-secondary btn-small"
                          onClick={() => setNewPermissions(DEFAULT_ROLE_PERMISSIONS[newRole] || [])}
                        >
                          Role Sıfırla
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      {groups.map((groupName) => {
                        const groupPanels = AVAILABLE_PANELS.filter((p) => p.group === groupName);
                        return (
                          <div
                            key={groupName}
                            style={{
                              background: "rgba(255,255,255,0.03)",
                              border: "1px solid var(--panel-border)",
                              borderRadius: 8,
                              padding: 10,
                            }}
                          >
                            <h4 style={{ margin: "0 0 8px 0", fontSize: "0.85rem", color: "var(--accent)" }}>
                              {groupName}
                            </h4>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {groupPanels.map((p) => {
                                const checked = newPermissions.includes(p.key);
                                return (
                                  <label
                                    key={p.key}
                                    style={{
                                      display: "flex",
                                      alignItems: "flex-start",
                                      gap: 10,
                                      cursor: "pointer",
                                      fontSize: "0.83rem",
                                      padding: "6px 8px",
                                      borderRadius: "6px",
                                      background: checked ? "rgba(59, 130, 246, 0.12)" : "rgba(255, 255, 255, 0.03)",
                                      border: checked ? "1px solid rgba(59, 130, 246, 0.35)" : "1px solid transparent",
                                      userSelect: "none",
                                      transition: "all 0.15s ease",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleNewPermission(p.key)}
                                      style={{ marginTop: 2, width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
                                    />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontWeight: 600, color: checked ? "#60a5fa" : "inherit" }}>
                                        {p.icon} {p.label}
                                      </div>
                                      <div className="muted" style={{ fontSize: "0.75rem", marginTop: 2 }}>
                                        {p.desc}
                                      </div>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button type="submit" className="btn-primary" disabled={busy}>
                      ➕ Kullanıcıyı ve Yetkileri Kaydet
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* 3. Alt Panel : 📋 IATF 16949 Form ve Doküman Numaraları Yönetimi */}
        <div style={{ position: "relative" }}>
          {/* Yatay Dal Çizgisi */}
          <div
            style={{
              position: "absolute",
              left: -14,
              top: 24,
              width: 14,
              height: 2,
              background: "var(--panel-border, #334155)",
            }}
          />
          <div className="panel" style={{ margin: 0 }}>
            <div
              onClick={() => setOpenSub3(!openSub3)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: "1.05rem" }}>📋 IATF 16949 Form ve Doküman Numaraları Yönetimi</h3>
              </div>
              <button type="button" className="btn-secondary btn-small">
                {openSub3 ? "▲ Gizle" : "▼ Göster"}
              </button>
            </div>

            {openSub3 && (
              <div style={{ marginTop: 12, borderTop: "1px solid var(--panel-border)", paddingTop: 12 }}>
                <FormMetadataManager />
              </div>
            )}
          </div>
        </div>

        {/* 4. Alt Panel : 📂 Belge & Dizin Konumları Yönetimi (MSDS, TDS, COA Arşivi ve Otomatik Eşleştirme) */}
        <div style={{ position: "relative" }}>
          {/* Yatay Dal Çizgisi */}
          <div
            style={{
              position: "absolute",
              left: -14,
              top: 24,
              width: 14,
              height: 2,
              background: "var(--panel-border, #334155)",
            }}
          />
          <div className="panel" style={{ margin: 0 }}>
            <div
              onClick={() => setOpenSub4(!openSub4)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: "1.05rem" }}>
                  📂 Belge & PDF Dizin Konumları (MSDS, TDS, COA ve Otomatik Eşleştirme)
                </h3>
                <span className="badge-info" style={{ fontSize: "0.78rem" }}>
                  Özel Klasör Seçimi & Akıllı Dosya Tarama
                </span>
              </div>
              <button type="button" className="btn-secondary btn-small">
                {openSub4 ? "▲ Gizle" : "▼ Göster"}
              </button>
            </div>

            {openSub4 && (
              <div style={{ marginTop: 16, borderTop: "1px solid var(--panel-border)", paddingTop: 16 }}>
                <StoragePathsManager />
              </div>
            )}
          </div>
        </div>

        {/* 5. Alt Panel : İşlem Kayıtları (Audit Log) */}
        <div style={{ position: "relative" }}>
          {/* Yatay Dal Çizgisi */}
          <div
            style={{
              position: "absolute",
              left: -14,
              top: 24,
              width: 14,
              height: 2,
              background: "var(--panel-border, #334155)",
            }}
          />
          <div className="panel" style={{ margin: 0 }}>
            <div
              onClick={() => setOpenSub5(!openSub5)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: "1.05rem" }}>📜 İşlem Kayıtları (Audit Log)</h3>
                <span className="badge-info" style={{ fontSize: "0.78rem" }}>
                  Maksimum Son 500 İşlem ({logs.length} Kayıt Yüklendi)
                </span>
              </div>
              <button type="button" className="btn-secondary btn-small">
                {openSub5 ? "▲ Gizle" : "▼ Göster"}
              </button>
            </div>

            {openSub5 && (
              <div style={{ marginTop: 16, borderTop: "1px solid var(--panel-border)", paddingTop: 16 }}>
                {/* Filtre Barı */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    alignItems: "center",
                    marginBottom: 14,
                    background: "rgba(0, 0, 0, 0.2)",
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid var(--panel-border)",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>👤 Kullanıcı Filtresi</span>
                    <select
                      value={logUserFilter}
                      onChange={(e) => setLogUserFilter(e.target.value)}
                      style={{ minWidth: 160, padding: "6px 8px" }}
                    >
                      <option value="HEPSI">Tüm Kullanıcılar ({logs.length})</option>
                      {logUsers.map((usr) => (
                        <option key={usr} value={usr}>
                          {usr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>📅 Tarih Filtresi</span>
                    <input
                      type="text"
                      placeholder="GG/AA/YYYY"
                      value={formatDateTR(logDateFilter)}
                      onChange={(e) => setLogDateFilter(toIsoDate(e.target.value))}
                      style={{ padding: "5px 8px" }}
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 200 }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>🔍 İşlem / Not Arama</span>
                    <input
                      type="text"
                      placeholder="İşlem adı, modül veya not yazın..."
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      style={{ padding: "6px 10px", width: "100%" }}
                    />
                  </div>

                  {(logUserFilter !== "HEPSI" || logDateFilter || logSearch) && (
                    <button
                      type="button"
                      className="btn-secondary btn-small"
                      onClick={() => {
                        setLogUserFilter("HEPSI");
                        setLogDateFilter("");
                        setLogSearch("");
                      }}
                      style={{ alignSelf: "flex-end", marginBottom: 2 }}
                    >
                      🧹 Filtreleri Temizle
                    </button>
                  )}
                </div>

                {/* Bilgi ve Sayım Metni */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem", marginBottom: 10, flexWrap: "wrap", gap: 8 }} className="muted">
                  <span>Listelenen: <strong>{filteredLogs.length}</strong> / Toplam Yüklenen: {logs.length} (Maksimum Son 500 İşlem)</span>
                  <span>📌 Tüm sistem hareketleri ve yetki değişiklikleri günlüğe kaydedilir.</span>
                </div>

                {/* Audit Log Tablosu */}
                <div style={{ overflowX: "auto", maxHeight: 440, overflowY: "auto", border: "1px solid var(--panel-border)", borderRadius: 6 }}>
                  <table className="data-table">
                    <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--panel-bg)" }}>
                      <tr>
                        <th>Tarih & Saat</th>
                        <th>Kullanıcı</th>
                        <th>Yapılan İşlem</th>
                        <th>Açıklama / Detay Notu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: "center", padding: 24 }} className="muted">
                            Seçili filtre ve kriterlere uygun işlem kaydı bulunamadı.
                          </td>
                        </tr>
                      ) : (
                        filteredLogs.map((l) => (
                          <tr key={l.id}>
                            <td className="muted" style={{ fontSize: "0.84rem", whiteSpace: "nowrap" }}>
                              {formatDateTR(l.date)}
                            </td>
                            <td>
                              <strong>{l.user}</strong>
                            </td>
                            <td>
                              <span className="badge-info" style={{ fontSize: "0.8rem" }}>{l.action}</span>
                            </td>
                            <td className="muted" style={{ fontSize: "0.85rem" }}>
                              {l.note || "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Kullanıcı Düzenleme & Yetki Modalı */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: 740, maxHeight: "88vh", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>✏️ Kullanıcı Yetkilerini Düzenle — {editingUser.username}</h3>
              <button type="button" className="close-btn" onClick={() => setEditingUser(null)}>
                ✕
              </button>
            </div>
            <form
              onSubmit={handleSaveEditUser}
              style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}
            >
              <div
                className="modal-body"
                style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label>
                    <span style={{ fontWeight: 600 }}>Ana Rol</span>
                    <select
                      value={editRole}
                      onChange={(e) => {
                        const r = e.target.value as Role;
                        setEditRole(r);
                      }}
                      style={{ width: "100%", marginTop: 4 }}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span style={{ fontWeight: 600 }}>Kullanıcı Durumu</span>
                    <select
                      value={editActive ? "true" : "false"}
                      onChange={(e) => setEditActive(e.target.value === "true")}
                      disabled={editingUser.id === currentUser.id}
                      style={{ width: "100%", marginTop: 4 }}
                    >
                      <option value="true">Aktif</option>
                      <option value="false">Pasif</option>
                    </select>
                  </label>
                </div>

                <label>
                  <span style={{ fontWeight: 600 }}>Yeni Şifre Belirle (Opsiyonel)</span>
                  <input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Değiştirmek istemiyorsanız boş bırakın"
                    style={{ width: "100%", marginTop: 4 }}
                  />
                </label>

                {/* Panel İzin Paneli */}
                <div
                  style={{
                    border: "1px solid var(--panel-border)",
                    borderRadius: 8,
                    padding: 14,
                    background: "rgba(0,0,0,0.2)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <strong style={{ fontSize: "0.95rem" }}>🔐 Özel Panel İzinleri</strong>
                      <p className="muted" style={{ margin: "2px 0 0 0", fontSize: "0.8rem" }}>
                        Kullanıcının bu rolde veya özel olarak görebileceği ve erişebileceği modülleri seçin.
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="btn-secondary btn-small"
                        onClick={() => setEditPermissions(AVAILABLE_PANELS.map((p) => p.key))}
                      >
                        Tümünü Seç
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-small"
                        onClick={() => setEditPermissions([])}
                      >
                        Temizle
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-small"
                        onClick={() => setEditPermissions(DEFAULT_ROLE_PERMISSIONS[editRole] || [])}
                      >
                        Role Sıfırla
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {groups.map((groupName) => {
                      const groupPanels = AVAILABLE_PANELS.filter((p) => p.group === groupName);
                      return (
                        <div
                          key={groupName}
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid var(--panel-border)",
                            borderRadius: 8,
                            padding: 10,
                          }}
                        >
                          <h4 style={{ margin: "0 0 8px 0", fontSize: "0.85rem", color: "var(--accent)" }}>
                            {groupName}
                          </h4>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {groupPanels.map((p) => {
                              const checked = editPermissions.includes(p.key);
                              return (
                                <label
                                  key={p.key}
                                  style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 10,
                                    cursor: "pointer",
                                    fontSize: "0.83rem",
                                    padding: "6px 8px",
                                    borderRadius: "6px",
                                    background: checked ? "rgba(59, 130, 246, 0.12)" : "rgba(255, 255, 255, 0.03)",
                                    border: checked ? "1px solid rgba(59, 130, 246, 0.35)" : "1px solid transparent",
                                    userSelect: "none",
                                    transition: "all 0.15s ease",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleEditPermission(p.key)}
                                    style={{ marginTop: 2, width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
                                  />
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, color: checked ? "#60a5fa" : "inherit" }}>
                                      {p.icon} {p.label}
                                    </div>
                                    <div className="muted" style={{ fontSize: "0.75rem", marginTop: 2 }}>
                                      {p.desc}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setEditingUser(null)}>
                  İptal
                </button>
                <button type="submit" className="btn-primary" disabled={busy}>
                  💾 Kayıtları Güncelle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Kullanıcı Silme Onay Modalı */}
      {userToDelete && (
        <div className="modal-overlay" onClick={() => setUserToDelete(null)}>
          <div className="modal-content" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚠️ Kullanıcı Silme Onayı</h3>
              <button type="button" className="close-btn" onClick={() => setUserToDelete(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ padding: "16px 0" }}>
              <p style={{ margin: "0 0 12px 0", fontSize: "1rem" }}>
                <strong>"{userToDelete.username}"</strong> kullanıcısını sistemden silmek istediğinize emin misiniz?
              </p>
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: 8,
                  padding: 12,
                  color: "#f87171",
                  fontSize: "0.88rem",
                }}
              >
                <strong>Dikkat:</strong> Bu işlem geri alınamaz. Bu kullanıcı sisteme bir daha giriş yapamayacaktır.
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setUserToDelete(null)}>
                İptal
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleConfirmDelete}
                disabled={busy}
              >
                🗑️ Evet, Kullanıcıyı Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
