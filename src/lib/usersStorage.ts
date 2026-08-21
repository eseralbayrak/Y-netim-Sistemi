import { api } from "./api";
import type { AuditLogEntry, AuthUser, Role } from "../types";

export function loadUsers(): Promise<AuthUser[]> {
  return api.get<AuthUser[]>("/users");
}

export function createUser(input: {
  username: string;
  password: string;
  role: Role;
  permissions?: string[];
  active?: boolean;
}): Promise<AuthUser[]> {
  return api.post<AuthUser[]>("/users", input);
}

export function updateUser(
  id: string,
  patch: Partial<{ role: Role; permissions?: string[]; active: boolean; password: string }>
): Promise<AuthUser[]> {
  return api.patch<AuthUser[]>(`/users/${encodeURIComponent(id)}`, patch);
}

export function deleteUser(id: string): Promise<AuthUser[]> {
  return api.delete<AuthUser[]>(`/users/${encodeURIComponent(id)}`);
}

export function loadAuditLog(limit = 200): Promise<AuditLogEntry[]> {
  return api.get<AuditLogEntry[]>(`/audit-log?limit=${limit}`);
}
