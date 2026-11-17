// server.ts
import "dotenv/config";
import express from "express";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "url";

// src/utils/seedData.ts
import { createHash } from "node:crypto";

// src/utils/serviceLogic.ts
function deriveActiveTechnicians(users) {
  return users.filter((u) => u.role === "technician" && u.active).map((u) => ({
    id: u.id,
    name: u.fullName,
    phone: u.phone,
    specialty: u.specialty || "K\u1EF9 thu\u1EADt vi\xEAn"
  }));
}
function validateStaffUserInput(input, existingUsers, editingUserId) {
  const cleanUsername = input.username.trim().toLowerCase();
  if (!cleanUsername || cleanUsername.length < 3) {
    return "T\xEAn \u0111\u0103ng nh\u1EADp ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 3 k\xFD t\u1EF1.";
  }
  if (!/^[a-z0-9_.-]+$/.test(cleanUsername)) {
    return "T\xEAn \u0111\u0103ng nh\u1EADp ch\u1EC9 g\u1ED3m ch\u1EEF kh\xF4ng d\u1EA5u, s\u1ED1 ho\u1EB7c d\u1EA5u g\u1EA1ch d\u01B0\u1EDBi.";
  }
  const duplicate = existingUsers.find(
    (u) => u.username.toLowerCase() === cleanUsername && u.id !== editingUserId
  );
  if (duplicate) {
    return "T\xEAn \u0111\u0103ng nh\u1EADp n\xE0y \u0111\xE3 t\u1ED3n t\u1EA1i trong h\u1EC7 th\u1ED1ng.";
  }
  if (!input.fullName.trim()) {
    return "Vui l\xF2ng nh\u1EADp h\u1ECD v\xE0 t\xEAn nh\xE2n s\u1EF1.";
  }
  if (normalizePhone(input.phone).length < 8) {
    return "Vui l\xF2ng nh\u1EADp s\u1ED1 \u0111i\u1EC7n tho\u1EA1i h\u1EE3p l\u1EC7 (\xEDt nh\u1EA5t 8 ch\u1EEF s\u1ED1).";
  }
  if (!editingUserId && (!input.password || input.password.trim().length < 4)) {
    return "M\u1EADt kh\u1EA9u kh\u1EDFi t\u1EA1o ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 4 k\xFD t\u1EF1.";
  }
  if (editingUserId && input.password !== void 0 && input.password.length > 0 && input.password.trim().length < 4) {
    return "M\u1EADt kh\u1EA9u m\u1EDBi ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 4 k\xFD t\u1EF1.";
  }
  return null;
}
function checkAdminSafetyGuard(users, targetUserId, action, nextValues, actingUserId) {
  const target = users.find((u) => u.id === targetUserId);
  if (!target) return "Kh\xF4ng t\xECm th\u1EA5y t\xE0i kho\u1EA3n ng\u01B0\u1EDDi d\xF9ng.";
  if (actingUserId && actingUserId === targetUserId && action === "delete") {
    return "Kh\xF4ng th\u1EC3 t\u1EF1 x\xF3a t\xE0i kho\u1EA3n \u0111ang \u0111\u0103ng nh\u1EADp.";
  }
  const activeAdmins = users.filter((u) => u.role === "admin" && u.active);
  const targetIsActiveAdmin = target.role === "admin" && target.active;
  if (targetIsActiveAdmin && activeAdmins.length <= 1) {
    if (action === "delete") {
      return "Kh\xF4ng th\u1EC3 x\xF3a qu\u1EA3n tr\u1ECB vi\xEAn (Admin) ho\u1EA1t \u0111\u1ED9ng cu\u1ED1i c\xF9ng.";
    }
    if (action === "update" && (nextValues?.role && nextValues.role !== "admin" || nextValues?.active === false)) {
      return "H\u1EC7 th\u1ED1ng ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 1 qu\u1EA3n tr\u1ECB vi\xEAn (Admin) \u0111ang ho\u1EA1t \u0111\u1ED9ng.";
    }
  }
  return null;
}
function normalizePhone(phone) {
  return phone.replace(/\D/g, "");
}
function addMonthsToDate(isoDate, months) {
  const datePart = isoDate.slice(0, 10);
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return datePart;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCMonth(dt.getUTCMonth() + months);
  return dt.toISOString().slice(0, 10);
}
function addDaysToDate(isoDate, days) {
  const datePart = isoDate.slice(0, 10);
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return datePart;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
function diffDaysBetween(fromDate, toDate) {
  const a = fromDate.slice(0, 10).split("-").map(Number);
  const b = toDate.slice(0, 10).split("-").map(Number);
  if (a.length !== 3 || b.length !== 3) return 0;
  const msA = Date.UTC(a[0], a[1] - 1, a[2]);
  const msB = Date.UTC(b[0], b[1] - 1, b[2]);
  return Math.round((msB - msA) / 864e5);
}
function evaluateWarrantyRecords(orders, todayIsoDate) {
  const results = [];
  for (const order of orders) {
    if (order.status !== "completed") continue;
    const baseDate = (order.completedAt ?? order.scheduledDate).slice(0, 10);
    for (const item of order.items) {
      if (item.warrantyMonths <= 0) continue;
      const expiresAt = addMonthsToDate(baseDate, item.warrantyMonths);
      const daysRemaining = diffDaysBetween(todayIsoDate, expiresAt);
      const isActive = daysRemaining >= 0;
      const statusLabel = isActive ? `C\xF2n b\u1EA3o h\xE0nh ${daysRemaining} ng\xE0y` : `\u0110\xE3 h\u1EBFt h\u1EA1n ${Math.abs(daysRemaining)} ng\xE0y`;
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
        statusLabel
      });
    }
  }
  return results.sort((a, b) => b.completedDate.localeCompare(a.completedDate));
}
function evaluateMaintenanceAlerts(orders, todayIsoDate, upcomingWindowDays = 30) {
  const alerts = [];
  for (const order of orders) {
    if (order.status !== "completed") continue;
    const baseDate = (order.completedAt ?? order.scheduledDate).slice(0, 10);
    for (const item of order.items) {
      if (item.maintenanceMonths <= 0) continue;
      const dueDate = addMonthsToDate(baseDate, item.maintenanceMonths);
      const daysUntilDue = diffDaysBetween(todayIsoDate, dueDate);
      if (daysUntilDue > upcomingWindowDays) continue;
      let urgency = "upcoming";
      if (daysUntilDue === 0) urgency = "due_today";
      else if (daysUntilDue < 0) urgency = "overdue";
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
        followedUp: Boolean(item.maintenanceFollowedUp)
      });
    }
  }
  return alerts.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

// src/utils/seedData.ts
function hashPassword(password) {
  return createHash("sha256").update(`atkt_crm_salt_v1:${password}`).digest("hex");
}
function createInitialStoreData(todayIsoDate) {
  const today = todayIsoDate ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const sixMonthsAgo = addMonthsToDate(today, -6);
  const fortyFiveDaysAgo = addDaysToDate(today, -45);
  const fortyDaysAgo = addDaysToDate(today, -40);
  const tenDaysAgo = addDaysToDate(today, -10);
  const fourDaysAgo = addDaysToDate(today, -4);
  const twoDaysAgo = addDaysToDate(today, -2);
  const yesterday = addDaysToDate(today, -1);
  const defaultHash = hashPassword("123456");
  return {
    shopHotline: "1900 6868",
    users: [
      {
        id: "usr_admin",
        username: "admin",
        passwordHash: defaultHash,
        fullName: "Qu\u1EA3n tr\u1ECB vi\xEAn (Ch\u1EE7 c\u1EEDa h\xE0ng)",
        phone: "0900112233",
        role: "admin",
        specialty: "\u0110i\u1EC1u h\xE0nh & Ch\u0103m s\xF3c kh\xE1ch h\xE0ng",
        active: true,
        createdAt: `${tenDaysAgo}T08:00:00Z`
      },
      {
        id: "tech_1",
        username: "minh",
        passwordHash: defaultHash,
        fullName: "Nguy\u1EC5n V\u0103n Minh",
        phone: "0903111222",
        role: "technician",
        specialty: "\u0110i\u1EC7n n\u01B0\u1EDBc & M\xE1y b\u01A1m",
        active: true,
        createdAt: `${tenDaysAgo}T08:00:00Z`
      },
      {
        id: "tech_2",
        username: "tuan",
        passwordHash: defaultHash,
        fullName: "Tr\u1EA7n Qu\u1ED1c Tu\u1EA5n",
        phone: "0903333444",
        role: "technician",
        specialty: "\u0110i\u1EC7n l\u1EA1nh & \u0110i\u1EC1u h\xF2a",
        active: true,
        createdAt: `${tenDaysAgo}T08:00:00Z`
      },
      {
        id: "tech_3",
        username: "hung",
        passwordHash: defaultHash,
        fullName: "L\xEA Ho\xE0ng H\xF9ng",
        phone: "0903555666",
        role: "technician",
        specialty: "S\u1EEDa ch\u1EEFa d\xE2n d\u1EE5ng & \u1ED0ng n\u01B0\u1EDBc",
        active: true,
        createdAt: `${tenDaysAgo}T08:00:00Z`
      }
    ],
    technicians: [
      {
        id: "tech_1",
        name: "Nguy\u1EC5n V\u0103n Minh",
        phone: "0903111222",
        specialty: "\u0110i\u1EC7n n\u01B0\u1EDBc & M\xE1y b\u01A1m"
      },
      {
        id: "tech_2",
        name: "Tr\u1EA7n Qu\u1ED1c Tu\u1EA5n",
        phone: "0903333444",
        specialty: "\u0110i\u1EC7n l\u1EA1nh & \u0110i\u1EC1u h\xF2a"
      },
      {
        id: "tech_3",
        name: "L\xEA Ho\xE0ng H\xF9ng",
        phone: "0903555666",
        specialty: "S\u1EEDa ch\u1EEFa d\xE2n d\u1EE5ng & \u1ED0ng n\u01B0\u1EDBc"
      }
    ],
    catalog: [
      {
        id: "cat_van27",
        name: "Van t\u1ED5ng phi 27",
        category: "material",
        unit: "c\xE1i",
        currentPrice: 15e4,
        defaultWarrantyMonths: 3,
        defaultMaintenanceMonths: 0,
        updatedAt: `${tenDaysAgo}T08:00:00Z`
      },
      {
        id: "cat_tu20",
        name: "T\u1EE5 m\xE1y b\u01A1m 20uF",
        category: "material",
        unit: "c\xE1i",
        currentPrice: 5e4,
        defaultWarrantyMonths: 3,
        defaultMaintenanceMonths: 0,
        updatedAt: `${tenDaysAgo}T08:00:00Z`
      },
      {
        id: "cat_van1c",
        name: "Van m\u1ED9t chi\u1EC1u \u0111\u1ED3ng phi 27",
        category: "material",
        unit: "c\xE1i",
        currentPrice: 85e3,
        defaultWarrantyMonths: 1,
        defaultMaintenanceMonths: 0,
        updatedAt: `${tenDaysAgo}T08:00:00Z`
      },
      {
        id: "cat_ong27",
        name: "\u1ED0ng n\u01B0\u1EDBc PVC B\xECnh Minh phi 27",
        category: "material",
        unit: "m\xE9t",
        currentPrice: 28e3,
        defaultWarrantyMonths: 12,
        defaultMaintenanceMonths: 0,
        updatedAt: `${tenDaysAgo}T08:00:00Z`
      },
      {
        id: "cat_congtac",
        name: "C\xF4ng t\u1EAFc \u0111\xF4i Panasonic",
        category: "material",
        unit: "c\xE1i",
        currentPrice: 65e3,
        defaultWarrantyMonths: 12,
        defaultMaintenanceMonths: 0,
        updatedAt: `${tenDaysAgo}T08:00:00Z`
      },
      {
        id: "cat_day25",
        name: "D\xE2y \u0111i\u1EC7n Cadivi 2x2.5",
        category: "material",
        unit: "m\xE9t",
        currentPrice: 22e3,
        defaultWarrantyMonths: 12,
        defaultMaintenanceMonths: 0,
        updatedAt: `${tenDaysAgo}T08:00:00Z`
      },
      {
        id: "cat_cb32",
        name: "Aptomat (CB) ch\u1ED1ng gi\u1EADt 32A",
        category: "material",
        unit: "c\xE1i",
        currentPrice: 24e4,
        defaultWarrantyMonths: 12,
        defaultMaintenanceMonths: 0,
        updatedAt: `${tenDaysAgo}T08:00:00Z`
      },
      {
        id: "cat_led18",
        name: "B\xF3ng \u0111\xE8n LED R\u1EA1ng \u0110\xF4ng 18W",
        category: "material",
        unit: "c\xE1i",
        currentPrice: 75e3,
        defaultWarrantyMonths: 6,
        defaultMaintenanceMonths: 0,
        updatedAt: `${tenDaysAgo}T08:00:00Z`
      },
      {
        id: "cat_svc_bom",
        name: "Ti\u1EC1n c\xF4ng s\u1EEDa m\xE1y b\u01A1m t\u1EA1i nh\xE0",
        category: "service",
        unit: "ca",
        currentPrice: 1e5,
        defaultWarrantyMonths: 1,
        defaultMaintenanceMonths: 0,
        updatedAt: `${tenDaysAgo}T08:00:00Z`
      },
      {
        id: "cat_svc_ac",
        name: "V\u1EC7 sinh & b\u1EA3o d\u01B0\u1EE1ng \u0111i\u1EC1u h\xF2a treo t\u01B0\u1EDDng",
        category: "service",
        unit: "m\xE1y",
        currentPrice: 18e4,
        defaultWarrantyMonths: 1,
        defaultMaintenanceMonths: 6,
        updatedAt: `${tenDaysAgo}T08:00:00Z`
      },
      {
        id: "cat_svc_nuoc",
        name: "Ti\u1EC1n c\xF4ng s\u1EEDa \u0111\u01B0\u1EDDng \u1ED1ng / thay van n\u01B0\u1EDBc",
        category: "service",
        unit: "ca",
        currentPrice: 12e4,
        defaultWarrantyMonths: 3,
        defaultMaintenanceMonths: 0,
        updatedAt: `${tenDaysAgo}T08:00:00Z`
      },
      {
        id: "cat_svc_cong",
        name: "Th\xF4ng t\u1EAFc c\u1ED1ng / ch\u1EADu r\u1EEDa",
        category: "service",
        unit: "l\u1EA7n",
        currentPrice: 25e4,
        defaultWarrantyMonths: 1,
        defaultMaintenanceMonths: 0,
        updatedAt: `${tenDaysAgo}T08:00:00Z`
      },
      {
        id: "cat_svc_dien",
        name: "Ki\u1EC3m tra & x\u1EED l\xFD s\u1EF1 c\u1ED1 ch\u1EADp \u0111i\u1EC7n",
        category: "service",
        unit: "ca",
        currentPrice: 15e4,
        defaultWarrantyMonths: 3,
        defaultMaintenanceMonths: 0,
        updatedAt: `${tenDaysAgo}T08:00:00Z`
      }
    ],
    customers: [
      {
        id: "cust_1",
        name: "Ch\u1ECB Nguy\u1EC5n Th\u1ECB Lan",
        phone: "0901234567",
        address: "128 L\xEA L\u1EE3i, Ph\u01B0\u1EDDng B\u1EBFn Th\xE0nh, Qu\u1EADn 1",
        note: "Nh\xE0 c\xF3 2 m\xE1y b\u01A1m v\xE0 2 m\xE1y l\u1EA1nh, g\u1ECDi tr\u01B0\u1EDBc 15 ph\xFAt",
        createdAt: `${sixMonthsAgo}T08:00:00Z`
      },
      {
        id: "cust_2",
        name: "Anh Tr\u1EA7n V\u0103n Nam",
        phone: "0909888777",
        address: "45/8 Hai B\xE0 Tr\u01B0ng, Ph\u01B0\u1EDDng \u0110a Kao, Qu\u1EADn 1",
        createdAt: `${fortyDaysAgo}T09:00:00Z`
      },
      {
        id: "cust_3",
        name: "C\xF4 Ph\u1EA1m Th\u1ECB Hoa",
        phone: "0918222333",
        address: "210 Nguy\u1EC5n Th\u1ECB Minh Khai, Qu\u1EADn 3",
        createdAt: `${sixMonthsAgo}T09:30:00Z`
      },
      {
        id: "cust_4",
        name: "Anh L\xEA Minh \u0110\u1EE9c",
        phone: "0933444555",
        address: "74 C\xE1ch M\u1EA1ng Th\xE1ng 8, Qu\u1EADn 3",
        createdAt: `${sixMonthsAgo}T10:00:00Z`
      },
      {
        id: "cust_5",
        name: "Ch\u1ECB V\u0169 Thu Th\u1EA3o",
        phone: "0977666555",
        address: "19 Phan X\xEDch Long, Ph\xFA Nhu\u1EADn",
        createdAt: `${sixMonthsAgo}T14:00:00Z`
      },
      {
        id: "cust_6",
        name: "Anh \u0110\u1ED7 Quang Huy",
        phone: "0908112233",
        address: "302 V\xF5 V\u0103n T\u1EA7n, Qu\u1EADn 3",
        createdAt: `${sixMonthsAgo}T15:00:00Z`
      },
      {
        id: "cust_7",
        name: "Ch\xFA Nguy\u1EC5n V\u0103n B\u1EA3y",
        phone: "0913998877",
        address: "15/2 H\xF2a H\u01B0ng, Qu\u1EADn 10",
        createdAt: `${tenDaysAgo}T11:00:00Z`
      },
      {
        id: "cust_8",
        name: "Ch\u1ECB Ho\xE0ng Mai Anh",
        phone: "0988554433",
        address: "90 \u0110i\u1EC7n Bi\xEAn Ph\u1EE7, B\xECnh Th\u1EA1nh",
        createdAt: `${fourDaysAgo}T08:30:00Z`
      }
    ],
    orders: [
      // Today's active orders for Tech 1 (Nguyễn Văn Minh)
      {
        id: "ord_1001",
        code: "DH-1001",
        customerId: "cust_5",
        customerName: "Ch\u1ECB V\u0169 Thu Th\u1EA3o",
        customerPhone: "0977666555",
        customerAddress: "19 Phan X\xEDch Long, Ph\xFA Nhu\u1EADn",
        technicianId: "tech_1",
        technicianName: "Nguy\u1EC5n V\u0103n Minh",
        issueDescription: "V\xF2i n\u01B0\u1EDBc b\u1ED3n r\u1EEDa ch\xE9n r\xF2 r\u1EC9, ki\u1EC3m tra th\xEAm van kh\xF3a t\u1ED5ng d\u01B0\u1EDBi t\u1EE7 b\u1EBFp",
        scheduledDate: today,
        scheduledTime: "09:00",
        status: "pending",
        items: [
          {
            id: "li_1001_1",
            catalogItemId: "cat_svc_nuoc",
            name: "Ti\u1EC1n c\xF4ng s\u1EEDa \u0111\u01B0\u1EDDng \u1ED1ng / thay van n\u01B0\u1EDBc",
            category: "service",
            unit: "ca",
            quantity: 1,
            lockedUnitPrice: 12e4,
            warrantyMonths: 3,
            maintenanceMonths: 0,
            priceLockedAt: `${today}T07:30:00Z`
          }
        ],
        createdAt: `${today}T07:30:00Z`,
        updatedAt: `${today}T07:30:00Z`
      },
      {
        id: "ord_1002",
        code: "DH-1002",
        customerId: "cust_8",
        customerName: "Ch\u1ECB Ho\xE0ng Mai Anh",
        customerPhone: "0988554433",
        customerAddress: "90 \u0110i\u1EC7n Bi\xEAn Ph\u1EE7, B\xECnh Th\u1EA1nh",
        technicianId: "tech_1",
        technicianName: "Nguy\u1EC5n V\u0103n Minh",
        issueDescription: "M\xE1y b\u01A1m k\xEAu to, kh\xF4ng l\xEAn n\u01B0\u1EDBc l\xEAn b\u1ED3n s\xE2n th\u01B0\u1EE3ng",
        scheduledDate: today,
        scheduledTime: "14:00",
        status: "pending",
        items: [],
        createdAt: `${today}T08:00:00Z`,
        updatedAt: `${today}T08:00:00Z`
      },
      {
        id: "ord_1003",
        code: "DH-1003",
        customerId: "cust_7",
        customerName: "Ch\xFA Nguy\u1EC5n V\u0103n B\u1EA3y",
        customerPhone: "0913998877",
        customerAddress: "15/2 H\xF2a H\u01B0ng, Qu\u1EADn 10",
        technicianId: "tech_1",
        technicianName: "Nguy\u1EC5n V\u0103n Minh",
        issueDescription: "B\u1EE5c \u1ED1ng n\u01B0\u1EDBc \xE2m t\u01B0\u1EDDng khu v\u1EF1c s\xE2n sau",
        scheduledDate: today,
        scheduledTime: "16:00",
        status: "waiting_material",
        statusNote: "C\u1EA7n mua th\xEAm 6m \u1ED1ng n\u01B0\u1EDBc PVC phi 27 v\xE0 keo d\xE1n, chi\u1EC1u quay l\u1EA1i \u0111\u1EA5u n\u1ED1i ti\u1EBFp",
        items: [
          {
            id: "li_1003_1",
            catalogItemId: "cat_svc_nuoc",
            name: "Ti\u1EC1n c\xF4ng s\u1EEDa \u0111\u01B0\u1EDDng \u1ED1ng / thay van n\u01B0\u1EDBc",
            category: "service",
            unit: "ca",
            quantity: 1,
            lockedUnitPrice: 12e4,
            warrantyMonths: 3,
            maintenanceMonths: 0,
            priceLockedAt: `${today}T08:15:00Z`
          }
        ],
        createdAt: `${today}T08:15:00Z`,
        updatedAt: `${today}T08:25:00Z`
      },
      // Today's active order for Tech 2 (Trần Quốc Tuấn)
      {
        id: "ord_1004",
        code: "DH-1004",
        customerId: "cust_6",
        customerName: "Anh \u0110\u1ED7 Quang Huy",
        customerPhone: "0908112233",
        customerAddress: "302 V\xF5 V\u0103n T\u1EA7n, Qu\u1EADn 3",
        technicianId: "tech_2",
        technicianName: "Tr\u1EA7n Qu\u1ED1c Tu\u1EA5n",
        issueDescription: "Ki\u1EC3m tra CB ph\xF2ng kh\xE1ch hay t\u1EF1 nh\u1EA3y khi b\u1EADt b\xECnh n\xF3ng l\u1EA1nh",
        scheduledDate: today,
        scheduledTime: "10:30",
        status: "pending",
        items: [],
        createdAt: `${today}T08:20:00Z`,
        updatedAt: `${today}T08:20:00Z`
      },
      // Cancelled order
      {
        id: "ord_1005",
        code: "DH-1005",
        customerId: "cust_2",
        customerName: "Anh Tr\u1EA7n V\u0103n Nam",
        customerPhone: "0909888777",
        customerAddress: "45/8 Hai B\xE0 Tr\u01B0ng, Ph\u01B0\u1EDDng \u0110a Kao, Qu\u1EADn 1",
        technicianId: "tech_3",
        technicianName: "L\xEA Ho\xE0ng H\xF9ng",
        issueDescription: "B\xE1o th\xF4ng t\u1EAFc b\u1ED3n r\u1EEDa m\u1EB7t t\u1EA7ng 2",
        scheduledDate: yesterday,
        scheduledTime: "15:00",
        status: "cancelled",
        statusNote: "Kh\xE1ch t\u1EF1 x\u1EED l\xFD th\xF4ng \u0111\u01B0\u1EE3c tr\u01B0\u1EDBc khi th\u1EE3 qua n\xEAn b\xE1o h\u1EE7y h\u1EB9n",
        items: [],
        createdAt: `${yesterday}T09:00:00Z`,
        updatedAt: `${yesterday}T13:30:00Z`
      },
      // Recent completed orders (for Revenue & Material stats this month)
      {
        id: "ord_0996",
        code: "DH-0996",
        customerId: "cust_8",
        customerName: "Ch\u1ECB Ho\xE0ng Mai Anh",
        customerPhone: "0988554433",
        customerAddress: "90 \u0110i\u1EC7n Bi\xEAn Ph\u1EE7, B\xECnh Th\u1EA1nh",
        technicianId: "tech_1",
        technicianName: "Nguy\u1EC5n V\u0103n Minh",
        issueDescription: "Thay c\xF4ng t\u1EAFc ph\xF2ng ng\u1EE7 v\xE0 \u0111i l\u1EA1i \u0111o\u1EA1n d\xE2y ngu\u1ED3n ban c\xF4ng",
        scheduledDate: twoDaysAgo,
        scheduledTime: "09:30",
        status: "completed",
        completedAt: `${twoDaysAgo}T11:15:00Z`,
        items: [
          {
            id: "li_0996_1",
            catalogItemId: "cat_svc_dien",
            name: "Ki\u1EC3m tra & x\u1EED l\xFD s\u1EF1 c\u1ED1 ch\u1EADp \u0111i\u1EC7n",
            category: "service",
            unit: "ca",
            quantity: 1,
            lockedUnitPrice: 15e4,
            warrantyMonths: 3,
            maintenanceMonths: 0,
            priceLockedAt: `${twoDaysAgo}T11:00:00Z`
          },
          {
            id: "li_0996_2",
            catalogItemId: "cat_congtac",
            name: "C\xF4ng t\u1EAFc \u0111\xF4i Panasonic",
            category: "material",
            unit: "c\xE1i",
            quantity: 4,
            lockedUnitPrice: 65e3,
            warrantyMonths: 12,
            maintenanceMonths: 0,
            priceLockedAt: `${twoDaysAgo}T11:00:00Z`
          },
          {
            id: "li_0996_3",
            catalogItemId: "cat_day25",
            name: "D\xE2y \u0111i\u1EC7n Cadivi 2x2.5",
            category: "material",
            unit: "m\xE9t",
            quantity: 18,
            lockedUnitPrice: 22e3,
            warrantyMonths: 12,
            maintenanceMonths: 0,
            priceLockedAt: `${twoDaysAgo}T11:00:00Z`
          }
        ],
        createdAt: `${twoDaysAgo}T08:00:00Z`,
        updatedAt: `${twoDaysAgo}T11:15:00Z`
      },
      {
        id: "ord_0995",
        code: "DH-0995",
        customerId: "cust_7",
        customerName: "Ch\xFA Nguy\u1EC5n V\u0103n B\u1EA3y",
        customerPhone: "0913998877",
        customerAddress: "15/2 H\xF2a H\u01B0ng, Qu\u1EADn 10",
        technicianId: "tech_3",
        technicianName: "L\xEA Ho\xE0ng H\xF9ng",
        issueDescription: "Thay van t\u1ED5ng t\u1EA7ng tr\u1EC7t v\xE0 l\u1EAFp th\xEAm CB ch\u1ED1ng gi\u1EADt cho b\xECnh n\u01B0\u1EDBc n\xF3ng",
        scheduledDate: fourDaysAgo,
        scheduledTime: "14:00",
        status: "completed",
        completedAt: `${fourDaysAgo}T15:40:00Z`,
        items: [
          {
            id: "li_0995_1",
            catalogItemId: "cat_svc_nuoc",
            name: "Ti\u1EC1n c\xF4ng s\u1EEDa \u0111\u01B0\u1EDDng \u1ED1ng / thay van n\u01B0\u1EDBc",
            category: "service",
            unit: "ca",
            quantity: 1,
            lockedUnitPrice: 12e4,
            warrantyMonths: 3,
            maintenanceMonths: 0,
            priceLockedAt: `${fourDaysAgo}T15:30:00Z`
          },
          {
            id: "li_0995_2",
            catalogItemId: "cat_van27",
            name: "Van t\u1ED5ng phi 27",
            category: "material",
            unit: "c\xE1i",
            quantity: 1,
            lockedUnitPrice: 15e4,
            warrantyMonths: 3,
            maintenanceMonths: 0,
            priceLockedAt: `${fourDaysAgo}T15:30:00Z`
          },
          {
            id: "li_0995_3",
            catalogItemId: "cat_cb32",
            name: "Aptomat (CB) ch\u1ED1ng gi\u1EADt 32A",
            category: "material",
            unit: "c\xE1i",
            quantity: 1,
            lockedUnitPrice: 24e4,
            warrantyMonths: 12,
            maintenanceMonths: 0,
            priceLockedAt: `${fourDaysAgo}T15:30:00Z`
          },
          {
            id: "li_0995_4",
            catalogItemId: "cat_day25",
            name: "D\xE2y \u0111i\u1EC7n Cadivi 2x2.5",
            category: "material",
            unit: "m\xE9t",
            quantity: 10,
            lockedUnitPrice: 22e3,
            warrantyMonths: 12,
            maintenanceMonths: 0,
            priceLockedAt: `${fourDaysAgo}T15:30:00Z`
          }
        ],
        createdAt: `${fourDaysAgo}T10:00:00Z`,
        updatedAt: `${fourDaysAgo}T15:40:00Z`
      },
      // Warranty Demo Orders (45 days ago -> 45 days left on 3-mo pump capacitor; 40 days ago -> expired 1-mo valve)
      {
        id: "ord_0980",
        code: "DH-0980",
        customerId: "cust_1",
        customerName: "Ch\u1ECB Nguy\u1EC5n Th\u1ECB Lan",
        customerPhone: "0901234567",
        customerAddress: "128 L\xEA L\u1EE3i, Ph\u01B0\u1EDDng B\u1EBFn Th\xE0nh, Qu\u1EADn 1",
        technicianId: "tech_1",
        technicianName: "Nguy\u1EC5n V\u0103n Minh",
        issueDescription: "S\u1EEDa m\xE1y b\u01A1m n\u01B0\u1EDBc kh\xF4ng ch\u1EA1y, thay t\u1EE5 \u0111\u1EC1",
        scheduledDate: fortyFiveDaysAgo,
        scheduledTime: "09:00",
        status: "completed",
        completedAt: `${fortyFiveDaysAgo}T10:20:00Z`,
        items: [
          {
            id: "li_0980_1",
            catalogItemId: "cat_svc_bom",
            name: "Ti\u1EC1n c\xF4ng s\u1EEDa m\xE1y b\u01A1m t\u1EA1i nh\xE0",
            category: "service",
            unit: "ca",
            quantity: 1,
            lockedUnitPrice: 1e5,
            warrantyMonths: 1,
            maintenanceMonths: 0,
            priceLockedAt: `${fortyFiveDaysAgo}T10:15:00Z`
          },
          {
            id: "li_0980_2",
            catalogItemId: "cat_tu20",
            name: "T\u1EE5 m\xE1y b\u01A1m 20uF",
            category: "material",
            unit: "c\xE1i",
            quantity: 1,
            lockedUnitPrice: 5e4,
            warrantyMonths: 3,
            maintenanceMonths: 0,
            priceLockedAt: `${fortyFiveDaysAgo}T10:15:00Z`
          }
        ],
        createdAt: `${fortyFiveDaysAgo}T08:00:00Z`,
        updatedAt: `${fortyFiveDaysAgo}T10:20:00Z`
      },
      {
        id: "ord_0978",
        code: "DH-0978",
        customerId: "cust_2",
        customerName: "Anh Tr\u1EA7n V\u0103n Nam",
        customerPhone: "0909888777",
        customerAddress: "45/8 Hai B\xE0 Tr\u01B0ng, Ph\u01B0\u1EDDng \u0110a Kao, Qu\u1EADn 1",
        technicianId: "tech_1",
        technicianName: "Nguy\u1EC5n V\u0103n Minh",
        issueDescription: "M\xE1y b\u01A1m b\u1ECB t\u1EE5t n\u01B0\u1EDBc, thay van m\u1ED9t chi\u1EC1u \u0111\u1ED3ng",
        scheduledDate: fortyDaysAgo,
        scheduledTime: "15:30",
        status: "completed",
        completedAt: `${fortyDaysAgo}T16:45:00Z`,
        items: [
          {
            id: "li_0978_1",
            catalogItemId: "cat_svc_bom",
            name: "Ti\u1EC1n c\xF4ng s\u1EEDa m\xE1y b\u01A1m t\u1EA1i nh\xE0",
            category: "service",
            unit: "ca",
            quantity: 1,
            lockedUnitPrice: 1e5,
            warrantyMonths: 1,
            maintenanceMonths: 0,
            priceLockedAt: `${fortyDaysAgo}T16:40:00Z`
          },
          {
            id: "li_0978_2",
            catalogItemId: "cat_van1c",
            name: "Van m\u1ED9t chi\u1EC1u \u0111\u1ED3ng phi 27",
            category: "material",
            unit: "c\xE1i",
            quantity: 1,
            lockedUnitPrice: 85e3,
            warrantyMonths: 1,
            maintenanceMonths: 0,
            priceLockedAt: `${fortyDaysAgo}T16:40:00Z`
          }
        ],
        createdAt: `${fortyDaysAgo}T13:00:00Z`,
        updatedAt: `${fortyDaysAgo}T16:45:00Z`
      },
      // Maintenance Due Today (6 months ago with 6-month maintenance schedule)
      {
        id: "ord_0901",
        code: "DH-0901",
        customerId: "cust_3",
        customerName: "C\xF4 Ph\u1EA1m Th\u1ECB Hoa",
        customerPhone: "0918222333",
        customerAddress: "210 Nguy\u1EC5n Th\u1ECB Minh Khai, Qu\u1EADn 3",
        technicianId: "tech_2",
        technicianName: "Tr\u1EA7n Qu\u1ED1c Tu\u1EA5n",
        issueDescription: "V\u1EC7 sinh v\xE0 n\u1EA1p gas b\u1ED5 sung 2 m\xE1y l\u1EA1nh ph\xF2ng ng\u1EE7",
        scheduledDate: sixMonthsAgo,
        scheduledTime: "09:00",
        status: "completed",
        completedAt: `${sixMonthsAgo}T11:00:00Z`,
        items: [
          {
            id: "li_0901_1",
            catalogItemId: "cat_svc_ac",
            name: "V\u1EC7 sinh & b\u1EA3o d\u01B0\u1EE1ng \u0111i\u1EC1u h\xF2a treo t\u01B0\u1EDDng",
            category: "service",
            unit: "m\xE1y",
            quantity: 2,
            lockedUnitPrice: 18e4,
            warrantyMonths: 1,
            maintenanceMonths: 6,
            priceLockedAt: `${sixMonthsAgo}T10:50:00Z`
          }
        ],
        createdAt: `${sixMonthsAgo}T08:00:00Z`,
        updatedAt: `${sixMonthsAgo}T11:00:00Z`
      },
      {
        id: "ord_0902",
        code: "DH-0902",
        customerId: "cust_4",
        customerName: "Anh L\xEA Minh \u0110\u1EE9c",
        customerPhone: "0933444555",
        customerAddress: "74 C\xE1ch M\u1EA1ng Th\xE1ng 8, Qu\u1EADn 3",
        technicianId: "tech_2",
        technicianName: "Tr\u1EA7n Qu\u1ED1c Tu\u1EA5n",
        issueDescription: "V\u1EC7 sinh \u0111i\u1EC1u h\xF2a ph\xF2ng l\xE0m vi\u1EC7c \u0111\u1ECBnh k\u1EF3",
        scheduledDate: sixMonthsAgo,
        scheduledTime: "14:00",
        status: "completed",
        completedAt: `${sixMonthsAgo}T15:10:00Z`,
        items: [
          {
            id: "li_0902_1",
            catalogItemId: "cat_svc_ac",
            name: "V\u1EC7 sinh & b\u1EA3o d\u01B0\u1EE1ng \u0111i\u1EC1u h\xF2a treo t\u01B0\u1EDDng",
            category: "service",
            unit: "m\xE1y",
            quantity: 1,
            lockedUnitPrice: 18e4,
            warrantyMonths: 1,
            maintenanceMonths: 6,
            priceLockedAt: `${sixMonthsAgo}T15:00:00Z`
          }
        ],
        createdAt: `${sixMonthsAgo}T12:00:00Z`,
        updatedAt: `${sixMonthsAgo}T15:10:00Z`
      },
      {
        id: "ord_0903",
        code: "DH-0903",
        customerId: "cust_5",
        customerName: "Ch\u1ECB V\u0169 Thu Th\u1EA3o",
        customerPhone: "0977666555",
        customerAddress: "19 Phan X\xEDch Long, Ph\xFA Nhu\u1EADn",
        technicianId: "tech_2",
        technicianName: "Tr\u1EA7n Qu\u1ED1c Tu\u1EA5n",
        issueDescription: "V\u1EC7 sinh \u0111i\u1EC1u h\xF2a ph\xF2ng kh\xE1ch",
        scheduledDate: sixMonthsAgo,
        scheduledTime: "16:00",
        status: "completed",
        completedAt: `${sixMonthsAgo}T17:15:00Z`,
        items: [
          {
            id: "li_0903_1",
            catalogItemId: "cat_svc_ac",
            name: "V\u1EC7 sinh & b\u1EA3o d\u01B0\u1EE1ng \u0111i\u1EC1u h\xF2a treo t\u01B0\u1EDDng",
            category: "service",
            unit: "m\xE1y",
            quantity: 1,
            lockedUnitPrice: 18e4,
            warrantyMonths: 1,
            maintenanceMonths: 6,
            priceLockedAt: `${sixMonthsAgo}T17:10:00Z`
          }
        ],
        createdAt: `${sixMonthsAgo}T14:30:00Z`,
        updatedAt: `${sixMonthsAgo}T17:15:00Z`
      },
      {
        id: "ord_0904",
        code: "DH-0904",
        customerId: "cust_6",
        customerName: "Anh \u0110\u1ED7 Quang Huy",
        customerPhone: "0908112233",
        customerAddress: "302 V\xF5 V\u0103n T\u1EA7n, Qu\u1EADn 3",
        technicianId: "tech_2",
        technicianName: "Tr\u1EA7n Qu\u1ED1c Tu\u1EA5n",
        issueDescription: "B\u1EA3o d\u01B0\u1EE1ng 2 m\xE1y l\u1EA1nh v\u0103n ph\xF2ng",
        scheduledDate: sixMonthsAgo,
        scheduledTime: "10:00",
        status: "completed",
        completedAt: `${sixMonthsAgo}T11:45:00Z`,
        items: [
          {
            id: "li_0904_1",
            catalogItemId: "cat_svc_ac",
            name: "V\u1EC7 sinh & b\u1EA3o d\u01B0\u1EE1ng \u0111i\u1EC1u h\xF2a treo t\u01B0\u1EDDng",
            category: "service",
            unit: "m\xE1y",
            quantity: 2,
            lockedUnitPrice: 18e4,
            warrantyMonths: 1,
            maintenanceMonths: 6,
            priceLockedAt: `${sixMonthsAgo}T11:35:00Z`
          }
        ],
        createdAt: `${sixMonthsAgo}T09:00:00Z`,
        updatedAt: `${sixMonthsAgo}T11:45:00Z`
      },
      // Upcoming maintenance for Chị Lan (cust_1) in 12 days so Customer Portal shows all 3 sections populated!
      {
        id: "ord_0915",
        code: "DH-0915",
        customerId: "cust_1",
        customerName: "Ch\u1ECB Nguy\u1EC5n Th\u1ECB Lan",
        customerPhone: "0901234567",
        customerAddress: "128 L\xEA L\u1EE3i, Ph\u01B0\u1EDDng B\u1EBFn Th\xE0nh, Qu\u1EADn 1",
        technicianId: "tech_2",
        technicianName: "Tr\u1EA7n Qu\u1ED1c Tu\u1EA5n",
        issueDescription: "V\u1EC7 sinh \u0111i\u1EC1u h\xF2a ph\xF2ng kh\xE1ch \u0111\u1ECBnh k\u1EF3 6 th\xE1ng",
        scheduledDate: addDaysToDate(sixMonthsAgo, 12),
        scheduledTime: "10:00",
        status: "completed",
        completedAt: `${addDaysToDate(sixMonthsAgo, 12)}T11:15:00Z`,
        items: [
          {
            id: "li_0915_1",
            catalogItemId: "cat_svc_ac",
            name: "V\u1EC7 sinh & b\u1EA3o d\u01B0\u1EE1ng \u0111i\u1EC1u h\xF2a treo t\u01B0\u1EDDng",
            category: "service",
            unit: "m\xE1y",
            quantity: 1,
            lockedUnitPrice: 18e4,
            warrantyMonths: 1,
            maintenanceMonths: 6,
            priceLockedAt: `${addDaysToDate(sixMonthsAgo, 12)}T11:10:00Z`
          }
        ],
        createdAt: `${addDaysToDate(sixMonthsAgo, 12)}T09:00:00Z`,
        updatedAt: `${addDaysToDate(sixMonthsAgo, 12)}T11:15:00Z`
      }
    ]
  };
}

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var APP_ROOT = fs.existsSync(path.resolve(__dirname, "package.json")) ? __dirname : fs.existsSync(path.resolve(__dirname, "..", "package.json")) ? path.resolve(__dirname, "..") : process.cwd();
var DATA_DIR = path.resolve(APP_ROOT, "data");
var STORE_PATH = path.join(DATA_DIR, "store.json");
var SESSIONS_PATH = path.join(DATA_DIR, "sessions.json");
function sanitizeUser(user) {
  const { passwordHash: _omit, ...rest } = user;
  return rest;
}
function ensureStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_PATH)) {
      const initial = createInitialStoreData();
      fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), "utf-8");
      return initial;
    }
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.users) || parsed.users.length === 0) {
      const seed = createInitialStoreData();
      parsed.users = seed.users;
    }
    parsed.technicians = deriveActiveTechnicians(parsed.users);
    return parsed;
  } catch (err) {
    console.warn("Could not read/init disk store, using memory fallback:", err);
    return createInitialStoreData();
  }
}
function saveStore(data) {
  data.technicians = deriveActiveTechnicians(data.users);
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpPath = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmpPath, STORE_PATH);
  } catch (err) {
    console.error("Failed to persist store to disk:", err);
  }
}
function loadSessions() {
  try {
    if (!fs.existsSync(SESSIONS_PATH)) return {};
    return JSON.parse(fs.readFileSync(SESSIONS_PATH, "utf-8"));
  } catch {
    return {};
  }
}
function saveSessions(sessions2) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpPath = `${SESSIONS_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(sessions2, null, 2), "utf-8");
    fs.renameSync(tmpPath, SESSIONS_PATH);
  } catch (err) {
    console.error("Failed to persist sessions to disk:", err);
  }
}
var store = ensureStore();
var sessions = loadSessions();
function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }
  return null;
}
function requireStaffAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Vui l\xF2ng \u0111\u0103ng nh\u1EADp \u0111\u1EC3 ti\u1EBFp t\u1EE5c." });
    return;
  }
  const userId = sessions[token];
  const user = userId ? store.users.find((u) => u.id === userId) : void 0;
  if (!user || !user.active) {
    res.status(401).json({ error: "Phi\xEAn \u0111\u0103ng nh\u1EADp h\u1EBFt h\u1EA1n ho\u1EB7c t\xE0i kho\u1EA3n \u0111\xE3 b\u1ECB kh\xF3a." });
    return;
  }
  req.authUser = user;
  req.authToken = token;
  next();
}
function requireAdminRole(req, res, next) {
  if (!req.authUser || req.authUser.role !== "admin") {
    res.status(403).json({ error: "Ch\u1EC9 qu\u1EA3n tr\u1ECB vi\xEAn (Admin) m\u1EDBi c\xF3 quy\u1EC1n thao t\xE1c m\u1EE5c n\xE0y." });
    return;
  }
  next();
}
var app = express();
app.use(express.json({ limit: "2mb" }));
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});
app.get("/api/public/portal-info", (_req, res) => {
  res.json({
    shopHotline: store.shopHotline,
    samplePhones: store.customers.slice(0, 3).map((c) => ({
      name: c.name,
      phone: c.phone
    }))
  });
});
app.get("/api/customer-lookup", (req, res) => {
  const rawPhone = String(req.query.phone ?? "").trim();
  const digits = normalizePhone(rawPhone);
  if (digits.length < 8) {
    res.status(400).json({ error: "Vui l\xF2ng nh\u1EADp s\u1ED1 \u0111i\u1EC7n tho\u1EA1i \u0111\u1EA7y \u0111\u1EE7." });
    return;
  }
  const customer = store.customers.find(
    (c) => normalizePhone(c.phone) === digits
  );
  if (!customer) {
    res.status(404).json({
      error: "Kh\xF4ng t\xECm th\u1EA5y h\u1ED3 s\u01A1 kh\xE1ch h\xE0ng v\u1EDBi s\u1ED1 \u0111i\u1EC7n tho\u1EA1i n\xE0y."
    });
    return;
  }
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const customerOrders = store.orders.filter((o) => o.customerId === customer.id).sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
  const warranties = evaluateWarrantyRecords(customerOrders, today);
  const maintenance = evaluateMaintenanceAlerts(customerOrders, today, 365);
  res.json({
    shopHotline: store.shopHotline,
    customer,
    orders: customerOrders,
    warranties,
    maintenance
  });
});
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  const cleanUser = (username ?? "").trim().toLowerCase();
  const cleanPass = password ?? "";
  if (!cleanUser || !cleanPass) {
    res.status(400).json({ error: "Vui l\xF2ng nh\u1EADp t\xEAn \u0111\u0103ng nh\u1EADp v\xE0 m\u1EADt kh\u1EA9u." });
    return;
  }
  const matched = store.users.find(
    (u) => u.username.toLowerCase() === cleanUser || normalizePhone(u.phone) === normalizePhone(cleanUser)
  );
  if (!matched || matched.passwordHash !== hashPassword(cleanPass)) {
    res.status(401).json({ error: "T\xEAn \u0111\u0103ng nh\u1EADp ho\u1EB7c m\u1EADt kh\u1EA9u kh\xF4ng ch\xEDnh x\xE1c." });
    return;
  }
  if (!matched.active) {
    res.status(403).json({ error: "T\xE0i kho\u1EA3n n\xE0y \u0111ang b\u1ECB t\u1EA1m kh\xF3a. Vui l\xF2ng li\xEAn h\u1EC7 Admin." });
    return;
  }
  const token = randomUUID();
  sessions[token] = matched.id;
  saveSessions(sessions);
  res.json({
    token,
    user: sanitizeUser(matched)
  });
});
app.get("/api/auth/me", requireStaffAuth, (req, res) => {
  res.json({ user: sanitizeUser(req.authUser) });
});
app.post("/api/auth/logout", (req, res) => {
  const token = extractToken(req);
  if (token && sessions[token]) {
    delete sessions[token];
    saveSessions(sessions);
  }
  res.json({ ok: true });
});
app.get("/api/store", requireStaffAuth, (req, res) => {
  const isAdmin = req.authUser?.role === "admin";
  res.json({
    shopHotline: store.shopHotline,
    users: isAdmin ? store.users.map(sanitizeUser) : [],
    customers: store.customers,
    technicians: deriveActiveTechnicians(store.users),
    catalog: store.catalog,
    orders: store.orders
  });
});
app.get(
  "/api/users",
  requireStaffAuth,
  requireAdminRole,
  (_req, res) => {
    res.json({ users: store.users.map(sanitizeUser) });
  }
);
app.post(
  "/api/users",
  requireStaffAuth,
  requireAdminRole,
  (req, res) => {
    const { username, password, fullName, phone, role, specialty, active } = req.body;
    const nextRole = role === "admin" ? "admin" : "technician";
    const validationErr = validateStaffUserInput(
      {
        username: username ?? "",
        fullName: fullName ?? "",
        phone: phone ?? "",
        role: nextRole,
        password: password ?? ""
      },
      store.users
    );
    if (validationErr) {
      res.status(400).json({ error: validationErr });
      return;
    }
    const newUser = {
      id: nextRole === "technician" ? `tech_${Date.now()}` : `usr_${Date.now()}`,
      username: (username ?? "").trim().toLowerCase(),
      passwordHash: hashPassword((password ?? "").trim()),
      fullName: (fullName ?? "").trim(),
      phone: (phone ?? "").trim(),
      role: nextRole,
      specialty: (specialty ?? "").trim() || (nextRole === "admin" ? "Qu\u1EA3n tr\u1ECB h\u1EC7 th\u1ED1ng" : "K\u1EF9 thu\u1EADt vi\xEAn"),
      active: active !== false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    store.users.unshift(newUser);
    saveStore(store);
    res.status(201).json({ user: sanitizeUser(newUser) });
  }
);
app.patch(
  "/api/users/:id",
  requireStaffAuth,
  requireAdminRole,
  (req, res) => {
    const { id } = req.params;
    const existing = store.users.find((u) => u.id === id);
    if (!existing) {
      res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y ng\u01B0\u1EDDi d\xF9ng." });
      return;
    }
    const { username, password, fullName, phone, role, specialty, active } = req.body;
    const nextRole = role === "admin" || role === "technician" ? role : existing.role;
    const nextActive = typeof active === "boolean" ? active : existing.active;
    const guardErr = checkAdminSafetyGuard(
      store.users,
      id,
      "update",
      { role: nextRole, active: nextActive },
      req.authUser?.id
    );
    if (guardErr) {
      res.status(400).json({ error: guardErr });
      return;
    }
    const validationErr = validateStaffUserInput(
      {
        username: username ?? existing.username,
        fullName: fullName ?? existing.fullName,
        phone: phone ?? existing.phone,
        role: nextRole,
        password
      },
      store.users,
      id
    );
    if (validationErr) {
      res.status(400).json({ error: validationErr });
      return;
    }
    existing.username = (username ?? existing.username).trim().toLowerCase();
    existing.fullName = (fullName ?? existing.fullName).trim();
    existing.phone = (phone ?? existing.phone).trim();
    existing.role = nextRole;
    existing.active = nextActive;
    if (typeof specialty === "string") {
      existing.specialty = specialty.trim() || (nextRole === "admin" ? "Qu\u1EA3n tr\u1ECB h\u1EC7 th\u1ED1ng" : "K\u1EF9 thu\u1EADt vi\xEAn");
    }
    if (password && password.trim().length > 0) {
      existing.passwordHash = hashPassword(password.trim());
    }
    for (const ord of store.orders) {
      if (ord.technicianId === existing.id && ord.status !== "completed") {
        ord.technicianName = existing.fullName;
      }
    }
    saveStore(store);
    res.json({ user: sanitizeUser(existing) });
  }
);
app.delete(
  "/api/users/:id",
  requireStaffAuth,
  requireAdminRole,
  (req, res) => {
    const { id } = req.params;
    const guardErr = checkAdminSafetyGuard(
      store.users,
      id,
      "delete",
      void 0,
      req.authUser?.id
    );
    if (guardErr) {
      res.status(400).json({ error: guardErr });
      return;
    }
    store.users = store.users.filter((u) => u.id !== id);
    for (const [tok, uid] of Object.entries(sessions)) {
      if (uid === id) delete sessions[tok];
    }
    saveSessions(sessions);
    saveStore(store);
    res.json({ ok: true });
  }
);
app.post(
  "/api/orders",
  requireStaffAuth,
  requireAdminRole,
  (req, res) => {
    const {
      customerId,
      customerName,
      customerPhone,
      customerAddress,
      technicianId,
      issueDescription,
      scheduledDate,
      scheduledTime,
      items
    } = req.body;
    const cleanPhone = (customerPhone ?? "").trim();
    const cleanName = (customerName ?? "").trim();
    const cleanAddress = (customerAddress ?? "").trim();
    const cleanIssue = (issueDescription ?? "").trim();
    if (!cleanPhone || normalizePhone(cleanPhone).length < 8) {
      res.status(400).json({ error: "Vui l\xF2ng nh\u1EADp s\u1ED1 \u0111i\u1EC7n tho\u1EA1i h\u1EE3p l\u1EC7." });
      return;
    }
    if (!cleanName || !cleanAddress) {
      res.status(400).json({ error: "Vui l\xF2ng \u0111i\u1EC1n \u0111\u1EA7y \u0111\u1EE7 h\u1ECD t\xEAn v\xE0 \u0111\u1ECBa ch\u1EC9 kh\xE1ch h\xE0ng." });
      return;
    }
    if (!cleanIssue) {
      res.status(400).json({ error: "Vui l\xF2ng m\xF4 t\u1EA3 t\xECnh tr\u1EA1ng h\u01B0 h\u1ECFng c\u1EE7a kh\xE1ch h\xE0ng." });
      return;
    }
    const activeTechs = deriveActiveTechnicians(store.users);
    const tech = activeTechs.find((t) => t.id === technicianId) ?? activeTechs[0];
    if (!tech) {
      res.status(400).json({ error: "Ch\u01B0a c\xF3 k\u1EF9 thu\u1EADt vi\xEAn \u0111ang ho\u1EA1t \u0111\u1ED9ng." });
      return;
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    let customer = customerId ? store.customers.find((c) => c.id === customerId) : store.customers.find(
      (c) => normalizePhone(c.phone) === normalizePhone(cleanPhone)
    );
    if (!customer) {
      customer = {
        id: `cust_${Date.now()}`,
        name: cleanName,
        phone: cleanPhone,
        address: cleanAddress,
        createdAt: nowIso
      };
      store.customers.unshift(customer);
    } else {
      customer.name = cleanName;
      customer.address = cleanAddress;
    }
    const nextNum = 1001 + store.orders.length;
    const order = {
      id: `ord_${Date.now()}`,
      code: `DH-${nextNum}`,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      technicianId: tech.id,
      technicianName: tech.name,
      issueDescription: cleanIssue,
      scheduledDate: scheduledDate || nowIso.slice(0, 10),
      scheduledTime: scheduledTime || "09:00",
      status: "pending",
      items: Array.isArray(items) ? items : [],
      createdAt: nowIso,
      updatedAt: nowIso
    };
    store.orders.unshift(order);
    saveStore(store);
    res.status(201).json({ order, customer });
  }
);
app.patch("/api/orders/:id", requireStaffAuth, (req, res) => {
  const { id } = req.params;
  const order = store.orders.find((o) => o.id === id);
  if (!order) {
    res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y \u0111\u01A1n h\xE0ng." });
    return;
  }
  if (req.authUser?.role === "technician" && order.technicianId !== req.authUser.id) {
    res.status(403).json({ error: "B\u1EA1n ch\u1EC9 c\xF3 quy\u1EC1n c\u1EADp nh\u1EADt \u0111\u01A1n \u0111\u01B0\u1EE3c giao cho m\xECnh." });
    return;
  }
  const {
    status,
    statusNote,
    technicianId,
    scheduledDate,
    scheduledTime,
    issueDescription,
    items
  } = req.body;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  if (typeof issueDescription === "string" && issueDescription.trim()) {
    order.issueDescription = issueDescription.trim();
  }
  if (typeof scheduledDate === "string" && scheduledDate) {
    order.scheduledDate = scheduledDate;
  }
  if (typeof scheduledTime === "string" && scheduledTime) {
    order.scheduledTime = scheduledTime;
  }
  if (typeof technicianId === "string" && req.authUser?.role === "admin") {
    const activeTechs = deriveActiveTechnicians(store.users);
    const tech = activeTechs.find((t) => t.id === technicianId);
    if (tech) {
      order.technicianId = tech.id;
      order.technicianName = tech.name;
    }
  }
  if (Array.isArray(items)) {
    order.items = items.map((item) => ({
      ...item,
      lockedUnitPrice: Number(item.lockedUnitPrice),
      quantity: Math.max(0.1, Number(item.quantity) || 1),
      warrantyMonths: Number(item.warrantyMonths) || 0,
      maintenanceMonths: Number(item.maintenanceMonths) || 0,
      priceLockedAt: item.priceLockedAt || nowIso
    }));
  }
  if (typeof statusNote === "string") {
    order.statusNote = statusNote.trim();
  }
  if (status) {
    order.status = status;
    if (status === "completed" && !order.completedAt) {
      order.completedAt = nowIso;
    } else if (status !== "completed") {
      order.completedAt = void 0;
    }
  }
  order.updatedAt = nowIso;
  saveStore(store);
  res.json({ order });
});
app.patch(
  "/api/orders/:orderId/items/:lineItemId/followup",
  requireStaffAuth,
  requireAdminRole,
  (req, res) => {
    const { orderId, lineItemId } = req.params;
    const { followedUp } = req.body;
    const order = store.orders.find((o) => o.id === orderId);
    if (!order) {
      res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y \u0111\u01A1n h\xE0ng." });
      return;
    }
    const item = order.items.find((i) => i.id === lineItemId);
    if (!item) {
      res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y h\u1EA1ng m\u1EE5c." });
      return;
    }
    item.maintenanceFollowedUp = Boolean(followedUp);
    order.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    saveStore(store);
    res.json({ order });
  }
);
app.post("/api/catalog", requireStaffAuth, requireAdminRole, (req, res) => {
  const {
    name,
    category,
    unit,
    currentPrice,
    defaultWarrantyMonths,
    defaultMaintenanceMonths
  } = req.body;
  if (!name || !name.trim()) {
    res.status(400).json({ error: "T\xEAn d\u1ECBch v\u1EE5 / v\u1EADt t\u01B0 kh\xF4ng \u0111\u01B0\u1EE3c tr\u1ED1ng." });
    return;
  }
  const price = Number(currentPrice);
  if (!Number.isFinite(price) || price < 0) {
    res.status(400).json({ error: "\u0110\u01A1n gi\xE1 ph\u1EA3i l\u1EDBn h\u01A1n ho\u1EB7c b\u1EB1ng 0." });
    return;
  }
  const newItem = {
    id: `cat_${Date.now()}`,
    name: name.trim(),
    category: category === "service" ? "service" : "material",
    unit: (unit ?? "c\xE1i").trim() || "c\xE1i",
    currentPrice: Math.round(price),
    defaultWarrantyMonths: Number(defaultWarrantyMonths) || 0,
    defaultMaintenanceMonths: Number(defaultMaintenanceMonths) || 0,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  store.catalog.unshift(newItem);
  saveStore(store);
  res.status(201).json({ item: newItem });
});
app.patch(
  "/api/catalog/:id",
  requireStaffAuth,
  requireAdminRole,
  (req, res) => {
    const { id } = req.params;
    const item = store.catalog.find((c) => c.id === id);
    if (!item) {
      res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y m\u1EE5c b\u1EA3ng gi\xE1." });
      return;
    }
    const {
      name,
      category,
      unit,
      currentPrice,
      defaultWarrantyMonths,
      defaultMaintenanceMonths
    } = req.body;
    if (typeof name === "string" && name.trim()) item.name = name.trim();
    if (category === "service" || category === "material")
      item.category = category;
    if (typeof unit === "string" && unit.trim()) item.unit = unit.trim();
    if (currentPrice !== void 0) {
      const parsed = Number(currentPrice);
      if (!Number.isFinite(parsed) || parsed < 0) {
        res.status(400).json({ error: "\u0110\u01A1n gi\xE1 kh\xF4ng h\u1EE3p l\u1EC7." });
        return;
      }
      item.currentPrice = Math.round(parsed);
    }
    if (defaultWarrantyMonths !== void 0) {
      item.defaultWarrantyMonths = Number(defaultWarrantyMonths) || 0;
    }
    if (defaultMaintenanceMonths !== void 0) {
      item.defaultMaintenanceMonths = Number(defaultMaintenanceMonths) || 0;
    }
    item.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    saveStore(store);
    res.json({ item });
  }
);
app.delete(
  "/api/catalog/:id",
  requireStaffAuth,
  requireAdminRole,
  (req, res) => {
    const { id } = req.params;
    const prevLen = store.catalog.length;
    store.catalog = store.catalog.filter((c) => c.id !== id);
    if (store.catalog.length === prevLen) {
      res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y m\u1EE5c b\u1EA3ng gi\xE1." });
      return;
    }
    saveStore(store);
    res.json({ ok: true });
  }
);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API endpoint kh\xF4ng t\u1ED3n t\u1EA1i." });
});
async function startServer() {
  const rawPort = process.env.PORT;
  const hasPassenger = typeof globalThis.PhusionPassenger !== "undefined" || Boolean(process.env.PASSENGER_APP_ENV) || Boolean(process.env.IN_PASSENGER);
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(APP_ROOT, "dist");
    const indexHtmlPath = path.join(distDir, "index.html");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      if (!fs.existsSync(indexHtmlPath)) {
        res.status(503).type("html").send(
          '<!doctype html><html lang="vi"><meta charset="utf-8"><body style="font-family:sans-serif;padding:2rem"><h2>Ch\u01B0a build giao di\u1EC7n (thi\u1EBFu th\u01B0 m\u1EE5c dist/)</h2><p>Vui l\xF2ng v\xE0o Plesk Node.js &rarr; <strong>Run script</strong> &rarr; ch\u1EA1y <code>build</code>, sau \u0111\xF3 b\u1EA5m <strong>Restart App</strong>.</p></body></html>'
        );
        return;
      }
      res.sendFile(indexHtmlPath);
    });
  }
  if (hasPassenger) {
    const target = rawPort ? /^\d+$/.test(rawPort) ? Number(rawPort) : rawPort : "passenger";
    app.listen(target, () => {
      console.log(`Server running under Passenger (${target})`);
    });
  } else {
    const listenTarget = rawPort ? /^\d+$/.test(rawPort) ? Number(rawPort) : rawPort : 3e3;
    if (typeof listenTarget === "number") {
      app.listen(listenTarget, "0.0.0.0", () => {
        console.log(`Server running on http://0.0.0.0:${listenTarget}`);
      });
    } else {
      app.listen(listenTarget, () => {
        console.log(`Server running on ${listenTarget}`);
      });
    }
  }
}
startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
