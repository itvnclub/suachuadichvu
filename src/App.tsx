import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BellRing,
  ClipboardPlus,
  Kanban,
  LogOut,
  Menu,
  Phone,
  Plus,
  Tag,
  Users,
  X,
} from 'lucide-react';
import type {
  AdminTab,
  CatalogCategory,
  CatalogItem,
  OrderLineItem,
  OrderStatus,
  PublicUser,
  UserRole,
} from './types';
import {
  createCatalogItem,
  createOrder,
  createStaffUser,
  deleteCatalogItem,
  deleteStaffUser,
  fetchCurrentUser,
  fetchPublicPortalInfo,
  fetchStore,
  getStoredAuthToken,
  logoutStaff,
  setStoredAuthToken,
  toggleMaintenanceFollowUp,
  updateCatalogItem,
  updateOrder,
  updateStaffUser,
  type CrmStoreSnapshot,
  type PublicPortalInfo,
} from './utils/api';
import { evaluateMaintenanceAlerts } from './utils/serviceLogic';
import { AdminIntakeView } from './components/AdminIntakeView';
import { AdminBoardView } from './components/AdminBoardView';
import { AdminCatalogView } from './components/AdminCatalogView';
import { AdminCareView } from './components/AdminCareView';
import { AdminAnalyticsView } from './components/AdminAnalyticsView';
import { AdminUsersView } from './components/AdminUsersView';
import { OrderDetailModal } from './components/OrderDetailModal';
import { TechnicianPortalView } from './components/TechnicianPortalView';
import { CustomerPortalView } from './components/CustomerPortalView';
import { CrmLoginView } from './components/CrmLoginView';

const ADMIN_NAV_ITEMS: Array<{
  id: AdminTab;
  label: string;
  title: string;
  icon: typeof ClipboardPlus;
}> = [
  {
    id: 'intake',
    label: 'Tiếp nhận & Đặt lịch',
    title: 'Tiếp nhận khách hàng & Tạo lịch hẹn',
    icon: ClipboardPlus,
  },
  {
    id: 'board',
    label: 'Theo dõi tiến độ',
    title: 'Bảng theo dõi tiến độ xử lý đơn hàng',
    icon: Kanban,
  },
  {
    id: 'catalog',
    label: 'Quản lý Bảng giá',
    title: 'Quản lý Bảng giá vật tư & dịch vụ',
    icon: Tag,
  },
  {
    id: 'care',
    label: 'Chăm sóc khách hàng',
    title: 'Nhắc lịch bảo dưỡng & Tra cứu bảo hành',
    icon: BellRing,
  },
  {
    id: 'analytics',
    label: 'Thống kê Doanh thu',
    title: 'Báo cáo doanh thu & Vật tư tiêu thụ',
    icon: BarChart3,
  },
  {
    id: 'users',
    label: 'Quản lý Người dùng',
    title: 'Quản lý tài khoản nhân sự (Admin & Thợ)',
    icon: Users,
  },
];

function isCrmPath(pathname: string): boolean {
  return pathname === '/crm' || pathname.startsWith('/crm/');
}

export default function App() {
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const inCrm = isCrmPath(pathname);

  // Public customer portal state (for /)
  const [publicInfo, setPublicInfo] = useState<PublicPortalInfo | null>(null);
  const [publicLoading, setPublicLoading] = useState(!inCrm);

  // CRM auth & store state (for /crm/)
  const [authChecking, setAuthChecking] = useState(inCrm);
  const [authUser, setAuthUser] = useState<PublicUser | null>(null);
  const [store, setStore] = useState<CrmStoreSnapshot | null>(null);
  const [storeLoading, setStoreLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [adminTab, setAdminTab] = useState<AdminTab>('intake');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [intakePrefill, setIntakePrefill] = useState<{
    customerId: string;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    issueDescription: string;
    nonce: number;
  } | null>(null);

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateTo = useCallback((nextPath: string) => {
    window.history.pushState({}, '', nextPath);
    setPathname(nextPath);
  }, []);

  // Load public portal info when on /
  useEffect(() => {
    if (inCrm) return;
    let cancelled = false;
    setPublicLoading(true);
    fetchPublicPortalInfo()
      .then((info) => {
        if (!cancelled) setPublicInfo(info);
      })
      .catch(() => {
        if (!cancelled) {
          setPublicInfo({ shopHotline: '1900 6868', samplePhones: [] });
        }
      })
      .finally(() => {
        if (!cancelled) setPublicLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inCrm]);

  const loadCrmStore = useCallback(async () => {
    setStoreLoading(true);
    setLoadError(null);
    try {
      const data = await fetchStore();
      setStore(data);
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : 'Không thể tải dữ liệu từ máy chủ.'
      );
    } finally {
      setStoreLoading(false);
    }
  }, []);

  // Check existing CRM session when entering /crm/
  useEffect(() => {
    if (!inCrm) return;
    const token = getStoredAuthToken();
    if (!token) {
      setAuthUser(null);
      setAuthChecking(false);
      return;
    }
    let cancelled = false;
    setAuthChecking(true);
    fetchCurrentUser()
      .then((res) => {
        if (!cancelled) {
          setAuthUser(res.user);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStoredAuthToken(null);
          setAuthUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setAuthChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inCrm]);

  // Load CRM store whenever authUser is present
  useEffect(() => {
    if (inCrm && authUser) {
      loadCrmStore();
    }
  }, [inCrm, authUser, loadCrmStore]);

  const handleLogout = async () => {
    try {
      await logoutStaff();
    } catch {
      // ignore logout error
    }
    setStoredAuthToken(null);
    setAuthUser(null);
    setStore(null);
  };

  const today = new Date().toISOString().slice(0, 10);

  const pendingCount = useMemo(
    () => store?.orders.filter((o) => o.status === 'pending').length ?? 0,
    [store]
  );

  const maintenanceDueCount = useMemo(() => {
    if (!store) return 0;
    return evaluateMaintenanceAlerts(store.orders, today, 0).filter(
      (a) => !a.followedUp
    ).length;
  }, [store, today]);

  const editingOrder = useMemo(() => {
    if (!store || !editingOrderId) return null;
    return store.orders.find((o) => o.id === editingOrderId) ?? null;
  }, [store, editingOrderId]);

  const handleCreateOrder = async (payload: {
    customerId?: string;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    technicianId: string;
    issueDescription: string;
    scheduledDate: string;
    scheduledTime: string;
  }) => {
    await createOrder(payload);
    await loadCrmStore();
  };

  const handleUpdateOrder = async (
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
  ) => {
    await updateOrder(orderId, payload);
    await loadCrmStore();
  };

  const handleToggleFollowUp = async (
    orderId: string,
    lineItemId: string,
    followedUp: boolean
  ) => {
    await toggleMaintenanceFollowUp(orderId, lineItemId, followedUp);
    await loadCrmStore();
  };

  const handleCreateCatalogItem = async (payload: {
    name: string;
    category: CatalogCategory;
    unit: string;
    currentPrice: number;
    defaultWarrantyMonths: number;
    defaultMaintenanceMonths: number;
  }) => {
    await createCatalogItem(payload);
    await loadCrmStore();
  };

  const handleUpdateCatalogItem = async (
    id: string,
    payload: Partial<CatalogItem>
  ) => {
    await updateCatalogItem(id, payload);
    await loadCrmStore();
  };

  const handleDeleteCatalogItem = async (id: string) => {
    await deleteCatalogItem(id);
    await loadCrmStore();
  };

  const handleCreateStaffUser = async (payload: {
    username: string;
    password: string;
    fullName: string;
    phone: string;
    role: UserRole;
    specialty: string;
    active: boolean;
  }) => {
    await createStaffUser(payload);
    await loadCrmStore();
  };

  const handleUpdateStaffUser = async (
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
  ) => {
    const res = await updateStaffUser(userId, payload);
    if (authUser && res.user.id === authUser.id) {
      setAuthUser(res.user);
    }
    await loadCrmStore();
  };

  const handleDeleteStaffUser = async (userId: string) => {
    await deleteStaffUser(userId);
    await loadCrmStore();
  };

  // 1. PUBLIC HOMEPAGE (/) — ONLY Customer Self-Service Portal
  if (!inCrm) {
    const hotline = publicInfo?.shopHotline ?? '1900 6868';
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
            <span className="font-display text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              An Tâm Kỹ Thuật
            </span>

            <a
              href={`tel:${hotline.replace(/\s+/g, '')}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Phone className="h-3.5 w-3.5 text-sky-600" />
              Hotline: {hotline}
            </a>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6">
          {publicLoading ? (
            <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
              Đang tải cổng tra cứu khách hàng...
            </div>
          ) : (
            <CustomerPortalView samplePhones={publicInfo?.samplePhones ?? []} />
          )}
        </main>
      </div>
    );
  }

  // 2. CRM ROUTE (/crm/) — Auth Gate
  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-medium text-slate-600">
        Đang kiểm tra phiên đăng nhập CRM...
      </div>
    );
  }

  if (!authUser) {
    return (
      <CrmLoginView
        onLoginSuccess={(user) => {
          setAuthUser(user);
        }}
        onGoCustomerPortal={() => navigateTo('/')}
      />
    );
  }

  if (storeLoading || (!store && !loadError)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-medium text-slate-600">
        Đang tải dữ liệu hệ thống CRM...
      </div>
    );
  }

  if (loadError || !store) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
        <p className="text-sm font-medium text-red-700">
          {loadError || 'Không có dữ liệu.'}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadCrmStore}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Thử lại
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    );
  }

  // 3. CRM TECHNICIAN VIEW (logged in as role === 'technician')
  if (authUser.role === 'technician') {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="font-display text-base font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
                An Tâm Kỹ Thuật
              </span>
              <span className="hidden text-xs text-slate-400 sm:inline">·</span>
              <span className="hidden truncate text-xs font-medium text-slate-600 sm:inline">
                Thợ thi công: {authUser.fullName}
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              Đăng xuất
            </button>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6">
          <TechnicianPortalView
            technicians={store.technicians}
            orders={store.orders}
            catalog={store.catalog}
            lockedTechnician={authUser}
            onUpdateOrder={handleUpdateOrder}
          />
        </main>
      </div>
    );
  }

  // 4. CRM ADMIN WORKSPACE (logged in as role === 'admin')
  const activeNavMeta =
    ADMIN_NAV_ITEMS.find((item) => item.id === adminTab) ?? ADMIN_NAV_ITEMS[0];

  const renderAccountFooter = () => (
    <div className="border-t border-slate-200 p-4">
      <div className="mb-3 min-w-0">
        <div className="truncate text-sm font-bold text-slate-900">
          {authUser.fullName}
        </div>
        <div className="text-xs text-slate-500">
          Admin · <span className="font-mono">{authUser.username}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
      >
        <LogOut className="h-3.5 w-3.5" />
        Đăng xuất CRM
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-slate-200 px-6">
          <span className="font-display text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap">
            An Tâm Kỹ Thuật
          </span>
        </div>

        <nav aria-label="Menu quản trị" className="flex-1 space-y-1 p-4">
          {ADMIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = adminTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setAdminTab(item.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-sky-50 text-sky-800'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active ? 'text-sky-700' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>

                {item.id === 'board' && pendingCount > 0 && (
                  <span className="font-mono text-xs font-bold text-slate-500 tabular-nums">
                    {pendingCount}
                  </span>
                )}
                {item.id === 'care' && maintenanceDueCount > 0 && (
                  <span className="font-mono text-xs font-bold text-amber-700 tabular-nums">
                    {maintenanceDueCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {renderAccountFooter()}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
              <span className="font-display text-base font-extrabold text-slate-900">
                An Tâm Kỹ Thuật
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Đóng menu"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-4">
              {ADMIN_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = adminTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setAdminTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold ${
                      active
                        ? 'bg-sky-50 text-sky-800'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>
            {renderAccountFooter()}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Mở menu điều hướng"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">
                {activeNavMeta.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIntakePrefill(null);
                setAdminTab('intake');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              Tiếp nhận đơn mới
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          {adminTab === 'intake' && (
            <AdminIntakeView
              key={intakePrefill?.nonce ?? 0}
              customers={store.customers}
              technicians={store.technicians}
              orders={store.orders}
              prefill={intakePrefill}
              onCreateOrder={handleCreateOrder}
              onOpenOrder={(ord) => setEditingOrderId(ord.id)}
              onOrderCreatedNavigateToBoard={() => setAdminTab('board')}
            />
          )}

          {adminTab === 'board' && (
            <AdminBoardView
              orders={store.orders}
              onOpenOrder={(ord) => setEditingOrderId(ord.id)}
            />
          )}

          {adminTab === 'catalog' && (
            <AdminCatalogView
              catalog={store.catalog}
              onCreateItem={handleCreateCatalogItem}
              onUpdateItem={handleUpdateCatalogItem}
              onDeleteItem={handleDeleteCatalogItem}
            />
          )}

          {adminTab === 'care' && (
            <AdminCareView
              orders={store.orders}
              onToggleFollowUp={handleToggleFollowUp}
              onScheduleMaintenanceOrder={(prefill) => {
                setIntakePrefill({ ...prefill, nonce: Date.now() });
                setAdminTab('intake');
              }}
            />
          )}

          {adminTab === 'analytics' && (
            <AdminAnalyticsView orders={store.orders} />
          )}

          {adminTab === 'users' && (
            <AdminUsersView
              users={store.users}
              currentUserId={authUser.id}
              onCreateUser={handleCreateStaffUser}
              onUpdateUser={handleUpdateStaffUser}
              onDeleteUser={handleDeleteStaffUser}
            />
          )}
        </main>
      </div>

      {/* Order Detail & Price-Lock Modal */}
      {editingOrder && (
        <OrderDetailModal
          order={editingOrder}
          catalog={store.catalog}
          technicians={store.technicians}
          onClose={() => setEditingOrderId(null)}
          onSave={handleUpdateOrder}
        />
      )}
    </div>
  );
}
