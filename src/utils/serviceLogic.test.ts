import test from 'node:test';
import assert from 'node:assert/strict';
import type { CatalogItem, Customer, PublicUser, ServiceOrder } from '../types';
import {
  calculateOrderTotals,
  checkAdminSafetyGuard,
  computeRevenueAnalytics,
  createLockedLineItem,
  deriveActiveTechnicians,
  evaluateMaintenanceAlerts,
  evaluateWarrantyRecords,
  searchCustomersByPhoneOrName,
  validateStaffUserInput,
} from './serviceLogic';

test('smart phone search triggers at 3+ digits and ranks prefix matches first', () => {
  const customers: Customer[] = [
    {
      id: 'c1',
      name: 'Nguyễn Thị Lan',
      phone: '0901234567',
      address: '12 Lê Lợi',
      createdAt: '2026-01-01',
    },
    {
      id: 'c2',
      name: 'Trần Văn Nam',
      phone: '0987090123',
      address: '45 Hai Bà Trưng',
      createdAt: '2026-01-02',
    },
  ];

  assert.equal(searchCustomersByPhoneOrName(customers, '09').length, 0);
  const matches = searchCustomersByPhoneOrName(customers, '0901');
  assert.equal(matches.length, 2);
  assert.equal(matches[0].id, 'c1');
});

test('price lock preserves historical order price when catalog price increases later', () => {
  const vanTong: CatalogItem = {
    id: 'cat_van27',
    name: 'Van tổng phi 27',
    category: 'material',
    unit: 'cái',
    currentPrice: 150000,
    defaultWarrantyMonths: 3,
    defaultMaintenanceMonths: 0,
    updatedAt: '2026-10-01T00:00:00Z',
  };

  const lockedItem = createLockedLineItem(vanTong, 2, {
    id: 'li_1',
    nowIso: '2026-10-05T10:00:00Z',
  });

  // Later, shop increases catalog price to 200.000đ
  vanTong.currentPrice = 200000;

  // Existing locked item stays 150.000đ
  assert.equal(lockedItem.lockedUnitPrice, 150000);
  const totals = calculateOrderTotals([lockedItem]);
  assert.equal(totals.materialTotal, 300000);
  assert.equal(totals.grandTotal, 300000);

  // New line items pick up the new 200.000đ price
  const newItem = createLockedLineItem(vanTong, 1);
  assert.equal(newItem.lockedUnitPrice, 200000);
});

test('warranty evaluation accurately distinguishes active vs expired warranties', () => {
  const orders: ServiceOrder[] = [
    {
      id: 'o1',
      code: 'DH-001',
      customerId: 'c1',
      customerName: 'Chị Lan',
      customerPhone: '0901234567',
      customerAddress: '12 Lê Lợi',
      technicianId: 't1',
      technicianName: 'Minh',
      issueDescription: 'Hỏng tụ máy bơm',
      scheduledDate: '2026-10-02',
      scheduledTime: '09:00',
      status: 'completed',
      completedAt: '2026-10-02T10:30:00Z',
      createdAt: '2026-10-02T08:00:00Z',
      updatedAt: '2026-10-02T10:30:00Z',
      items: [
        {
          id: 'li_tu',
          catalogItemId: 'cat_tu',
          name: 'Tụ máy bơm 20uF',
          category: 'material',
          unit: 'cái',
          quantity: 1,
          lockedUnitPrice: 50000,
          warrantyMonths: 3,
          maintenanceMonths: 0,
          priceLockedAt: '2026-10-02T10:25:00Z',
        },
        {
          id: 'li_van',
          catalogItemId: 'cat_van',
          name: 'Van một chiều',
          category: 'material',
          unit: 'cái',
          quantity: 1,
          lockedUnitPrice: 80000,
          warrantyMonths: 1,
          maintenanceMonths: 0,
          priceLockedAt: '2026-10-02T10:25:00Z',
        },
      ],
    },
  ];

  const records = evaluateWarrantyRecords(orders, '2026-11-16');
  const tu = records.find((r) => r.lineItemId === 'li_tu')!;
  const van = records.find((r) => r.lineItemId === 'li_van')!;

  assert.equal(tu.isActive, true);
  assert.equal(tu.daysRemaining, 47);
  assert.equal(van.isActive, false);
  assert.equal(van.daysRemaining, -14);
});

test('maintenance alerts detect items due today and revenue analytics aggregate quantities', () => {
  const orders: ServiceOrder[] = [
    {
      id: 'o2',
      code: 'DH-002',
      customerId: 'c2',
      customerName: 'Anh Tuấn',
      customerPhone: '0912345678',
      customerAddress: '88 Nguyễn Trãi',
      technicianId: 't1',
      technicianName: 'Minh',
      issueDescription: 'Vệ sinh điều hòa',
      scheduledDate: '2026-05-16',
      scheduledTime: '14:00',
      status: 'completed',
      completedAt: '2026-05-16T15:30:00Z',
      createdAt: '2026-05-16T09:00:00Z',
      updatedAt: '2026-05-16T15:30:00Z',
      items: [
        {
          id: 'li_ac',
          catalogItemId: 'cat_ac',
          name: 'Vệ sinh điều hòa treo tường',
          category: 'service',
          unit: 'máy',
          quantity: 2,
          lockedUnitPrice: 180000,
          warrantyMonths: 0,
          maintenanceMonths: 6,
          priceLockedAt: '2026-05-16T15:00:00Z',
        },
        {
          id: 'li_wire',
          catalogItemId: 'cat_wire',
          name: 'Dây điện Cadivi 2x2.5',
          category: 'material',
          unit: 'mét',
          quantity: 12,
          lockedUnitPrice: 22000,
          warrantyMonths: 12,
          maintenanceMonths: 0,
          priceLockedAt: '2026-05-16T15:00:00Z',
        },
      ],
    },
  ];

  const alerts = evaluateMaintenanceAlerts(orders, '2026-11-16', 30);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].urgency, 'due_today');
  assert.equal(alerts[0].dueDate, '2026-11-16');

  const analytics = computeRevenueAnalytics(orders, '2026-05-01', '2026-05-31');
  assert.equal(analytics.completedOrderCount, 1);
  assert.equal(analytics.serviceRevenue, 360000);
  assert.equal(analytics.materialRevenue, 264000);
  assert.equal(analytics.totalRevenue, 624000);
  assert.equal(analytics.itemBreakdown.find((i) => i.catalogItemId === 'cat_wire')?.totalQuantity, 12);
});

test('user management validation, active technician derivation, and last-admin safety guard', () => {
  const users: PublicUser[] = [
    {
      id: 'usr_admin',
      username: 'admin',
      fullName: 'Quản trị hệ thống',
      phone: '0900000001',
      role: 'admin',
      specialty: 'Điều hành cửa hàng',
      active: true,
      createdAt: '2026-01-01',
    },
    {
      id: 'tech_1',
      username: 'minh',
      fullName: 'Nguyễn Văn Minh',
      phone: '0903111222',
      role: 'technician',
      specialty: 'Điện nước & Máy bơm',
      active: true,
      createdAt: '2026-01-01',
    },
    {
      id: 'tech_inactive',
      username: 'long',
      fullName: 'Trần Văn Long',
      phone: '0903999000',
      role: 'technician',
      specialty: 'Điện dân dụng',
      active: false,
      createdAt: '2026-01-01',
    },
  ];

  // Derive active technicians excludes admins and inactive techs
  const activeTechs = deriveActiveTechnicians(users);
  assert.equal(activeTechs.length, 1);
  assert.equal(activeTechs[0].id, 'tech_1');
  assert.equal(activeTechs[0].name, 'Nguyễn Văn Minh');

  // Duplicate username rejected
  assert.ok(
    validateStaffUserInput(
      {
        username: 'MINH',
        fullName: 'Minh Mới',
        phone: '0908888888',
        role: 'technician',
        password: 'secret',
      },
      users
    )
  );

  // Valid new user accepted
  assert.equal(
    validateStaffUserInput(
      {
        username: 'kiet',
        fullName: 'Phạm Tuấn Kiệt',
        phone: '0905123456',
        role: 'technician',
        password: '123456',
      },
      users
    ),
    null
  );

  // Cannot delete or demote last active admin
  assert.ok(checkAdminSafetyGuard(users, 'usr_admin', 'delete'));
  assert.ok(
    checkAdminSafetyGuard(users, 'usr_admin', 'update', { role: 'technician' })
  );
  // Can delete a technician
  assert.equal(checkAdminSafetyGuard(users, 'tech_1', 'delete'), null);
});

