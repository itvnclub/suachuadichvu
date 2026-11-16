import type {
  CatalogItem,
  Customer,
  OrderLineItem,
  OrderStatus,
  PublicUser,
  ServiceOrder,
  StaffUser,
  Technician,
  UserRole,
} from '../types.ts';

export function deriveActiveTechnicians(
  users: Array<Pick<StaffUser | PublicUser, 'id' | 'fullName' | 'phone' | 'role' | 'specialty' | 'active'>>
): Technician[] {
  return users
    .filter((u) => u.role === 'technician' && u.active)
    .map((u) => ({
      id: u.id,
      name: u.fullName,
      phone: u.phone,
      specialty: u.specialty || 'Kỹ thuật viên',
    }));
}

export function validateStaffUserInput(
  input: {
    username: string;
    fullName: string;
    phone: string;
    role: UserRole;
    password?: string;
  },
  existingUsers: Array<Pick<StaffUser | PublicUser, 'id' | 'username'>>,
  editingUserId?: string
): string | null {
  const cleanUsername = input.username.trim().toLowerCase();
  if (!cleanUsername || cleanUsername.length < 3) {
    return 'Tên đăng nhập phải có ít nhất 3 ký tự.';
  }
  if (!/^[a-z0-9_.-]+$/.test(cleanUsername)) {
    return 'Tên đăng nhập chỉ gồm chữ không dấu, số hoặc dấu gạch dưới.';
  }
  const duplicate = existingUsers.find(
    (u) =>
      u.username.toLowerCase() === cleanUsername && u.id !== editingUserId
  );
  if (duplicate) {
    return 'Tên đăng nhập này đã tồn tại trong hệ thống.';
  }
  if (!input.fullName.trim()) {
    return 'Vui lòng nhập họ và tên nhân sự.';
  }
  if (normalizePhone(input.phone).length < 8) {
    return 'Vui lòng nhập số điện thoại hợp lệ (ít nhất 8 chữ số).';
  }
  if (!editingUserId && (!input.password || input.password.trim().length < 4)) {
    return 'Mật khẩu khởi tạo phải có ít nhất 4 ký tự.';
  }
  if (
    editingUserId &&
    input.password !== undefined &&
    input.password.length > 0 &&
    input.password.trim().length < 4
  ) {
    return 'Mật khẩu mới phải có ít nhất 4 ký tự.';
  }
  return null;
}

export function checkAdminSafetyGuard(
  users: Array<Pick<StaffUser | PublicUser, 'id' | 'role' | 'active'>>,
  targetUserId: string,
  action: 'delete' | 'update',
  nextValues?: { role?: UserRole; active?: boolean },
  actingUserId?: string
): string | null {
  const target = users.find((u) => u.id === targetUserId);
  if (!target) return 'Không tìm thấy tài khoản người dùng.';

  if (actingUserId && actingUserId === targetUserId && action === 'delete') {
    return 'Không thể tự xóa tài khoản đang đăng nhập.';
  }

  const activeAdmins = users.filter((u) => u.role === 'admin' && u.active);
  const targetIsActiveAdmin = target.role === 'admin' && target.active;

  if (targetIsActiveAdmin && activeAdmins.length <= 1) {
    if (action === 'delete') {
      return 'Không thể xóa quản trị viên (Admin) hoạt động cuối cùng.';
    }
    if (
      action === 'update' &&
      ((nextValues?.role && nextValues.role !== 'admin') ||
        nextValues?.active === false)
    ) {
      return 'Hệ thống phải có ít nhất 1 quản trị viên (Admin) đang hoạt động.';
    }
  }

  return null;
}

export function formatVND(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return new Intl.NumberFormat('vi-VN').format(safe) + 'đ';
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function formatDateVN(isoDateOrTimestamp: string): string {
  if (!isoDateOrTimestamp) return '';
  const datePart = isoDateOrTimestamp.slice(0, 10);
  const parts = datePart.split('-');
  if (parts.length !== 3) return isoDateOrTimestamp;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function addMonthsToDate(isoDate: string, months: number): string {
  const datePart = isoDate.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return datePart;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCMonth(dt.getUTCMonth() + months);
  return dt.toISOString().slice(0, 10);
}

export function addDaysToDate(isoDate: string, days: number): string {
  const datePart = isoDate.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return datePart;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function diffDaysBetween(fromDate: string, toDate: string): number {
  const a = fromDate.slice(0, 10).split('-').map(Number);
  const b = toDate.slice(0, 10).split('-').map(Number);
  if (a.length !== 3 || b.length !== 3) return 0;
  const msA = Date.UTC(a[0], a[1] - 1, a[2]);
  const msB = Date.UTC(b[0], b[1] - 1, b[2]);
  return Math.round((msB - msA) / 86_400_000);
}

/**
 * Smart phone lookup: triggers when query has >= 3 digits (or >= 2 non-digit search chars).
 * Returns matching customers sorted with prefix phone matches first.
 */
export function searchCustomersByPhoneOrName(
  customers: Customer[],
  query: string
): Customer[] {
  const trimmed = query.trim();
  const digits = normalizePhone(trimmed);
  if (digits.length >= 3) {
    return customers
      .filter((c) => normalizePhone(c.phone).includes(digits))
      .sort((a, b) => {
        const aStarts = normalizePhone(a.phone).startsWith(digits) ? 0 : 1;
        const bStarts = normalizePhone(b.phone).startsWith(digits) ? 0 : 1;
        return aStarts - bStarts;
      });
  }
  if (trimmed.length >= 2 && digits.length === 0) {
    const lower = trimmed.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        c.address.toLowerCase().includes(lower)
    );
  }
  return [];
}

/**
 * Creates a price-locked line item snapshot from a catalog item.
 * Subsequent updates to CatalogItem.currentPrice will NOT alter this line item.
 */
export function createLockedLineItem(
  catalogItem: CatalogItem,
  quantity: number,
  overrides?: {
    id?: string;
    warrantyMonths?: number;
    maintenanceMonths?: number;
    nowIso?: string;
  }
): OrderLineItem {
  const safeQty = Math.max(0.1, Number.isFinite(quantity) ? quantity : 1);
  return {
    id:
      overrides?.id ??
      `li_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    catalogItemId: catalogItem.id,
    name: catalogItem.name,
    category: catalogItem.category,
    unit: catalogItem.unit,
    quantity: safeQty,
    lockedUnitPrice: catalogItem.currentPrice,
    warrantyMonths:
      overrides?.warrantyMonths ?? catalogItem.defaultWarrantyMonths,
    maintenanceMonths:
      overrides?.maintenanceMonths ?? catalogItem.defaultMaintenanceMonths,
    priceLockedAt: overrides?.nowIso ?? new Date().toISOString(),
  };
}

export interface OrderTotals {
  serviceTotal: number;
  materialTotal: number;
  grandTotal: number;
}

export function calculateOrderTotals(items: OrderLineItem[]): OrderTotals {
  let serviceTotal = 0;
  let materialTotal = 0;
  for (const item of items) {
    const lineAmount = Math.round(item.quantity * item.lockedUnitPrice);
    if (item.category === 'service') {
      serviceTotal += lineAmount;
    } else {
      materialTotal += lineAmount;
    }
  }
  return {
    serviceTotal,
    materialTotal,
    grandTotal: serviceTotal + materialTotal,
  };
}

export interface WarrantyRecord {
  orderId: string;
  orderCode: string;
  lineItemId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  itemName: string;
  completedDate: string;
  warrantyMonths: number;
  expiresAt: string;
  daysRemaining: number;
  isActive: boolean;
  statusLabel: string;
}

export function evaluateWarrantyRecords(
  orders: ServiceOrder[],
  todayIsoDate: string
): WarrantyRecord[] {
  const results: WarrantyRecord[] = [];
  for (const order of orders) {
    if (order.status !== 'completed') continue;
    const baseDate = (order.completedAt ?? order.scheduledDate).slice(0, 10);
    for (const item of order.items) {
      if (item.warrantyMonths <= 0) continue;
      const expiresAt = addMonthsToDate(baseDate, item.warrantyMonths);
      const daysRemaining = diffDaysBetween(todayIsoDate, expiresAt);
      const isActive = daysRemaining >= 0;
      const statusLabel = isActive
        ? `Còn bảo hành ${daysRemaining} ngày`
        : `Đã hết hạn ${Math.abs(daysRemaining)} ngày`;
      results.push({
        orderId: order.id,
        orderCode: order.code,
        lineItemId: item.id,
        customerId: order.customerId,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        itemName: item.name,
        completedDate: baseDate,
        warrantyMonths: item.warrantyMonths,
        expiresAt,
        daysRemaining,
        isActive,
        statusLabel,
      });
    }
  }
  return results.sort((a, b) => b.completedDate.localeCompare(a.completedDate));
}

export interface MaintenanceAlert {
  orderId: string;
  orderCode: string;
  lineItemId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  itemName: string;
  completedDate: string;
  maintenanceMonths: number;
  dueDate: string;
  daysUntilDue: number;
  urgency: 'due_today' | 'overdue' | 'upcoming';
  followedUp: boolean;
}

export function evaluateMaintenanceAlerts(
  orders: ServiceOrder[],
  todayIsoDate: string,
  upcomingWindowDays = 30
): MaintenanceAlert[] {
  const alerts: MaintenanceAlert[] = [];
  for (const order of orders) {
    if (order.status !== 'completed') continue;
    const baseDate = (order.completedAt ?? order.scheduledDate).slice(0, 10);
    for (const item of order.items) {
      if (item.maintenanceMonths <= 0) continue;
      const dueDate = addMonthsToDate(baseDate, item.maintenanceMonths);
      const daysUntilDue = diffDaysBetween(todayIsoDate, dueDate);
      if (daysUntilDue > upcomingWindowDays) continue;
      let urgency: MaintenanceAlert['urgency'] = 'upcoming';
      if (daysUntilDue === 0) urgency = 'due_today';
      else if (daysUntilDue < 0) urgency = 'overdue';

      alerts.push({
        orderId: order.id,
        orderCode: order.code,
        lineItemId: item.id,
        customerId: order.customerId,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerAddress: order.customerAddress,
        itemName: item.name,
        completedDate: baseDate,
        maintenanceMonths: item.maintenanceMonths,
        dueDate,
        daysUntilDue,
        urgency,
        followedUp: Boolean(item.maintenanceFollowedUp),
      });
    }
  }
  return alerts.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

export interface ItemConsumptionStat {
  catalogItemId: string;
  name: string;
  category: 'service' | 'material';
  unit: string;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
}

export interface RevenueAnalytics {
  completedOrderCount: number;
  totalRevenue: number;
  serviceRevenue: number;
  materialRevenue: number;
  itemBreakdown: ItemConsumptionStat[];
}

export function computeRevenueAnalytics(
  orders: ServiceOrder[],
  fromDate?: string,
  toDate?: string
): RevenueAnalytics {
  const itemMap = new Map<string, ItemConsumptionStat>();
  let completedOrderCount = 0;
  let serviceRevenue = 0;
  let materialRevenue = 0;

  for (const order of orders) {
    if (order.status !== 'completed') continue;
    const effectiveDate = (order.completedAt ?? order.scheduledDate).slice(
      0,
      10
    );
    if (fromDate && effectiveDate < fromDate) continue;
    if (toDate && effectiveDate > toDate) continue;

    completedOrderCount += 1;
    const totals = calculateOrderTotals(order.items);
    serviceRevenue += totals.serviceTotal;
    materialRevenue += totals.materialTotal;

    const seenInOrder = new Set<string>();
    for (const item of order.items) {
      const key = item.catalogItemId || item.name;
      const existing = itemMap.get(key);
      const lineAmount = Math.round(item.quantity * item.lockedUnitPrice);
      if (existing) {
        existing.totalQuantity = Number(
          (existing.totalQuantity + item.quantity).toFixed(2)
        );
        existing.totalRevenue += lineAmount;
        if (!seenInOrder.has(key)) {
          existing.orderCount += 1;
        }
      } else {
        itemMap.set(key, {
          catalogItemId: key,
          name: item.name,
          category: item.category,
          unit: item.unit,
          totalQuantity: Number(item.quantity.toFixed(2)),
          totalRevenue: lineAmount,
          orderCount: 1,
        });
      }
      seenInOrder.add(key);
    }
  }

  const itemBreakdown = Array.from(itemMap.values()).sort(
    (a, b) => b.totalRevenue - a.totalRevenue
  );

  return {
    completedOrderCount,
    totalRevenue: serviceRevenue + materialRevenue,
    serviceRevenue,
    materialRevenue,
    itemBreakdown,
  };
}

export function getStatusDisplay(status: OrderStatus): {
  label: string;
  column: 'pending' | 'completed' | 'waiting_or_cancelled';
} {
  switch (status) {
    case 'pending':
      return { label: 'Chờ xử lý', column: 'pending' };
    case 'completed':
      return { label: 'Hoàn thành', column: 'completed' };
    case 'waiting_material':
      return { label: 'Chờ vật tư', column: 'waiting_or_cancelled' };
    case 'cancelled':
      return { label: 'Khách hủy', column: 'waiting_or_cancelled' };
  }
}
