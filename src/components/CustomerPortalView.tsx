import React, { useState } from 'react';
import {
  CalendarCheck,
  ClipboardList,
  Phone,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  lookupCustomerByPhone,
  type CustomerLookupResponse,
} from '../utils/api';
import {
  calculateOrderTotals,
  formatDateVN,
  formatVND,
  getStatusDisplay,
} from '../utils/serviceLogic';

interface CustomerPortalViewProps {
  samplePhones: Array<{ name: string; phone: string }>;
}

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  samplePhones,
}) => {
  const [phoneInput, setPhoneInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] =
    useState<CustomerLookupResponse | null>(null);

  const performLookup = async (phoneToSearch: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await lookupCustomerByPhone(phoneToSearch);
      setLookupResult(res);
    } catch (err) {
      setLookupResult(null);
      setError(
        err instanceof Error
          ? err.message
          : 'Không tìm thấy thông tin khách hàng.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLookup(phoneInput);
  };

  // Screen 1: Single-Input Phone Login
  if (!lookupResult) {
    return (
      <div className="mx-auto flex min-h-[68vh] max-w-lg flex-col justify-center py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900">
              Tra cứu bảo hành & lịch sử sửa chữa
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Nhập số điện thoại bạn đã đăng ký dịch vụ để xem chi tiết hóa đơn,
              thời hạn bảo hành và lịch bảo dưỡng định kỳ.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="customer-portal-phone"
                className="block text-sm font-semibold text-slate-800"
              >
                Nhập số điện thoại của bạn
              </label>
              <div className="relative mt-2">
                <Phone className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="customer-portal-phone"
                  type="tel"
                  required
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="VD: 0901234567"
                  className="w-full rounded-xl border border-slate-300 bg-white py-3.5 pr-4 pl-12 font-mono text-base text-slate-900 tabular-nums focus:border-sky-600 focus:outline-none"
                />
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-3.5 text-sm font-bold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
              {loading ? 'Đang tra cứu...' : 'Tra cứu hồ sơ'}
            </button>
          </form>

          {samplePhones.length > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <div className="text-center text-xs font-medium text-slate-500">
                Số điện thoại mẫu để tra cứu nhanh
              </div>
              <div className="mt-2.5 flex flex-wrap justify-center gap-2">
                {samplePhones.map((sp) => (
                  <button
                    key={sp.phone}
                    type="button"
                    onClick={() => {
                      setPhoneInput(sp.phone);
                      performLookup(sp.phone);
                    }}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800"
                  >
                    {sp.name} · <span className="font-mono">{sp.phone}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Screen 2: Customer Lookup Results (3 required sections)
  const { customer, orders, warranties, maintenance, shopHotline } =
    lookupResult;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Customer Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <div className="text-xs font-medium text-slate-500">
            Hồ sơ khách hàng
          </div>
          <h2 className="mt-0.5 text-xl font-bold text-slate-900">
            {customer.name}
          </h2>
          <div className="mt-1 text-sm text-slate-600">
            <span className="font-mono font-semibold text-slate-800 tabular-nums">
              {customer.phone}
            </span>{' '}
            · {customer.address}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setLookupResult(null);
            setPhoneInput('');
            setError(null);
          }}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
        >
          Tra cứu SĐT khác
        </button>
      </div>

      {/* 3 Sections Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Mục 1: Lịch sử sửa chữa */}
        <section className="space-y-4 lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <ClipboardList className="h-5 w-5 text-sky-700" />
              <h3 className="text-lg font-bold text-slate-900">
                1. Lịch sử sửa chữa ({orders.length})
              </h3>
            </div>

            <div className="mt-4 space-y-4">
              {orders.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  Chưa có lần sửa chữa nào được ghi nhận.
                </p>
              ) : (
                orders.map((ord) => {
                  const totals = calculateOrderTotals(ord.items);
                  const statusMeta = getStatusDisplay(ord.status);
                  return (
                    <div
                      key={ord.id}
                      className="rounded-lg border border-slate-200 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-slate-800">
                            Ngày {formatDateVN(ord.scheduledDate)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>Mã {ord.code}</span>
                          <span aria-hidden="true">·</span>
                          <span>Thợ: {ord.technicianName}</span>
                        </div>
                        <span className="font-semibold text-slate-700">
                          {statusMeta.label}
                        </span>
                      </div>

                      <div className="mt-2 font-semibold text-slate-900">
                        {ord.issueDescription}
                      </div>

                      {ord.items.length > 0 && (
                        <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-sm">
                          {ord.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-3 text-slate-700"
                            >
                              <span>
                                {item.name} ({item.quantity} {item.unit})
                              </span>
                              <span className="font-mono font-medium text-slate-900 tabular-nums shrink-0">
                                {formatVND(item.quantity * item.lockedUnitPrice)}
                              </span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between border-t border-slate-100 pt-2 font-bold text-slate-900">
                            <span>Tổng thanh toán</span>
                            <span className="font-mono text-sky-700 tabular-nums">
                              {formatVND(totals.grandTotal)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Right Column: Mục 2 - Hạn bảo hành + Mục 3 - Lịch bảo dưỡng */}
        <div className="space-y-6 lg:col-span-5">
          {/* Mục 2: Hạn bảo hành */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <ShieldCheck className="h-5 w-5 text-emerald-700" />
              <h3 className="text-lg font-bold text-slate-900">
                2. Hạn bảo hành
              </h3>
            </div>

            <div className="mt-4 space-y-3">
              {warranties.length === 0 ? (
                <p className="py-4 text-sm text-slate-500">
                  Chưa có hạng mục nào đang áp dụng bảo hành.
                </p>
              ) : (
                warranties.map((w) => (
                  <div
                    key={`${w.orderId}_${w.lineItemId}`}
                    className="rounded-lg border border-slate-200 p-3.5"
                  >
                    <div className="font-semibold text-slate-900">
                      {w.itemName}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      Sửa ngày {formatDateVN(w.completedDate)} · Gói{' '}
                      {w.warrantyMonths} tháng (đến {formatDateVN(w.expiresAt)})
                    </div>
                    <div className="mt-2">
                      {w.isActive ? (
                        <span className="inline-flex items-center gap-1.5 rounded bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                          {w.statusLabel}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                          <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
                          {w.statusLabel}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Mục 3: Lịch bảo dưỡng + Hotline */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <CalendarCheck className="h-5 w-5 text-amber-700" />
              <h3 className="text-lg font-bold text-slate-900">
                3. Lịch bảo dưỡng
              </h3>
            </div>

            <div className="mt-4 space-y-3">
              {maintenance.length === 0 ? (
                <p className="py-2 text-sm text-slate-500">
                  Hiện chưa có lịch bảo dưỡng định kỳ sắp tới.
                </p>
              ) : (
                maintenance.map((m) => (
                  <div
                    key={`${m.orderId}_${m.lineItemId}`}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3.5"
                  >
                    <div className="font-semibold text-slate-900">
                      {m.itemName}
                    </div>
                    <div className="mt-1 text-sm text-slate-700">
                      Lịch bảo dưỡng sắp tới:{' '}
                      <span className="font-mono font-bold text-sky-800 tabular-nums">
                        {formatDateVN(m.dueDate)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {m.daysUntilDue === 0
                        ? 'Đến hạn hôm nay'
                        : m.daysUntilDue < 0
                          ? `Đã qua hẹn ${Math.abs(m.daysUntilDue)} ngày`
                          : `Còn ${m.daysUntilDue} ngày nữa`}
                    </div>
                  </div>
                ))
              )}

              <div className="pt-2">
                <a
                  href={`tel:${shopHotline.replace(/\s+/g, '')}`}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-700"
                >
                  <Phone className="h-4 w-4" />
                  Hotline đặt lịch: {shopHotline}
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
