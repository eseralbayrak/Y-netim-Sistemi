import React, { useState } from "react";
import { login } from "../lib/auth";
import type { AuthUser } from "../types";

export default function Login({ onSuccess }: { onSuccess: (user: AuthUser) => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function performLogin(uName: string, pWord: string) {
    if (!uName.trim() || !pWord) return;
    setLoading(true);
    setError(null);
    try {
      const u = await login(uName.trim(), pWord);
      onSuccess(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş başarısız.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await performLogin(username, password);
  }

  return (
    <div className="app-shell" style={{ maxWidth: 440, paddingTop: 60, margin: "0 auto" }}>
      <div className="panel" style={{ padding: 28 }}>
        <div style={{ textAlign: "center", marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid var(--panel-border)" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "0.2px" }}>
            B.R. Levent Plastik · Yönetim Sistemi
          </h2>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
          <label>
            Kullanıcı Adı
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="admin"
            />
          </label>
          <label>
            Şifre
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••"
            />
          </label>
          {error && <p style={{ color: "var(--ng)", fontSize: 13, margin: 0 }}>{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>
      </div>
    </div>
  );
}
