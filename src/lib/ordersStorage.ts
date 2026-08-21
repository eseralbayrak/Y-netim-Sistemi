import type { PurchaseOrder, SupplierDetail } from "../types";
import { api } from "./api";

const ORDERS_KEY = "gkys_orders_v1";
const SUPPLIERS_DETAIL_KEY = "gkys_suppliers_detail_v1";

// ---- LOCAL STORAGE FALLBACK HELPERS ----
function loadLocalOrders(): PurchaseOrder[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalOrders(list: PurchaseOrder[]) {
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(list));
  } catch {}
}

function loadLocalSuppliersDetail(): SupplierDetail[] {
  try {
    const raw = localStorage.getItem(SUPPLIERS_DETAIL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalSuppliersDetail(list: SupplierDetail[]) {
  try {
    localStorage.setItem(SUPPLIERS_DETAIL_KEY, JSON.stringify(list));
  } catch {}
}

// ---- ORDERS API ----

export async function loadOrders(): Promise<PurchaseOrder[]> {
  try {
    const data = await api.get<PurchaseOrder[]>("/orders");
    saveLocalOrders(data);
    return data;
  } catch (err) {
    console.warn("Orders sunucudan çekilemedi, yerel veri kullanılıyor:", err);
    return loadLocalOrders();
  }
}

export async function addOrder(order: Omit<PurchaseOrder, "id" | "olusturmaTarihi">): Promise<PurchaseOrder> {
  const newOrder: PurchaseOrder = {
    ...order,
    id: `PO-${Date.now()}`,
    olusturmaTarihi: new Date().toISOString(),
  };

  try {
    const created = await api.post<PurchaseOrder>("/orders", newOrder);
    return created;
  } catch (err) {
    console.warn("Sipariş yerel depolamaya yazılıyor:", err);
    const list = [newOrder, ...loadLocalOrders()];
    saveLocalOrders(list);
    return newOrder;
  }
}

export async function updateOrder(id: string, patch: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
  try {
    const updated = await api.patch<PurchaseOrder>(`/orders/${encodeURIComponent(id)}`, patch);
    return updated;
  } catch (err) {
    console.warn("Sipariş yerel güncelleniyor:", err);
    const list = loadLocalOrders();
    const idx = list.findIndex((o) => o.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...patch };
      saveLocalOrders(list);
      return list[idx];
    }
    throw err;
  }
}

export async function deleteOrder(id: string): Promise<void> {
  try {
    const res = await api.delete<PurchaseOrder[] | undefined>(`/orders/${encodeURIComponent(id)}`);
    if (Array.isArray(res)) {
      saveLocalOrders(res);
      return;
    }
  } catch (err) {
    console.warn("Sipariş sunucudan silinirken uyarı:", err);
  }
  const list = loadLocalOrders().filter((o) => o.id !== id && o.siparisNo !== id);
  saveLocalOrders(list);
}

export async function nextPoNumber(supplierName?: string): Promise<string> {
  const orders = await loadOrders();
  const yearShort = new Date().getFullYear().toString().slice(-2);
  const isKirpart = supplierName ? supplierName.toUpperCase().includes("KIRPART") : false;
  const prefix = `${yearShort}/${isKirpart ? "K" : "H"}-`;

  const numbers = orders
    .map((o) => o.siparisNo)
    .filter((no) => no && no.toUpperCase().startsWith(prefix.toUpperCase()))
    .map((no) => {
      const parts = no.split("-");
      const numPart = parts[parts.length - 1];
      return parseInt(numPart, 10);
    })
    .filter((n) => !isNaN(n));

  const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
  const nextNum = String(maxNum + 1).padStart(3, "0");
  return `${prefix}${nextNum}`;
}

// ---- SUPPLIER DETAILS API ----

export async function loadSupplierDetails(): Promise<SupplierDetail[]> {
  try {
    const data = await api.get<SupplierDetail[]>("/suppliers-detail");
    saveLocalSuppliersDetail(data);
    return data;
  } catch (err) {
    console.warn("Tedarikçi verisi yerelden alınıyor:", err);
    return loadLocalSuppliersDetail();
  }
}

export async function saveSupplierDetail(sup: Omit<SupplierDetail, "id" | "olusturmaTarihi"> & { id?: string }): Promise<SupplierDetail> {
  const payload = {
    ...sup,
    id: sup.id || `SUP-${Date.now()}`,
    olusturmaTarihi: new Date().toISOString(),
  };

  try {
    const result = await api.post<SupplierDetail[]>("/suppliers-detail", payload);
    return (Array.isArray(result) ? result.find((s) => s.id === payload.id) : result) || (payload as SupplierDetail);
  } catch (err) {
    console.warn("Tedarikçi yerel yazılıyor:", err);
    const list = loadLocalSuppliersDetail();
    const updated = [payload as SupplierDetail, ...list.filter((s) => s.id !== payload.id)];
    saveLocalSuppliersDetail(updated);
    return payload as SupplierDetail;
  }
}

export async function deleteSupplierDetail(id: string): Promise<void> {
  try {
    await api.delete(`/suppliers-detail/${encodeURIComponent(id)}`);
  } catch (err) {
    console.warn("Tedarikçi yerel siliniyor:", err);
    const list = loadLocalSuppliersDetail().filter((s) => s.id !== id);
    saveLocalSuppliersDetail(list);
  }
}
