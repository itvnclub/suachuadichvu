import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileEdit,
  Search,
  Wrench,
  XCircle,
} from 'lucide-react';
import type { ServiceOrder } from '../types';
import {
  calculateOrderTotals,
  formatDateVN,
  formatVND,
  getStatusDisplay,
} from '../utils/serviceLogic';

interface AdminBoardViewProps {
  orders: ServiceOrder[];
  onOpenOrder: (order: ServiceOrder) => void;
}

export const AdminBoardView: React.FC<AdminBoardViewProps> = ({
  orders,
  onOpenOrder,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.code.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.includes(q) ||
        o.technicianName.toLowerCase().includes(q) ||
        o.issueDescription.toLowerCase().includes(q)
    );
  }, [orders, searchQuery]);

  const columns = useMemo(() => {
    const pending: ServiceOrder[] = [];
    const completed: ServiceOrder[] = [];
    const waitingOrCancelled: ServiceOrder[] = [];

    for (const order of filteredOrders) {
      const col = getStatusDisplay(order.status).column;
      if (col === 'pending') pending.push(order);
      else if (col === 'completed') completed.push(order);
      else waitingOrCancelled.push(order);
    }

    return { pending, completed, waitingOrCancelled };
  }, [filteredOrders]);

  const renderOrderCard = (order: ServiceOrder) => {
    const totals = calculateOrderTotals(order.items);
    return (
      <div
        key={order.id}
        className="rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-mono font-semibold text-slate-800">
              {order.code}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {formatDateVN(order.scheduledDate)} {order.scheduledTime}
            </span>
          </div>
          {order.status === 'waiting_material' && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 whitespace-nowrap">
              <AlertTriangle className="h-3 w-3" />
              Chờ vật tư
            </span>
          )}
          {order.status === 'cancelled' && (
            <span className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 whitespace-nowrap">
              <XCircle className="h-3 w-3" />
              Khách hủy
            </span>
          )}
        </div>

        <h4 className="mt-2 font-bold text-slate-900">{order.customerName}</h4>
        <div className="mt-0.5 text-xs text-slate-600">
          <span className="font-mono tabular-nums">{order.customerPhone}</span>{' '}
          · {order.customerAddress}
        </div>

        <p className="mt-2.5 text-sm text-slate-700 line-clamp-2">
          {order.issueDescription}
        </p>

        {order.statusNote && (
          <div className="mt-2 rounded bg-amber-50/70 px-2.5 py-1.5 text-xs text-amber-900">
            Ghi chú: {order.statusNote}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Wrench className="h-3.5 w-3.5 text-slate-400" />
            <span>{order.technicianName}</span>
          </div>

          <div className="flex items-center gap-3">
            {totals.grandTotal > 0 ? (
              <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                {formatVND(totals.grandTotal)}
              </span>
            ) : (
              <span className="text-xs font-medium text-slate-400">
                Chưa chốt
              </span>
            )}
            <button
              type="button"
              onClick={() => onOpenOrder(order)}
              aria-label={`Cập nhật đơn ${order.code}`}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap"
            >
              <FileEdit className="h-3.5 w-3.5" />
              Chi tiết
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Search Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo mã đơn, tên khách, SĐT hoặc tên thợ..."
            aria-label="Tìm kiếm đơn hàng trên bảng tiến độ"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-4 text-xs font-medium text-slate-600 tabular-nums">
          <span>Tổng cộng: {filteredOrders.length} đơn</span>
        </div>
      </div>

      {/* 3-Column Board */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Column 1: Pending */}
        <section
          aria-label="Cột 1 - Chờ xử lý"
          className="flex flex-col rounded-xl border border-slate-200 bg-slate-100/70 p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-sky-700" />
              <h3 className="text-sm font-bold text-slate-900">
                1. Chờ xử lý
              </h3>
            </div>
            <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums">
              {columns.pending.length} đơn
            </span>
          </div>
          <div className="space-y-3">
            {columns.pending.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-6 text-center text-xs text-slate-500">
                Không có đơn chờ xử lý.
              </div>
            ) : (
              columns.pending.map(renderOrderCard)
            )}
          </div>
        </section>

        {/* Column 2: Completed */}
        <section
          aria-label="Cột 2 - Hoàn thành"
          className="flex flex-col rounded-xl border border-slate-200 bg-slate-100/70 p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              <h3 className="text-sm font-bold text-slate-900">
                2. Hoàn thành
              </h3>
            </div>
            <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums">
              {columns.completed.length} đơn
            </span>
          </div>
          <div className="space-y-3">
            {columns.completed.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-6 text-center text-xs text-slate-500">
                Chưa có đơn hoàn thành.
              </div>
            ) : (
              columns.completed.map(renderOrderCard)
            )}
          </div>
        </section>

        {/* Column 3: Cancelled / Waiting for Materials */}
        <section
          aria-label="Cột 3 - Khách hủy / Chờ vật tư"
          className="flex flex-col rounded-xl border border-slate-200 bg-slate-100/70 p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              <h3 className="text-sm font-bold text-slate-900">
                3. Khách hủy / Chờ vật tư
              </h3>
            </div>
            <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums">
              {columns.waitingOrCancelled.length} đơn
            </span>
          </div>
          <div className="space-y-3">
            {columns.waitingOrCancelled.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-6 text-center text-xs text-slate-500">
                Không có đơn chờ vật tư hoặc hủy.
              </div>
            ) : (
              columns.waitingOrCancelled.map(renderOrderCard)
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
