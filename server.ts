import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  CatalogItem,
  Customer,
  OrderLineItem,
  OrderStatus,
  PublicUser,
  ServiceOrder,
  StaffUser,
  StoreData,
  UserRole,
} from './src/types.ts';
import { createInitialStoreData, hashPassword } from './src/utils/seedData.ts';
import {
  checkAdminSafetyGuard,
  deriveActiveTechnicians,
  evaluateMaintenanceAlerts,
  evaluateWarrantyRecords,
  normalizePhone,
  validateStaffUserInput,
} from './src/utils/serviceLogic.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const SESSIONS_PATH = path.join(DATA_DIR, 'sessions.json');

function sanitizeUser(user: StaffUser): PublicUser {
  const { passwordHash: _omit, ...rest } = user;
  return rest;
}

function ensureStore(): StoreData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const initial = createInitialStoreData();
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as StoreData;
    if (!Array.isArray(parsed.users) || parsed.users.length === 0) {
      const seed = createInitialStoreData();
      parsed.users = seed.users;
    }
    parsed.technicians = deriveActiveTechnicians(parsed.users);
    return parsed;
  } catch {
    const initial = createInitialStoreData();
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
}

function saveStore(data: StoreData): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  data.technicians = deriveActiveTechnicians(data.users);
  const tmpPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, STORE_PATH);
}

function loadSessions(): Record<string, string> {
  try {
    if (!fs.existsSync(SESSIONS_PATH)) return {};
    return JSON.parse(fs.readFileSync(SESSIONS_PATH, 'utf-8')) as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}

function saveSessions(sessions: Record<string, string>): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${SESSIONS_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(sessions, null, 2), 'utf-8');
  fs.renameSync(tmpPath, SESSIONS_PATH);
}

let store: StoreData = ensureStore();
const sessions: Record<string, string> = loadSessions();

interface AuthedRequest extends Request {
  authUser?: StaffUser;
  authToken?: string;
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

function requireStaffAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục.' });
    return;
  }
  const userId = sessions[token];
  const user = userId ? store.users.find((u) => u.id === userId) : undefined;
  if (!user || !user.active) {
    res
      .status(401)
      .json({ error: 'Phiên đăng nhập hết hạn hoặc tài khoản đã bị khóa.' });
    return;
  }
  req.authUser = user;
  req.authToken = token;
  next();
}

function requireAdminRole(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.authUser || req.authUser.role !== 'admin') {
    res
      .status(403)
      .json({ error: 'Chỉ quản trị viên (Admin) mới có quyền thao tác mục này.' });
    return;
  }
  next();
}

const app = express();
app.use(express.json({ limit: '2mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Public Customer Portal info (used on homepage /)
app.get('/api/public/portal-info', (_req, res) => {
  res.json({
    shopHotline: store.shopHotline,
    samplePhones: store.customers.slice(0, 3).map((c) => ({
      name: c.name,
      phone: c.phone,
    })),
  });
});

// Public Customer Self-Service Lookup by exact/normalized phone (used on homepage /)
app.get('/api/customer-lookup', (req, res) => {
  const rawPhone = String(req.query.phone ?? '').trim();
  const digits = normalizePhone(rawPhone);
  if (digits.length < 8) {
    res.status(400).json({ error: 'Vui lòng nhập số điện thoại đầy đủ.' });
    return;
  }

  const customer = store.customers.find(
    (c) => normalizePhone(c.phone) === digits
  );
  if (!customer) {
    res.status(404).json({
      error: 'Không tìm thấy hồ sơ khách hàng với số điện thoại này.',
    });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const customerOrders = store.orders
    .filter((o) => o.customerId === customer.id)
    .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));

  const warranties = evaluateWarrantyRecords(customerOrders, today);
  const maintenance = evaluateMaintenanceAlerts(customerOrders, today, 365);

  res.json({
    shopHotline: store.shopHotline,
    customer,
    orders: customerOrders,
    warranties,
    maintenance,
  });
});

// CRM Auth endpoints (/crm/)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };
  const cleanUser = (username ?? '').trim().toLowerCase();
  const cleanPass = password ?? '';

  if (!cleanUser || !cleanPass) {
    res
      .status(400)
      .json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
    return;
  }

  const matched = store.users.find(
    (u) =>
      u.username.toLowerCase() === cleanUser ||
      normalizePhone(u.phone) === normalizePhone(cleanUser)
  );

  if (!matched || matched.passwordHash !== hashPassword(cleanPass)) {
    res
      .status(401)
      .json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
    return;
  }

  if (!matched.active) {
    res
      .status(403)
      .json({ error: 'Tài khoản này đang bị tạm khóa. Vui lòng liên hệ Admin.' });
    return;
  }

  const token = randomUUID();
  sessions[token] = matched.id;
  saveSessions(sessions);

  res.json({
    token,
    user: sanitizeUser(matched),
  });
});

app.get('/api/auth/me', requireStaffAuth, (req: AuthedRequest, res) => {
  res.json({ user: sanitizeUser(req.authUser!) });
});

app.post('/api/auth/logout', (req, res) => {
  const token = extractToken(req);
  if (token && sessions[token]) {
    delete sessions[token];
    saveSessions(sessions);
  }
  res.json({ ok: true });
});

// Get sanitized CRM store snapshot (requires staff auth)
app.get('/api/store', requireStaffAuth, (req: AuthedRequest, res) => {
  const isAdmin = req.authUser?.role === 'admin';
  res.json({
    shopHotline: store.shopHotline,
    users: isAdmin ? store.users.map(sanitizeUser) : [],
    customers: store.customers,
    technicians: deriveActiveTechnicians(store.users),
    catalog: store.catalog,
    orders: store.orders,
  });
});

// Staff User Management CRUD (Admin only)
app.get(
  '/api/users',
  requireStaffAuth,
  requireAdminRole,
  (_req, res) => {
    res.json({ users: store.users.map(sanitizeUser) });
  }
);

app.post(
  '/api/users',
  requireStaffAuth,
  requireAdminRole,
  (req, res) => {
    const { username, password, fullName, phone, role, specialty, active } =
      req.body as {
        username?: string;
        password?: string;
        fullName?: string;
        phone?: string;
        role?: UserRole;
        specialty?: string;
        active?: boolean;
      };

    const nextRole: UserRole = role === 'admin' ? 'admin' : 'technician';
    const validationErr = validateStaffUserInput(
      {
        username: username ?? '',
        fullName: fullName ?? '',
        phone: phone ?? '',
        role: nextRole,
        password: password ?? '',
      },
      store.users
    );
    if (validationErr) {
      res.status(400).json({ error: validationErr });
      return;
    }

    const newUser: StaffUser = {
      id: nextRole === 'technician' ? `tech_${Date.now()}` : `usr_${Date.now()}`,
      username: (username ?? '').trim().toLowerCase(),
      passwordHash: hashPassword((password ?? '').trim()),
      fullName: (fullName ?? '').trim(),
      phone: (phone ?? '').trim(),
      role: nextRole,
      specialty:
        (specialty ?? '').trim() ||
        (nextRole === 'admin' ? 'Quản trị hệ thống' : 'Kỹ thuật viên'),
      active: active !== false,
      createdAt: new Date().toISOString(),
    };

    store.users.unshift(newUser);
    saveStore(store);
    res.status(201).json({ user: sanitizeUser(newUser) });
  }
);

app.patch(
  '/api/users/:id',
  requireStaffAuth,
  requireAdminRole,
  (req: AuthedRequest, res) => {
    const { id } = req.params;
    const existing = store.users.find((u) => u.id === id);
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy người dùng.' });
      return;
    }

    const { username, password, fullName, phone, role, specialty, active } =
      req.body as {
        username?: string;
        password?: string;
        fullName?: string;
        phone?: string;
        role?: UserRole;
        specialty?: string;
        active?: boolean;
      };

    const nextRole: UserRole =
      role === 'admin' || role === 'technician' ? role : existing.role;
    const nextActive = typeof active === 'boolean' ? active : existing.active;

    const guardErr = checkAdminSafetyGuard(
      store.users,
      id,
      'update',
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
        password,
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
    if (typeof specialty === 'string') {
      existing.specialty =
        specialty.trim() ||
        (nextRole === 'admin' ? 'Quản trị hệ thống' : 'Kỹ thuật viên');
    }
    if (password && password.trim().length > 0) {
      existing.passwordHash = hashPassword(password.trim());
    }

    // Keep technicianName in sync on open/pending orders if name updated
    for (const ord of store.orders) {
      if (ord.technicianId === existing.id && ord.status !== 'completed') {
        ord.technicianName = existing.fullName;
      }
    }

    saveStore(store);
    res.json({ user: sanitizeUser(existing) });
  }
);

app.delete(
  '/api/users/:id',
  requireStaffAuth,
  requireAdminRole,
  (req: AuthedRequest, res) => {
    const { id } = req.params;
    const guardErr = checkAdminSafetyGuard(
      store.users,
      id,
      'delete',
      undefined,
      req.authUser?.id
    );
    if (guardErr) {
      res.status(400).json({ error: guardErr });
      return;
    }

    store.users = store.users.filter((u) => u.id !== id);
    // Invalidate sessions for deleted user
    for (const [tok, uid] of Object.entries(sessions)) {
      if (uid === id) delete sessions[tok];
    }
    saveSessions(sessions);
    saveStore(store);
    res.json({ ok: true });
  }
);

// Create a new service order (Admin)
app.post(
  '/api/orders',
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
      items,
    } = req.body as {
      customerId?: string;
      customerName?: string;
      customerPhone?: string;
      customerAddress?: string;
      technicianId?: string;
      issueDescription?: string;
      scheduledDate?: string;
      scheduledTime?: string;
      items?: OrderLineItem[];
    };

    const cleanPhone = (customerPhone ?? '').trim();
    const cleanName = (customerName ?? '').trim();
    const cleanAddress = (customerAddress ?? '').trim();
    const cleanIssue = (issueDescription ?? '').trim();

    if (!cleanPhone || normalizePhone(cleanPhone).length < 8) {
      res.status(400).json({ error: 'Vui lòng nhập số điện thoại hợp lệ.' });
      return;
    }
    if (!cleanName || !cleanAddress) {
      res
        .status(400)
        .json({ error: 'Vui lòng điền đầy đủ họ tên và địa chỉ khách hàng.' });
      return;
    }
    if (!cleanIssue) {
      res
        .status(400)
        .json({ error: 'Vui lòng mô tả tình trạng hư hỏng của khách hàng.' });
      return;
    }

    const activeTechs = deriveActiveTechnicians(store.users);
    const tech =
      activeTechs.find((t) => t.id === technicianId) ?? activeTechs[0];

    if (!tech) {
      res.status(400).json({ error: 'Chưa có kỹ thuật viên đang hoạt động.' });
      return;
    }

    const nowIso = new Date().toISOString();
    let customer: Customer | undefined = customerId
      ? store.customers.find((c) => c.id === customerId)
      : store.customers.find(
          (c) => normalizePhone(c.phone) === normalizePhone(cleanPhone)
        );

    if (!customer) {
      customer = {
        id: `cust_${Date.now()}`,
        name: cleanName,
        phone: cleanPhone,
        address: cleanAddress,
        createdAt: nowIso,
      };
      store.customers.unshift(customer);
    } else {
      customer.name = cleanName;
      customer.address = cleanAddress;
    }

    const nextNum = 1001 + store.orders.length;
    const order: ServiceOrder = {
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
      scheduledTime: scheduledTime || '09:00',
      status: 'pending',
      items: Array.isArray(items) ? items : [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    store.orders.unshift(order);
    saveStore(store);
    res.status(201).json({ order, customer });
  }
);

// Update order details, locked line items, or status (Admin or assigned Technician)
app.patch('/api/orders/:id', requireStaffAuth, (req: AuthedRequest, res) => {
  const { id } = req.params;
  const order = store.orders.find((o) => o.id === id);
  if (!order) {
    res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
    return;
  }

  if (
    req.authUser?.role === 'technician' &&
    order.technicianId !== req.authUser.id
  ) {
    res
      .status(403)
      .json({ error: 'Bạn chỉ có quyền cập nhật đơn được giao cho mình.' });
    return;
  }

  const {
    status,
    statusNote,
    technicianId,
    scheduledDate,
    scheduledTime,
    issueDescription,
    items,
  } = req.body as {
    status?: OrderStatus;
    statusNote?: string;
    technicianId?: string;
    scheduledDate?: string;
    scheduledTime?: string;
    issueDescription?: string;
    items?: OrderLineItem[];
  };

  const nowIso = new Date().toISOString();

  if (typeof issueDescription === 'string' && issueDescription.trim()) {
    order.issueDescription = issueDescription.trim();
  }
  if (typeof scheduledDate === 'string' && scheduledDate) {
    order.scheduledDate = scheduledDate;
  }
  if (typeof scheduledTime === 'string' && scheduledTime) {
    order.scheduledTime = scheduledTime;
  }
  if (typeof technicianId === 'string' && req.authUser?.role === 'admin') {
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
      priceLockedAt: item.priceLockedAt || nowIso,
    }));
  }
  if (typeof statusNote === 'string') {
    order.statusNote = statusNote.trim();
  }
  if (status) {
    order.status = status;
    if (status === 'completed' && !order.completedAt) {
      order.completedAt = nowIso;
    } else if (status !== 'completed') {
      order.completedAt = undefined;
    }
  }
  order.updatedAt = nowIso;

  saveStore(store);
  res.json({ order });
});

// Mark maintenance alert followed up (Admin)
app.patch(
  '/api/orders/:orderId/items/:lineItemId/followup',
  requireStaffAuth,
  requireAdminRole,
  (req, res) => {
    const { orderId, lineItemId } = req.params;
    const { followedUp } = req.body as { followedUp?: boolean };
    const order = store.orders.find((o) => o.id === orderId);
    if (!order) {
      res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
      return;
    }
    const item = order.items.find((i) => i.id === lineItemId);
    if (!item) {
      res.status(404).json({ error: 'Không tìm thấy hạng mục.' });
      return;
    }
    item.maintenanceFollowedUp = Boolean(followedUp);
    order.updatedAt = new Date().toISOString();
    saveStore(store);
    res.json({ order });
  }
);

// Catalog CRUD (Admin only; updating price NEVER mutates lockedUnitPrice on existing orders)
app.post('/api/catalog', requireStaffAuth, requireAdminRole, (req, res) => {
  const {
    name,
    category,
    unit,
    currentPrice,
    defaultWarrantyMonths,
    defaultMaintenanceMonths,
  } = req.body as Partial<CatalogItem>;

  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Tên dịch vụ / vật tư không được trống.' });
    return;
  }
  const price = Number(currentPrice);
  if (!Number.isFinite(price) || price < 0) {
    res.status(400).json({ error: 'Đơn giá phải lớn hơn hoặc bằng 0.' });
    return;
  }

  const newItem: CatalogItem = {
    id: `cat_${Date.now()}`,
    name: name.trim(),
    category: category === 'service' ? 'service' : 'material',
    unit: (unit ?? 'cái').trim() || 'cái',
    currentPrice: Math.round(price),
    defaultWarrantyMonths: Number(defaultWarrantyMonths) || 0,
    defaultMaintenanceMonths: Number(defaultMaintenanceMonths) || 0,
    updatedAt: new Date().toISOString(),
  };

  store.catalog.unshift(newItem);
  saveStore(store);
  res.status(201).json({ item: newItem });
});

app.patch(
  '/api/catalog/:id',
  requireStaffAuth,
  requireAdminRole,
  (req, res) => {
    const { id } = req.params;
    const item = store.catalog.find((c) => c.id === id);
    if (!item) {
      res.status(404).json({ error: 'Không tìm thấy mục bảng giá.' });
      return;
    }

    const {
      name,
      category,
      unit,
      currentPrice,
      defaultWarrantyMonths,
      defaultMaintenanceMonths,
    } = req.body as Partial<CatalogItem>;

    if (typeof name === 'string' && name.trim()) item.name = name.trim();
    if (category === 'service' || category === 'material')
      item.category = category;
    if (typeof unit === 'string' && unit.trim()) item.unit = unit.trim();
    if (currentPrice !== undefined) {
      const parsed = Number(currentPrice);
      if (!Number.isFinite(parsed) || parsed < 0) {
        res.status(400).json({ error: 'Đơn giá không hợp lệ.' });
        return;
      }
      item.currentPrice = Math.round(parsed);
    }
    if (defaultWarrantyMonths !== undefined) {
      item.defaultWarrantyMonths = Number(defaultWarrantyMonths) || 0;
    }
    if (defaultMaintenanceMonths !== undefined) {
      item.defaultMaintenanceMonths = Number(defaultMaintenanceMonths) || 0;
    }
    item.updatedAt = new Date().toISOString();

    saveStore(store);
    res.json({ item });
  }
);

app.delete(
  '/api/catalog/:id',
  requireStaffAuth,
  requireAdminRole,
  (req, res) => {
    const { id } = req.params;
    const prevLen = store.catalog.length;
    store.catalog = store.catalog.filter((c) => c.id !== id);
    if (store.catalog.length === prevLen) {
      res.status(404).json({ error: 'Không tìm thấy mục bảng giá.' });
      return;
    }
    saveStore(store);
    res.json({ ok: true });
  }
);

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
