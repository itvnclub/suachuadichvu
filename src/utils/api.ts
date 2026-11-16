import type {
  CatalogItem,
  Customer,
  OrderLineItem,
  OrderStatus,
  PublicUser,
  ServiceOrder,
  Technician,
  UserRole,
} from '../types';
import type { MaintenanceAlert, WarrantyRecord } from './serviceLogic';

const TOKEN_STORAGE_KEY = 'atkt_crm_token';

export function getStoredAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getStoredAuthToken();
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Có lỗi xảy ra khi kết nối máy chủ.');
  }
  return data as T;
}

export interface PublicPortalInfo {
  shopHotline: string;
  samplePhones: Array<{ name: string; phone: string }>;
}

export function fetchPublicPortalInfo(): Promise<PublicPortalInfo> {
  return requestJson<PublicPortalInfo>('/api/public/portal-info');
}

export function loginStaff(
  username: string,
  password: string
): Promise<{ token: string; user: PublicUser }> {
  return requestJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function fetchCurrentUser(): Promise<{ user: PublicUser }> {
  return requestJson('/api/auth/me');
}

export function logoutStaff(): Promise<{ ok: boolean }> {
  return requestJson('/api/auth/logout', { method: 'POST' });
}

export interface CrmStoreSnapshot {
  shopHotline: string;
  users: PublicUser[];
  customers: Customer[];
  technicians: Technician[];
  catalog: CatalogItem[];
  orders: ServiceOrder[];
}

export function fetchStore(): Promise<CrmStoreSnapshot> {
  return requestJson<CrmStoreSnapshot>('/api/store');
}

export function createStaffUser(payload: {
  username: string;
  password: string;
  fullName: string;
  phone: string;
  role: UserRole;
  specialty: string;
  active: boolean;
}): Promise<{ user: PublicUser }> {
  return requestJson('/api/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateStaffUser(
  userId: string,
  payload: {
    username?: string;
    password?: string;
    fullName?: string;
    phone?: string;
    role?: UserRole;
    specialty?: string;
    active?: boolean;
  }
): Promise<{ user: PublicUser }> {
  return requestJson(`/api/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteStaffUser(userId: string): Promise<{ ok: boolean }> {
  return requestJson(`/api/users/${userId}`, {
    method: 'DELETE',
  });
}

export function createOrder(payload: {
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  technicianId: string;
  issueDescription: string;
  scheduledDate: string;
  scheduledTime: string;
  items?: OrderLineItem[];
}): Promise<{ order: ServiceOrder; customer: Customer }> {
  return requestJson('/api/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateOrder(
  orderId: string,
  payload: {
    status?: OrderStatus;
    statusNote?: string;
    technicianId?: string;
    scheduledDate?: string;
    scheduledTime?: string;
    issueDescription?: string;
    items?: OrderLineItem[];
  }
): Promise<{ order: ServiceOrder }> {
  return requestJson(`/api/orders/${orderId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function toggleMaintenanceFollowUp(
  orderId: string,
  lineItemId: string,
  followedUp: boolean
): Promise<{ order: ServiceOrder }> {
  return requestJson(
    `/api/orders/${orderId}/items/${lineItemId}/followup`,
    {
      method: 'PATCH',
      body: JSON.stringify({ followedUp }),
    }
  );
}

export function createCatalogItem(payload: {
  name: string;
  category: 'service' | 'material';
  unit: string;
  currentPrice: number;
  defaultWarrantyMonths: number;
  defaultMaintenanceMonths: number;
}): Promise<{ item: CatalogItem }> {
  return requestJson('/api/catalog', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateCatalogItem(
  id: string,
  payload: Partial<CatalogItem>
): Promise<{ item: CatalogItem }> {
  return requestJson(`/api/catalog/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteCatalogItem(id: string): Promise<{ ok: boolean }> {
  return requestJson(`/api/catalog/${id}`, {
    method: 'DELETE',
  });
}

export interface CustomerLookupResponse {
  shopHotline: string;
  customer: Customer;
  orders: ServiceOrder[];
  warranties: WarrantyRecord[];
  maintenance: MaintenanceAlert[];
}

export function lookupCustomerByPhone(
  phone: string
): Promise<CustomerLookupResponse> {
  return requestJson(
    `/api/customer-lookup?phone=${encodeURIComponent(phone.trim())}`
  );
}
