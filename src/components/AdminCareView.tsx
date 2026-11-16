import React, { useMemo, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Phone,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { ServiceOrder } from '../types';
import {
  evaluateMaintenanceAlerts,
  evaluateWarrantyRecords,
  formatDateVN,
  normalizePhone,
} from '../utils/serviceLogic';

interface AdminCareViewProps {
  orders: ServiceOrder[];
  onToggleFollowUp: (
    orderId: string,
    lineItemId: string,
    followedUp: boolean
  ) => Promise<void>;
  onScheduleMaintenanceOrder: (prefill: {
    customerId: string;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    issueDescription: string;
  }) => void;
}

export const AdminCareView: React.FC<AdminCareViewProps> = ({
  orders,
  onToggleFollowUp,
  onScheduleMaintenanceOrder,
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const [warrantyPhoneQuery, setWarrantyPhoneQuery] = useState('');

  const maintenanceAlerts = useMemo(
    () => evaluateMaintenanceAlerts(orders, today, 30),
    [orders, today]
  );

  const dueTodayAlerts = useMemo(
    () => maintenanceAlerts.filter((a) => a.daysUntilDue <= 0),
    [maintenanceAlerts]
  );

  const allWarranties = useMemo(
    () => evaluateWarrantyRecords(orders, today),
    [orders, today]
  );

  const filteredWarranties = useMemo(() => {
    const digits = normalizePhone(warrantyPhoneQuery);
    const text = warrantyPhoneQuery.trim().toLowerCase();
    if (!text) return allWarranties.slice(0, 8);
    if (digits.length >= 3) {
      return allWarranties.filter((w) =>
        normalizePhone(w.customerPhone).includes(digits)
      );
    }
    return allWarranties.filter(
      (w) =>
        w.customerName.toLowerCase().includes(text) ||
        w.itemName.toLowerCase().includes(text) ||
        w.orderCode.toLowerCase().includes(text)
    );
  }, [allWarranties, warrantyPhoneQuery]);

  return (
    <div className="space-y-6">
      {/* Section 1: Maintenance Due Alerts */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700 shrink-0">
              <BellRing className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Báo cáo đến hạn bảo dưỡng
              </h2>
              <p className="mt-0.5 text-sm text-slate-700">
                {dueTodayAlerts.length > 0 ? (
                  <>
                    Hôm nay có{' '}
                    <span className="font-mono font-bold text-amber-800">
                      {dueTodayAlerts.length}
                    </span>{' '}
                    khách hàng đến hạn bảo dưỡng / vệ sinh định kỳ (đã lắp đặt
                    hoặc bảo dưỡng trước đây).
                  </>
                ) : (
                  'Không có khách hàng nào quá hạn hôm nay. Danh sách bên dưới hiển thị lịch sắp đến hạn.'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200">
          {maintenanceAlerts.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Chưa có lịch nhắc bảo dưỡng nào trong 30 ngày tới.
            </div>
          ) : (
            maintenanceAlerts.map((alert) => (
              <div
                key={`${alert.orderId}_${alert.lineItemId}`}
                className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {alert.urgency === 'due_today' && (
                      <span className="rounded bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
                        Đến hạn hôm nay
                      </span>
                    )}
                    {alert.urgency === 'overdue' && (
                      <span className="rounded bg-red-100 px-2 py-0.5 font-semibold text-red-800">
                        Quá hạn {Math.abs(alert.daysUntilDue)} ngày
                      </span>
                    )}
                    {alert.urgency === 'upcoming' && (
                      <span className="rounded bg-sky-50 px-2 py-0.5 font-semibold text-sky-800">
                        Còn {alert.daysUntilDue} ngày
                      </span>
                    )}
                    <span className="text-slate-500">
                      Làm ngày {formatDateVN(alert.completedDate)} · Chu kỳ{' '}
                      {alert.maintenanceMonths} tháng
                    </span>
                  </div>

                  <div className="font-bold text-slate-900">
                    {alert.customerName} —{' '}
                    <span className="font-semibold text-sky-800">
                      {alert.itemName}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    <span className="font-mono font-semibold text-slate-800 tabular-nums">
                      {alert.customerPhone}
                    </span>{' '}
                    · {alert.customerAddress}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <a
                    href={`tel:${alert.customerPhone}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap"
                  >
                    <Phone className="h-3.5 w-3.5 text-emerald-600" />
                    Gọi {alert.customerPhone}
                  </a>

                  <button
                    type="button"
                    onClick={() =>
                      onToggleFollowUp(
                        alert.orderId,
                        alert.lineItemId,
                        !alert.followedUp
                      )
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                      alert.followedUp
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {alert.followedUp ? 'Đã gọi hỏi thăm' : 'Đánh dấu đã gọi'}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onScheduleMaintenanceOrder({
                        customerId: alert.customerId,
                        customerName: alert.customerName,
                        customerPhone: alert.customerPhone,
                        customerAddress: alert.customerAddress,
                        issueDescription: `Bảo dưỡng định kỳ (${alert.maintenanceMonths} tháng): ${alert.itemName}`,
                      })
                    }
                    className="inline-flex items-center rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-700 whitespace-nowrap"
                  >
                    Đặt lịch bảo dưỡng
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Section 2: Warranty Lookup */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Tra cứu bảo hành theo Số điện thoại
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Kiểm tra chính xác thời hạn bảo hành khi khách hàng phản hồi bảo
              hành hoặc hỏi thăm thiết bị cũ.
            </p>
          </div>

          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={warrantyPhoneQuery}
              onChange={(e) => setWarrantyPhoneQuery(e.target.value)}
              placeholder="Gõ SĐT khách (VD: 0909888777 hoặc 0901)..."
              aria-label="Tra cứu bảo hành theo số điện thoại"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 font-mono text-sm text-slate-900 tabular-nums focus:border-sky-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Khách hàng / SĐT</th>
                <th className="px-4 py-3">Đơn hàng & Ngày làm</th>
                <th className="px-4 py-3">Hạng mục / Vật tư</th>
                <th className="px-4 py-3">Gói bảo hành</th>
                <th className="px-4 py-3">Hết hạn</th>
                <th className="px-4 py-3">Trạng thái bảo hành</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredWarranties.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    Không tìm thấy hạng mục bảo hành nào khớp với từ khóa tra
                    cứu.
                  </td>
                </tr>
              ) : (
                filteredWarranties.map((w) => (
                  <tr
                    key={`${w.orderId}_${w.lineItemId}`}
                    className="hover:bg-slate-50/70"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {w.customerName}
                      </div>
                      <div className="font-mono text-xs text-slate-600 tabular-nums">
                        {w.customerPhone}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <span className="font-mono font-semibold text-slate-800">
                        {w.orderCode}
                      </span>{' '}
                      ·{' '}
                      <span className="font-mono tabular-nums">
                        {formatDateVN(w.completedDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {w.itemName}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {w.warrantyMonths} tháng
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 tabular-nums">
                      {formatDateVN(w.expiresAt)}
                    </td>
                    <td className="px-4 py-3">
                      {w.isActive ? (
                        <span className="inline-flex items-center gap-1.5 rounded bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 whitespace-nowrap">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                          {w.statusLabel}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 whitespace-nowrap">
                          <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
                          {w.statusLabel}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
