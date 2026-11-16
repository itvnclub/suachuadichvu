import React, { useMemo, useState } from 'react';
import { Banknote, CheckSquare, Package, Search } from 'lucide-react';
import type { ServiceOrder } from '../types';
import {
  addDaysToDate,
  computeRevenueAnalytics,
  formatVND,
} from '../utils/serviceLogic';

interface AdminAnalyticsViewProps {
  orders: ServiceOrder[];
}

export const AdminAnalyticsView: React.FC<AdminAnalyticsViewProps> = ({
  orders,
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = `${today.slice(0, 7)}-01`;

  const [preset, setPreset] = useState<'today' | 'month' | '3months' | 'all'>(
    'month'
  );
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [itemSearch, setItemSearch] = useState('');

  const handleSelectPreset = (
    next: 'today' | 'month' | '3months' | 'all'
  ) => {
    setPreset(next);
    if (next === 'today') {
      setFromDate(today);
      setToDate(today);
    } else if (next === 'month') {
      setFromDate(firstOfMonth);
      setToDate(today);
    } else if (next === '3months') {
      setFromDate(addDaysToDate(today, -90));
      setToDate(today);
    } else {
      setFromDate('');
      setToDate('');
    }
  };

  const analytics = useMemo(
    () =>
      computeRevenueAnalytics(
        orders,
        fromDate || undefined,
        toDate || undefined
      ),
    [orders, fromDate, toDate]
  );

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return analytics.itemBreakdown;
    return analytics.itemBreakdown.filter((item) =>
      item.name.toLowerCase().includes(q)
    );
  }, [analytics.itemBreakdown, itemSearch]);

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              { id: 'today', label: 'Hôm nay' },
              { id: 'month', label: 'Tháng này' },
              { id: '3months', label: '90 ngày gần đây' },
              { id: 'all', label: 'Toàn bộ lịch sử' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSelectPreset(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                preset === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label htmlFor="stats-from" className="font-medium text-slate-600">
            Từ ngày
          </label>
          <input
            id="stats-from"
            type="date"
            value={fromDate}
            onChange={(e) => {
              setPreset('all');
              setFromDate(e.target.value);
            }}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-xs text-slate-900 tabular-nums"
          />
          <label htmlFor="stats-to" className="font-medium text-slate-600">
            Đến ngày
          </label>
          <input
            id="stats-to"
            type="date"
            value={toDate}
            onChange={(e) => {
              setPreset('all');
              setToDate(e.target.value);
            }}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-xs text-slate-900 tabular-nums"
          />
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Tổng đơn đã hoàn thành</span>
            <CheckSquare className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 font-mono text-3xl font-bold text-slate-900 tabular-nums">
            {analytics.completedOrderCount} đơn
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Chỉ tính các đơn đã hoàn tất & thu tiền trong kỳ
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Tổng tiền thu về</span>
            <Banknote className="h-4 w-4 text-sky-600" />
          </div>
          <div className="mt-2 font-mono text-3xl font-bold text-sky-700 tabular-nums">
            {formatVND(analytics.totalRevenue)}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            Tiền công: {formatVND(analytics.serviceRevenue)} · Vật tư:{' '}
            {formatVND(analytics.materialRevenue)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Số loại vật tư & dịch vụ xuất</span>
            <Package className="h-4 w-4 text-slate-600" />
          </div>
          <div className="mt-2 font-mono text-3xl font-bold text-slate-900 tabular-nums">
            {analytics.itemBreakdown.length} hạng mục
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Tính theo đơn giá đã khóa trên từng hóa đơn
          </div>
        </div>
      </div>

      {/* Material & Service Consumption Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Thống kê Vật tư & Dịch vụ đã thực hiện
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Tổng hợp chi tiết số lượng công tắc, mét dây điện, van nước, ca
              sửa chữa đã xuất cho khách.
            </p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="Lọc tên vật tư / dịch vụ..."
              aria-label="Lọc tên vật tư trong thống kê"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Tên vật tư / dịch vụ</th>
                <th className="px-4 py-3">Phân loại</th>
                <th className="px-4 py-3 text-right">Số đơn dùng</th>
                <th className="px-4 py-3 text-right">Tổng số lượng</th>
                <th className="px-4 py-3 text-right">Doanh thu ghi nhận</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    Chưa có dữ liệu hoàn thành trong khoảng thời gian đã chọn.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.catalogItemId} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {item.name}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {item.category === 'service' ? 'Dịch vụ' : 'Vật tư'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-700 tabular-nums">
                      {item.orderCount} đơn
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                      {item.totalQuantity} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-sky-700 tabular-nums">
                      {formatVND(item.totalRevenue)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
