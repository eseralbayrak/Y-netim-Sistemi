import { api, setToken, clearToken, setUnauthorizedHandler } from "./api";
import type { AuthUser } from "../types";

const USER_KEY = "gkys_user";

export { setUnauthorizedHandler };

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function storeUser(user: AuthUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  clearToken();
  localStorage.removeItem(USER_KEY);
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await api.post<{ token: string; user: AuthUser }>("/auth/login", {
    username,
    password,
  });
  setToken(res.token);
  storeUser(res.user);
  return res.user;
}

// Sayfa yenilendiğinde / uygulama açıldığında oturumun hâlâ geçerli olup olmadığını sunucudan doğrular.
export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const user = await api.get<AuthUser>("/auth/me");
    storeUser(user);
    return user;
  } catch {
    clearSession();
    return null;
  }
}

export function logout(): void {
  clearSession();
}
