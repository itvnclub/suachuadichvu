import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  MapPin,
  Minus,
  Phone,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  CatalogItem,
  OrderLineItem,
  OrderStatus,
  PublicUser,
  ServiceOrder,
  Technician,
} from '../types';
import {
  calculateOrderTotals,
  createLockedLineItem,
  formatDateVN,
  formatVND,
} from '../utils/serviceLogic';

interface TechnicianPortalViewProps {
  technicians: Technician[];
  orders: ServiceOrder[];
  catalog: CatalogItem[];
  lockedTechnician?: PublicUser | null;
  onUpdateOrder: (
    orderId: string,
    payload: {
      status?: OrderStatus;
      statusNote?: string;
      items?: OrderLineItem[];
    }
  ) => Promise<void>;
}

export const TechnicianPortalView: React.FC<TechnicianPortalViewProps> = ({
  technicians,
  orders,
  catalog,
  lockedTechnician,
  onUpdateOrder,
}) => {
  const [selectedTechId, setSelectedTechId] = useState(
    lockedTechnician?.id ?? technicians[0]?.id ?? ''
  );
  const [listFilter, setListFilter] = useState<'active' | 'completed'>('active');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // Local working state for active order
  const [catalogSearch, setCatalogSearch] = useState('');
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [waitingNote, setWaitingNote] = useState('');
  const [showWaitingPrompt, setShowWaitingPrompt] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const selectedTech = useMemo(() => {
    if (lockedTechnician) {
      return {
        id: lockedTechnician.id,
        name: lockedTechnician.fullName,
        phone: lockedTechnician.phone,
        specialty: lockedTechnician.specialty,
      };
    }
    return technicians.find((t) => t.id === selectedTechId) ?? technicians[0];
  }, [lockedTechnician, technicians, selectedTechId]);

  const techOrders = useMemo(() => {
    return orders
      .filter((o) => o.technicianId === (selectedTech?.id ?? ''))
      .filter((o) => {
        if (listFilter === 'active') {
          return o.status === 'pending' || o.status === 'waiting_material';
        }
        return o.status === 'completed';
      })
      .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  }, [orders, selectedTech, listFilter]);

  const activeOrder = useMemo(() => {
    if (activeOrderId) {
      return orders.find((o) => o.id === activeOrderId) ?? null;
    }
    return null;
  }, [orders, activeOrderId]);

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((c) => c.name.toLowerCase().includes(q));
  }, [catalog, catalogSearch]);

  const handleOpenJob = (order: ServiceOrder) => {
    setActiveOrderId(order.id);
    setWaitingNote(order.statusNote ?? '');
    setShowWaitingPrompt(false);
    setShowAddPicker(false);
    setFeedback(null);
  };

  const handleAddItemToActiveOrder = async (cat: CatalogItem) => {
    if (!activeOrder) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const existing = activeOrder.items.find(
        (item) => item.catalogItemId === cat.id
      );
      let nextItems: OrderLineItem[];
      if (existing) {
        nextItems = activeOrder.items.map((item) =>
          item.id === existing.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        nextItems = [...activeOrder.items, createLockedLineItem(cat, 1)];
      }
      await onUpdateOrder(activeOrder.id, { items: nextItems });
      setCatalogSearch('');
      setShowAddPicker(false);
      setFeedback(`Đã thêm "${cat.name}" vào đơn.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeQuantity = async (lineId: string, delta: number) => {
    if (!activeOrder) return;
    const nextItems = activeOrder.items
      .map((item) =>
        item.id === lineId
          ? { ...item, quantity: Math.max(0, item.quantity + delta) }
          : item
      )
      .filter((item) => item.quantity > 0);
    await onUpdateOrder(activeOrder.id, { items: nextItems });
  };

  const handleRemoveItem = async (lineId: string) => {
    if (!activeOrder) return;
    const nextItems = activeOrder.items.filter((item) => item.id !== lineId);
    await onUpdateOrder(activeOrder.id, { items: nextItems });
  };

  const handleMarkWaitingMaterial = async () => {
    if (!activeOrder) return;
    setSubmitting(true);
    try {
      await onUpdateOrder(activeOrder.id, {
        status: 'waiting_material',
        statusNote: waitingNote.trim() || 'Cần mua thêm vật tư bổ sung',
      });
      setShowWaitingPrompt(false);
      setFeedback('Đã cập nhật trạng thái Chờ vật tư về cửa hàng.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteJob = async () => {
    if (!activeOrder) return;
    setSubmitting(true);
    try {
      await onUpdateOrder(activeOrder.id, {
        status: 'completed',
        statusNote: '',
      });
      setFeedback(
        'Đã hoàn thành công việc & đồng bộ hóa đơn về hệ thống cửa hàng.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const activeTotals = useMemo(
    () =>
      activeOrder
        ? calculateOrderTotals(activeOrder.items)
        : { serviceTotal: 0, materialTotal: 0, grandTotal: 0 },
    [activeOrder]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Technician Selector & Summary Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <div className="text-xs font-medium text-slate-500">
            Giao diện Thợ thi công
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            Lịch công việc hôm nay
          </h2>
        </div>

        {lockedTechnician ? (
          <div className="text-right">
            <div className="text-sm font-bold text-slate-900">
              {lockedTechnician.fullName}
            </div>
            <div className="text-xs text-slate-500">
              {lockedTechnician.specialty} ·{' '}
              <span className="font-mono">{lockedTechnician.phone}</span>
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <label
              htmlFor="tech-profile-select"
              className="text-xs font-semibold text-slate-600 shrink-0"
            >
              Tài khoản thợ:
            </label>
            <select
              id="tech-profile-select"
              value={selectedTech?.id ?? ''}
              onChange={(e) => {
                setSelectedTechId(e.target.value);
                setActiveOrderId(null);
              }}
              className="min-h-[44px] w-full max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-sky-600 focus:outline-none sm:w-auto"
            >
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.specialty}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Responsive Split: Mobile shows List OR Detail; Desktop shows List + Detail side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Job List */}
        <div
          className={`lg:col-span-5 ${
            activeOrder ? 'hidden lg:block' : 'block'
          }`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1">
              <button
                type="button"
                onClick={() => setListFilter('active')}
                className={`min-h-[44px] rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  listFilter === 'active'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cần làm (
                {
                  orders.filter(
                    (o) =>
                      o.technicianId === selectedTech?.id &&
                      (o.status === 'pending' ||
                        o.status === 'waiting_material')
                  ).length
                }
                )
              </button>
              <button
                type="button"
                onClick={() => setListFilter('completed')}
                className={`min-h-[44px] rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  listFilter === 'completed'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đã xong (
                {
                  orders.filter(
                    (o) =>
                      o.technicianId === selectedTech?.id &&
                      o.status === 'completed'
                  ).length
                }
                )
              </button>
            </div>

            <div className="space-y-3">
              {techOrders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                  Không có công việc nào trong mục này.
                </div>
              ) : (
                techOrders.map((job) => {
                  const totals = calculateOrderTotals(job.items);
                  const isSelected = activeOrder?.id === job.id;
                  return (
                    <div
                      key={job.id}
                      className={`rounded-2xl border bg-white p-4 transition-colors ${
                        isSelected
                          ? 'border-sky-600 ring-1 ring-sky-600'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-sky-700 tabular-nums">
                          <Clock className="h-3.5 w-3.5" />
                          {job.scheduledTime} · {formatDateVN(job.scheduledDate)}
                        </span>
                        {job.status === 'waiting_material' && (
                          <span className="rounded bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">
                            Chờ vật tư
                          </span>
                        )}
                        {job.status === 'completed' && (
                          <span className="rounded bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">
                            Hoàn thành
                          </span>
                        )}
                      </div>

                      <h3 className="mt-2 text-base font-bold text-slate-900">
                        {job.customerName}
                      </h3>

                      <div className="mt-1 flex items-start gap-1.5 text-xs text-slate-600">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span>{job.customerAddress}</span>
                      </div>

                      <p className="mt-2.5 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800">
                        {job.issueDescription}
                      </p>

                      <div className="mt-3 flex items-center justify-between gap-2 pt-1">
                        <a
                          href={`tel:${job.customerPhone}`}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100 whitespace-nowrap"
                        >
                          <Phone className="h-4 w-4" />
                          Gọi {job.customerPhone}
                        </a>

                        <button
                          type="button"
                          onClick={() => handleOpenJob(job)}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800 whitespace-nowrap"
                        >
                          {job.status === 'completed'
                            ? 'Xem hóa đơn'
                            : 'Xử lý đơn'}
                          {totals.grandTotal > 0
                            ? ` · ${formatVND(totals.grandTotal)}`
                            : ''}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right: Active Job Processing View */}
        <div
          className={`lg:col-span-7 ${
            activeOrder ? 'block' : 'hidden lg:block'
          }`}
        >
          {!activeOrder ? (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <p className="text-base font-semibold text-slate-800">
                Chọn một đơn công việc bên trái để xử lý
              </p>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Khi tới nhà khách, thợ mở chi tiết đơn để thêm vật tư phát sinh
                và bấm Hoàn thành ngay trên điện thoại.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              {/* Mobile Back Button */}
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <button
                  type="button"
                  onClick={() => setActiveOrderId(null)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Danh sách
                </button>
                <div className="min-w-0">
                  <div className="font-mono text-xs font-semibold text-slate-500">
                    {activeOrder.code} · Hẹn {activeOrder.scheduledTime}{' '}
                    {formatDateVN(activeOrder.scheduledDate)}
                  </div>
                  <h3 className="truncate text-lg font-bold text-slate-900">
                    {activeOrder.customerName}
                  </h3>
                </div>
                <a
                  href={`tel:${activeOrder.customerPhone}`}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 whitespace-nowrap shrink-0"
                >
                  <Phone className="h-4 w-4" />
                  Gọi khách
                </a>
              </div>

              {feedback && (
                <div
                  role="status"
                  className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{feedback}</span>
                </div>
              )}

              {/* Address & Issue */}
              <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                <div className="flex items-start gap-2 text-slate-700">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <span>{activeOrder.customerAddress}</span>
                </div>
                <div className="text-slate-900">
                  <span className="font-semibold">Tình trạng:</span>{' '}
                  {activeOrder.issueDescription}
                </div>
                {activeOrder.statusNote && (
                  <div className="text-xs text-amber-800">
                    Ghi chú chờ: {activeOrder.statusNote}
                  </div>
                )}
              </div>

              {/* Add Unexpected Material/Service */}
              <div className="mt-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-slate-900">
                    Chi phí vật tư & tiền công tại nhà khách
                  </h4>
                  {activeOrder.status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() => setShowAddPicker((v) => !v)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-sky-700 whitespace-nowrap"
                    >
                      <Plus className="h-4 w-4" />
                      Thêm vật tư / dịch vụ phát sinh
                    </button>
                  )}
                </div>

                {showAddPicker && (
                  <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        autoFocus
                        value={catalogSearch}
                        onChange={(e) => setCatalogSearch(e.target.value)}
                        placeholder="Tìm tên vật tư / dịch vụ (VD: Tụ, Van, Sửa máy bơm)..."
                        aria-label="Tìm vật tư phát sinh để thêm"
                        className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm focus:border-sky-600 focus:outline-none"
                      />
                    </div>
                    <div className="mt-2 max-h-52 divide-y divide-slate-200 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                      {filteredCatalog.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          disabled={submitting}
                          onClick={() => handleAddItemToActiveOrder(cat)}
                          className="flex min-h-[48px] w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-sm hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-900">
                              {cat.name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {cat.category === 'service'
                                ? 'Tiền công'
                                : 'Vật tư'}{' '}
                              · {cat.unit}
                            </div>
                          </div>
                          <span className="font-mono text-sm font-bold text-sky-700 tabular-nums shrink-0">
                            {formatVND(cat.currentPrice)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Itemized List */}
                <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
                  {activeOrder.items.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-500">
                      Chưa ghi nhận vật tư hoặc tiền công nào. Bấm nút xanh ở
                      trên để thêm công việc / vật tư thực tế trước mặt khách.
                    </div>
                  ) : (
                    activeOrder.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-3 p-3.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-900">
                            {item.name}
                          </div>
                          <div className="font-mono text-xs text-slate-500 tabular-nums">
                            {formatVND(item.lockedUnitPrice)} / {item.unit}
                            {item.warrantyMonths > 0
                              ? ` · BH ${item.warrantyMonths} tháng`
                              : ''}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {activeOrder.status !== 'completed' && (
                            <div className="flex items-center rounded-lg border border-slate-200">
                              <button
                                type="button"
                                onClick={() =>
                                  handleChangeQuantity(item.id, -1)
                                }
                                aria-label={`Giảm số lượng ${item.name}`}
                                className="flex h-10 w-10 items-center justify-center text-slate-600 hover:bg-slate-100"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="min-w-[2.5rem] text-center font-mono text-sm font-bold tabular-nums">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleChangeQuantity(item.id, 1)}
                                aria-label={`Tăng số lượng ${item.name}`}
                                className="flex h-10 w-10 items-center justify-center text-slate-600 hover:bg-slate-100"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}

                          <div className="min-w-[5.5rem] text-right font-mono text-sm font-bold text-slate-900 tabular-nums">
                            {formatVND(item.quantity * item.lockedUnitPrice)}
                          </div>

                          {activeOrder.status !== 'completed' && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              aria-label={`Xóa ${item.name}`}
                              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Transparent Grand Total */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Tiền công dịch vụ</span>
                    <span className="font-mono tabular-nums">
                      {formatVND(activeTotals.serviceTotal)}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-slate-600">
                    <span>Tiền vật tư</span>
                    <span className="font-mono tabular-nums">
                      {formatVND(activeTotals.materialTotal)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2.5 text-base font-bold text-slate-900">
                    <span>Tổng khách cần thanh toán</span>
                    <span className="font-mono text-xl text-sky-700 tabular-nums">
                      {formatVND(activeTotals.grandTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Waiting for material note input */}
              {showWaitingPrompt && activeOrder.status !== 'completed' && (
                <div className="mt-4 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                  <label
                    htmlFor="tech-waiting-note"
                    className="block text-xs font-bold text-amber-900"
                  >
                    Lý do tạm hoãn / Vật tư cần mua thêm
                  </label>
                  <input
                    id="tech-waiting-note"
                    type="text"
                    value={waitingNote}
                    onChange={(e) => setWaitingNote(e.target.value)}
                    placeholder="VD: Cần mua thêm ống nước, chiều quay lại làm tiếp..."
                    className="min-h-[44px] w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowWaitingPrompt(false)}
                      className="min-h-[40px] rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-amber-100"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleMarkWaitingMaterial}
                      className="min-h-[40px] rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
                    >
                      Xác nhận Chờ vật tư
                    </button>
                  </div>
                </div>
              )}

              {/* Bottom Action Buttons */}
              {activeOrder.status !== 'completed' && (
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setShowWaitingPrompt((v) => !v)}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 transition-colors hover:bg-amber-100"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Báo chờ vật tư
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleCompleteJob}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    {submitting ? 'Đang đồng bộ...' : 'Hoàn thành & Thu tiền'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
