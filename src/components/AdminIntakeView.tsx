import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  History,
  Phone,
  PlusCircle,
  UserPlus,
  Wrench,
} from 'lucide-react';
import type { Customer, ServiceOrder, Technician } from '../types';
import {
  calculateOrderTotals,
  formatDateVN,
  formatVND,
  getStatusDisplay,
  normalizePhone,
  searchCustomersByPhoneOrName,
} from '../utils/serviceLogic';

interface IntakePrefill {
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  issueDescription: string;
  nonce: number;
}

interface AdminIntakeViewProps {
  customers: Customer[];
  technicians: Technician[];
  orders: ServiceOrder[];
  prefill?: IntakePrefill | null;
  onCreateOrder: (payload: {
    customerId?: string;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    technicianId: string;
    issueDescription: string;
    scheduledDate: string;
    scheduledTime: string;
  }) => Promise<void>;
  onOpenOrder: (order: ServiceOrder) => void;
  onOrderCreatedNavigateToBoard: () => void;
}

export const AdminIntakeView: React.FC<AdminIntakeViewProps> = ({
  customers,
  technicians,
  orders,
  prefill,
  onCreateOrder,
  onOpenOrder,
  onOrderCreatedNavigateToBoard,
}) => {
  const today = new Date().toISOString().slice(0, 10);

  const [phoneInput, setPhoneInput] = useState(prefill?.customerPhone ?? '');
  const [selectedCustomerId, setSelectedCustomerId] = useState<
    string | undefined
  >(prefill?.customerId);
  const [customerName, setCustomerName] = useState(prefill?.customerName ?? '');
  const [customerAddress, setCustomerAddress] = useState(
    prefill?.customerAddress ?? ''
  );
  const [issueDescription, setIssueDescription] = useState(
    prefill?.issueDescription ?? ''
  );
  const [technicianId, setTechnicianId] = useState(technicians[0]?.id ?? '');
  const [scheduledDate, setScheduledDate] = useState(today);
  const [scheduledTime, setScheduledTime] = useState('09:30');
  const [showDropdown, setShowDropdown] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const phoneMatches = useMemo(
    () => searchCustomersByPhoneOrName(customers, phoneInput),
    [customers, phoneInput]
  );

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  const customerHistory = useMemo(() => {
    if (!selectedCustomerId) return [];
    return orders
      .filter((o) => o.customerId === selectedCustomerId)
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
  }, [orders, selectedCustomerId]);

  const handlePhoneChange = (val: string) => {
    setPhoneInput(val);
    setSuccessMsg(null);
    setShowDropdown(true);
    const exactMatch = customers.find(
      (c) => normalizePhone(c.phone) === normalizePhone(val)
    );
    if (exactMatch) {
      setSelectedCustomerId(exactMatch.id);
      setCustomerName(exactMatch.name);
      setCustomerAddress(exactMatch.address);
    } else if (selectedCustomerId) {
      setSelectedCustomerId(undefined);
    }
  };

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomerId(c.id);
    setPhoneInput(c.phone);
    setCustomerName(c.name);
    setCustomerAddress(c.address);
    setShowDropdown(false);
    setError(null);
  };

  const handleClearCustomer = () => {
    setSelectedCustomerId(undefined);
    setPhoneInput('');
    setCustomerName('');
    setCustomerAddress('');
    setShowDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      await onCreateOrder({
        customerId: selectedCustomerId,
        customerName,
        customerPhone: phoneInput,
        customerAddress,
        technicianId: technicianId || technicians[0]?.id || '',
        issueDescription,
        scheduledDate,
        scheduledTime,
      });
      setSuccessMsg('Đã tạo đơn và điều phối thợ thành công.');
      setPhoneInput('');
      setSelectedCustomerId(undefined);
      setCustomerName('');
      setCustomerAddress('');
      setIssueDescription('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không thể tạo đơn hàng mới.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left: Intake & Dispatch Form */}
      <div className="lg:col-span-7">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-200 bg-white p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Thông tin tiếp nhận & Lịch hẹn
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Gõ 3–4 số đầu của SĐT để nhận diện khách cũ hoặc tạo hồ sơ mới.
              </p>
            </div>
            {selectedCustomerId && (
              <button
                type="button"
                onClick={handleClearCustomer}
                className="text-xs font-medium text-sky-700 hover:underline whitespace-nowrap"
              >
                Nhập khách khác
              </button>
            )}
          </div>

          <div className="mt-5 space-y-5">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {successMsg && (
              <div
                role="status"
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              >
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>{successMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={onOrderCreatedNavigateToBoard}
                  className="font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
                >
                  Xem bảng tiến độ
                </button>
              </div>
            )}

            {/* Smart Phone Search */}
            <div className="relative">
              <label
                htmlFor="intake-phone"
                className="block text-sm font-semibold text-slate-800"
              >
                Số điện thoại khách hàng
              </label>
              <div className="relative mt-1.5">
                <Phone className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="intake-phone"
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Nhập SĐT (VD: 0901... để gợi ý khách cũ)"
                  autoComplete="off"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3 pl-10 font-mono text-sm text-slate-900 tabular-nums focus:border-sky-600 focus:outline-none"
                />
              </div>

              {/* Autocomplete Suggestions Dropdown */}
              {showDropdown &&
                normalizePhone(phoneInput).length >= 3 &&
                !selectedCustomerId && (
                  <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                    {phoneMatches.length > 0 ? (
                      <div className="divide-y divide-slate-100">
                        <div className="bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
                          Khách hàng cũ trùng khớp ({phoneMatches.length})
                        </div>
                        {phoneMatches.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelectCustomer(c)}
                            className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-sky-50"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-slate-900">
                                {c.name}
                              </div>
                              <div className="truncate text-xs text-slate-500">
                                {c.address}
                              </div>
                            </div>
                            <span className="font-mono text-sm font-semibold text-sky-700 tabular-nums shrink-0">
                              {c.phone}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3.5 py-3 text-xs text-slate-600">
                        <UserPlus className="h-4 w-4 text-sky-600 shrink-0" />
                        <span>
                          Chưa có trong hệ thống — điền Tên và Địa chỉ bên dưới
                          để tạo khách hàng mới.
                        </span>
                      </div>
                    )}
                  </div>
                )}
            </div>

            {/* Customer Name & Address */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="intake-name"
                  className="block text-sm font-semibold text-slate-800"
                >
                  Tên khách hàng
                </label>
                <input
                  id="intake-name"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="VD: Chị Nguyễn Thị Lan"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="intake-address"
                  className="block text-sm font-semibold text-slate-800"
                >
                  Địa chỉ sửa chữa
                </label>
                <input
                  id="intake-address"
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Số nhà, đường, phường/quận"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Issue Description */}
            <div>
              <label
                htmlFor="intake-issue"
                className="block text-sm font-semibold text-slate-800"
              >
                Ghi nhận tình trạng hư hỏng
              </label>
              <textarea
                id="intake-issue"
                rows={3}
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                placeholder="VD: Máy bơm kêu to, không lên nước, cần kiểm tra tụ và van..."
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>

            {/* Technician Dispatch + Date/Time */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label
                  htmlFor="intake-tech"
                  className="block text-sm font-semibold text-slate-800"
                >
                  Điều phối thợ
                </label>
                <div className="relative mt-1.5">
                  <Wrench className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    id="intake-tech"
                    value={technicianId}
                    onChange={(e) => setTechnicianId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3 pl-9 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                  >
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="intake-date"
                  className="block text-sm font-semibold text-slate-800"
                >
                  Ngày hẹn
                </label>
                <input
                  id="intake-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 tabular-nums focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="intake-time"
                  className="block text-sm font-semibold text-slate-800"
                >
                  Giờ thợ có mặt
                </label>
                <div className="relative mt-1.5">
                  <CalendarClock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="intake-time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3 pl-9 font-mono text-sm text-slate-900 tabular-nums focus:border-sky-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-slate-100 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50 whitespace-nowrap"
              >
                <PlusCircle className="h-4 w-4" />
                {submitting ? 'Đang tạo đơn...' : 'Tạo đơn'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Right: Customer Context & Past Repair History */}
      <div className="lg:col-span-5">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
            <History className="h-5 w-5 text-slate-500" />
            <h3 className="text-base font-bold text-slate-900">
              Hồ sơ & Lịch sử sửa chữa
            </h3>
          </div>

          {!selectedCustomer ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-slate-700">
                Chưa chọn khách hàng cũ
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Nhập 3–4 số đầu của SĐT bên trái (ví dụ: <span className="font-mono font-semibold">0901</span> hoặc <span className="font-mono font-semibold">0909</span>) và chọn khách từ danh sách để xem lịch sử sửa chữa trước đây.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {customers.slice(0, 3).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCustomer(c)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800"
                  >
                    {c.name} · <span className="font-mono">{c.phone}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <div className="font-bold text-slate-900">
                  {selectedCustomer.name}
                </div>
                <div className="mt-0.5 text-xs text-slate-600">
                  <span className="font-mono font-semibold">
                    {selectedCustomer.phone}
                  </span>{' '}
                  · {selectedCustomer.address}
                </div>
                {selectedCustomer.note && (
                  <div className="mt-2 text-xs text-amber-800">
                    Lưu ý: {selectedCustomer.note}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-500">
                  Các lần sửa trước ({customerHistory.length})
                </div>

                {customerHistory.length === 0 ? (
                  <div className="text-sm text-slate-500">
                    Khách hàng chưa có lịch sử đơn hàng nào.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                    {customerHistory.map((ord) => {
                      const totals = calculateOrderTotals(ord.items);
                      const statusMeta = getStatusDisplay(ord.status);
                      return (
                        <div key={ord.id} className="p-3.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="font-mono font-semibold text-slate-800">
                                  {ord.code}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">
                                  {formatDateVN(ord.scheduledDate)}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{statusMeta.label}</span>
                              </div>
                              <div className="mt-1 text-sm font-medium text-slate-900">
                                {ord.issueDescription}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => onOpenOrder(ord)}
                              className="text-xs font-semibold text-sky-700 hover:underline whitespace-nowrap shrink-0"
                            >
                              Chi tiết
                            </button>
                          </div>

                          {ord.items.length > 0 && (
                            <div className="mt-2 space-y-1 text-xs text-slate-600">
                              {ord.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex justify-between gap-2"
                                >
                                  <span className="truncate">
                                    {item.name} ({item.quantity} {item.unit})
                                  </span>
                                  <span className="font-mono tabular-nums shrink-0">
                                    {formatVND(
                                      item.quantity * item.lockedUnitPrice
                                    )}
                                  </span>
                                </div>
                              ))}
                              <div className="flex justify-between border-t border-slate-100 pt-1 font-semibold text-slate-900">
                                <span>Tổng hóa đơn</span>
                                <span className="font-mono tabular-nums">
                                  {formatVND(totals.grandTotal)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
