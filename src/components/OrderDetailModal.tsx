import React, { useMemo, useState } from 'react';
import {
  Check,
  Lock,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type {
  CatalogItem,
  OrderLineItem,
  OrderStatus,
  ServiceOrder,
  Technician,
} from '../types';
import {
  calculateOrderTotals,
  createLockedLineItem,
  formatDateVN,
  formatVND,
} from '../utils/serviceLogic';

interface OrderDetailModalProps {
  order: ServiceOrder;
  catalog: CatalogItem[];
  technicians: Technician[];
  onClose: () => void;
  onSave: (
    orderId: string,
    payload: {
      status: OrderStatus;
      statusNote: string;
      technicianId: string;
      scheduledDate: string;
      scheduledTime: string;
      issueDescription: string;
      items: OrderLineItem[];
    }
  ) => Promise<void>;
}

const WARRANTY_OPTIONS = [
  { value: 0, label: 'Không bảo hành' },
  { value: 1, label: '1 tháng' },
  { value: 3, label: '3 tháng' },
  { value: 6, label: '6 tháng' },
  { value: 12, label: '12 tháng' },
];

const MAINTENANCE_OPTIONS = [
  { value: 0, label: 'Không nhắc' },
  { value: 3, label: 'Nhắc sau 3 tháng' },
  { value: 6, label: 'Nhắc sau 6 tháng' },
  { value: 12, label: 'Nhắc sau 12 tháng' },
];

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  catalog,
  technicians,
  onClose,
  onSave,
}) => {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [statusNote, setStatusNote] = useState(order.statusNote ?? '');
  const [technicianId, setTechnicianId] = useState(order.technicianId);
  const [scheduledDate, setScheduledDate] = useState(order.scheduledDate);
  const [scheduledTime, setScheduledTime] = useState(order.scheduledTime);
  const [issueDescription, setIssueDescription] = useState(
    order.issueDescription
  );
  const [items, setItems] = useState<OrderLineItem[]>(() =>
    order.items.map((item) => ({ ...item }))
  );

  const [showCatalogPicker, setShowCatalogPicker] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.category === 'service' ? 'dịch vụ' : 'vật tư').includes(q)
    );
  }, [catalog, catalogSearch]);

  const totals = useMemo(() => calculateOrderTotals(items), [items]);

  const handleAddCatalogItem = (cat: CatalogItem) => {
    const locked = createLockedLineItem(cat, 1);
    setItems((prev) => [...prev, locked]);
    setCatalogSearch('');
    setShowCatalogPicker(false);
  };

  const handleUpdateLineItem = (
    lineId: string,
    patch: Partial<OrderLineItem>
  ) => {
    setItems((prev) =>
      prev.map((item) => (item.id === lineId ? { ...item, ...patch } : item))
    );
  };

  const handleRemoveLineItem = (lineId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== lineId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave(order.id, {
        status,
        statusNote,
        technicianId,
        scheduledDate,
        scheduledTime,
        issueDescription,
        items,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không thể lưu cập nhật đơn hàng.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-modal-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-mono font-semibold text-slate-700">
                {order.code}
              </span>
              <span aria-hidden="true">·</span>
              <span>Ngày tạo {formatDateVN(order.createdAt)}</span>
            </div>
            <h2
              id="order-modal-title"
              className="mt-0.5 truncate text-lg font-bold text-slate-900"
            >
              Chi tiết đơn hàng — {order.customerName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng chi tiết đơn hàng"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-y-auto"
        >
          <div className="space-y-6 p-6">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {/* Customer & Dispatch Metadata */}
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-12">
              <div className="md:col-span-4">
                <div className="text-xs font-medium text-slate-500">
                  Khách hàng & SĐT
                </div>
                <div className="mt-1 font-semibold text-slate-900">
                  {order.customerName}
                </div>
                <div className="font-mono text-sm text-slate-700 tabular-nums">
                  {order.customerPhone}
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  {order.customerAddress}
                </div>
              </div>

              <div className="space-y-3 md:col-span-5">
                <div>
                  <label
                    htmlFor="modal-technician"
                    className="block text-xs font-medium text-slate-600"
                  >
                    Thợ phụ trách
                  </label>
                  <select
                    id="modal-technician"
                    value={technicianId}
                    onChange={(e) => setTechnicianId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                  >
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} — {t.specialty}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="modal-date"
                      className="block text-xs font-medium text-slate-600"
                    >
                      Ngày hẹn
                    </label>
                    <input
                      id="modal-date"
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="modal-time"
                      className="block text-xs font-medium text-slate-600"
                    >
                      Giờ hẹn
                    </label>
                    <input
                      id="modal-time"
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 md:col-span-3">
                <div>
                  <label
                    htmlFor="modal-status"
                    className="block text-xs font-medium text-slate-600"
                  >
                    Trạng thái xử lý
                  </label>
                  <select
                    id="modal-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as OrderStatus)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-sky-600 focus:outline-none"
                  >
                    <option value="pending">Chờ xử lý</option>
                    <option value="completed">Hoàn thành (Đã thu tiền)</option>
                    <option value="waiting_material">Chờ vật tư / Tạm hoãn</option>
                    <option value="cancelled">Khách hủy</option>
                  </select>
                </div>

                {(status === 'waiting_material' || status === 'cancelled') && (
                  <div>
                    <label
                      htmlFor="modal-status-note"
                      className="block text-xs font-medium text-slate-600"
                    >
                      Ghi chú lý do
                    </label>
                    <input
                      id="modal-status-note"
                      type="text"
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      placeholder="VD: Cần mua thêm ống nước phi 27..."
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Issue description */}
            <div>
              <label
                htmlFor="modal-issue"
                className="block text-xs font-medium text-slate-600"
              >
                Tình trạng hư hỏng ghi nhận
              </label>
              <textarea
                id="modal-issue"
                rows={2}
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>

            {/* Line Items & Price Lock Section */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Vật tư & Dịch vụ thực tế
                  </h3>
                  <p className="text-xs text-slate-500">
                    Đơn giá được chốt cứng theo thời điểm thêm vào hóa đơn,
                    không bị ảnh hưởng nếu bảng giá tăng sau này.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCatalogPicker((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-700 whitespace-nowrap shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Thêm vật tư, dịch vụ
                </button>
              </div>

              {/* Autocomplete Catalog Picker */}
              {showCatalogPicker && (
                <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      autoFocus
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Gõ tên vật tư hoặc dịch vụ (VD: Van, Tụ, Vệ sinh)..."
                      aria-label="Tìm kiếm vật tư hoặc dịch vụ để thêm vào đơn"
                      className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                    />
                  </div>
                  <div className="mt-2 max-h-48 divide-y divide-slate-200 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                    {filteredCatalog.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-500">
                        Không tìm thấy hạng mục phù hợp trong bảng giá.
                      </div>
                    ) : (
                      filteredCatalog.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleAddCatalogItem(cat)}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-900">
                              {cat.name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {cat.category === 'service'
                                ? 'Dịch vụ'
                                : 'Vật tư'}{' '}
                              · Đơn vị: {cat.unit}
                              {cat.defaultWarrantyMonths > 0
                                ? ` · BH mặc định ${cat.defaultWarrantyMonths} tháng`
                                : ''}
                            </div>
                          </div>
                          <div className="font-mono text-sm font-semibold text-sky-700 tabular-nums shrink-0">
                            {formatVND(cat.currentPrice)}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Line Items Table */}
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">
                  Chưa có vật tư hoặc dịch vụ nào trong đơn. Bấm &ldquo;Thêm vật
                  tư, dịch vụ&rdquo; ở trên để bổ sung.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="px-3 py-2.5">Hạng mục</th>
                        <th className="px-3 py-2.5 text-right">SL</th>
                        <th className="px-3 py-2.5 text-right">
                          Đơn giá (Đã khóa)
                        </th>
                        <th className="px-3 py-2.5">Bảo hành</th>
                        <th className="px-3 py-2.5">Bảo dưỡng</th>
                        <th className="px-3 py-2.5 text-right">Thành tiền</th>
                        <th className="px-2 py-2.5 text-center">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {items.map((item) => {
                        const lineTotal = Math.round(
                          item.quantity * item.lockedUnitPrice
                        );
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70">
                            <td className="px-3 py-2.5">
                              <div className="font-medium text-slate-900">
                                {item.name}
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                                <span>
                                  {item.category === 'service'
                                    ? 'Tiền công'
                                    : 'Vật tư'}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>ĐVT: {item.unit}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="number"
                                min={0.5}
                                step={0.5}
                                value={item.quantity}
                                aria-label={`Số lượng ${item.name}`}
                                onChange={(e) =>
                                  handleUpdateLineItem(item.id, {
                                    quantity: Math.max(
                                      0.5,
                                      Number(e.target.value) || 1
                                    ),
                                  })
                                }
                                className="w-16 rounded border border-slate-300 px-2 py-1 text-right font-mono text-xs tabular-nums focus:border-sky-600 focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <div className="inline-flex items-center justify-end gap-1 font-mono text-xs font-semibold text-slate-800 tabular-nums">
                                <Lock
                                  className="h-3 w-3 text-slate-400"
                                  aria-label="Giá đã khóa"
                                />
                                <span>{formatVND(item.lockedUnitPrice)}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <select
                                value={item.warrantyMonths}
                                aria-label={`Bảo hành cho ${item.name}`}
                                onChange={(e) =>
                                  handleUpdateLineItem(item.id, {
                                    warrantyMonths: Number(e.target.value),
                                  })
                                }
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-sky-600 focus:outline-none"
                              >
                                {WARRANTY_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2.5">
                              <select
                                value={item.maintenanceMonths}
                                aria-label={`Bảo dưỡng cho ${item.name}`}
                                onChange={(e) =>
                                  handleUpdateLineItem(item.id, {
                                    maintenanceMonths: Number(e.target.value),
                                  })
                                }
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-sky-600 focus:outline-none"
                              >
                                {MAINTENANCE_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-900 tabular-nums">
                              {formatVND(lineTotal)}
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveLineItem(item.id)}
                                aria-label={`Xóa ${item.name}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Order Totals Summary */}
              <div className="flex flex-col items-end gap-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <div className="flex w-full max-w-xs justify-between text-slate-600">
                  <span>Tiền công dịch vụ:</span>
                  <span className="font-mono tabular-nums">
                    {formatVND(totals.serviceTotal)}
                  </span>
                </div>
                <div className="flex w-full max-w-xs justify-between text-slate-600">
                  <span>Tiền vật tư:</span>
                  <span className="font-mono tabular-nums">
                    {formatVND(totals.materialTotal)}
                  </span>
                </div>
                <div className="mt-1 flex w-full max-w-xs justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
                  <span>Tổng hóa đơn:</span>
                  <span className="font-mono text-sky-700 tabular-nums">
                    {formatVND(totals.grandTotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {saving ? 'Đang lưu...' : 'Lưu & Chốt chi phí'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
