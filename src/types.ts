export type UserRole = 'admin' | 'technician';

export type AdminTab =
  | 'intake'
  | 'board'
  | 'catalog'
  | 'care'
  | 'analytics'
  | 'users';

export type CatalogCategory = 'service' | 'material';

export type OrderStatus =
  | 'pending'
  | 'completed'
  | 'waiting_material'
  | 'cancelled';

export interface StaffUser {
  id: string;
  username: string;
  passwordHash: string;
  fullName: string;
  phone: string;
  role: UserRole;
  specialty: string;
  active: boolean;
  createdAt: string;
}

export type PublicUser = Omit<StaffUser, 'passwordHash'>;

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  note?: string;
  createdAt: string;
}

export interface Technician {
  id: string;
  name: string;
  phone: string;
  specialty: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  category: CatalogCategory;
  unit: string;
  currentPrice: number;
  defaultWarrantyMonths: number;
  defaultMaintenanceMonths: number;
  updatedAt: string;
}

export interface OrderLineItem {
  id: string;
  catalogItemId: string;
  name: string;
  category: CatalogCategory;
  unit: string;
  quantity: number;
  /**
   * Locked price captured at the moment this line item was saved onto the order.
   * Future catalog price updates never mutate this field.
   */
  lockedUnitPrice: number;
  warrantyMonths: number;
  maintenanceMonths: number;
  priceLockedAt: string;
  maintenanceFollowedUp?: boolean;
}

export interface ServiceOrder {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  technicianId: string;
  technicianName: string;
  issueDescription: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:mm
  status: OrderStatus;
  statusNote?: string;
  items: OrderLineItem[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface StoreData {
  shopHotline: string;
  users: StaffUser[];
  customers: Customer[];
  technicians: Technician[];
  catalog: CatalogItem[];
  orders: ServiceOrder[];
}
