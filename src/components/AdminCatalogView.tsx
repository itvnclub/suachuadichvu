import React, { useMemo, useState } from 'react';
import { Check, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import type { CatalogCategory, CatalogItem } from '../types';
import { formatDateVN, formatVND } from '../utils/serviceLogic';

interface AdminCatalogViewProps {
  catalog: CatalogItem[];
  onCreateItem: (payload: {
    name: string;
    category: CatalogCategory;
    unit: string;
    currentPrice: number;
    defaultWarrantyMonths: number;
    defaultMaintenanceMonths: number;
  }) => Promise<void>;
  onUpdateItem: (id: string, payload: Partial<CatalogItem>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
}

export const AdminCatalogView: React.FC<AdminCatalogViewProps> = ({
  catalog,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
}) => {
  const [filterCat, setFilterCat] = useState<'all' | CatalogCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Create form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<CatalogCategory>('material');
  const [newUnit, setNewUnit] = useState('cái');
  const [newPrice, setNewPrice] = useState('100000');
  const [newWarranty, setNewWarranty] = useState('3');
  const [newMaintenance, setNewMaintenance] = useState('0');
  const [savingNew, setSavingNew] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editWarranty, setEditWarranty] = useState('0');
  const [editMaintenance, setEditMaintenance] = useState('0');
  const [savingEdit, setSavingEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return catalog.filter((item) => {
      if (filterCat !== 'all' && item.category !== filterCat) return false;
      if (q && !item.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [catalog, filterCat, searchQuery]);

  const handleStartEdit = (item: CatalogItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditUnit(item.unit);
    setEditPrice(String(item.currentPrice));
    setEditWarranty(String(item.defaultWarrantyMonths));
    setEditMaintenance(String(item.defaultMaintenanceMonths));
    setError(null);
  };

  const handleSaveEdit = async (id: string) => {
    setError(null);
    setSavingEdit(true);
    try {
      await onUpdateItem(id, {
        name: editName.trim(),
        unit: editUnit.trim(),
        currentPrice: Number(editPrice),
        defaultWarrantyMonths: Number(editWarranty),
        defaultMaintenanceMonths: Number(editMaintenance),
      });
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể cập nhật giá.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavingNew(true);
    try {
      await onCreateItem({
        name: newName,
        category: newCategory,
        unit: newUnit,
        currentPrice: Number(newPrice),
        defaultWarrantyMonths: Number(newWarranty),
        defaultMaintenanceMonths: Number(newMaintenance),
      });
      setNewName('');
      setNewPrice('100000');
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể thêm mục mới.');
    } finally {
      setSavingNew(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setFilterCat('all')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                filterCat === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({catalog.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterCat('material')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                filterCat === 'material'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vật tư
            </button>
            <button
              type="button"
              onClick={() => setFilterCat('service')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                filterCat === 'service'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dịch vụ / Tiền công
            </button>
          </div>

          <div className="relative w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên vật tư, dịch vụ..."
              aria-label="Tìm kiếm trong bảng giá"
              className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pr-3 pl-9 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Thêm mới vào bảng giá
        </button>
      </div>

      {/* Price Lock Notice */}
      <div className="rounded-lg border border-sky-200 bg-sky-50/70 px-4 py-3 text-xs text-sky-900">
        <strong>Nguyên tắc khóa giá:</strong> Khi bạn sửa đơn giá tại đây, giá
        mới sẽ tự động áp dụng cho các đơn hàng phát sinh từ phút này trở đi. Các
        hóa đơn cũ đã lưu vẫn giữ nguyên đơn giá tại thời điểm chốt đơn.
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* Add New Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-slate-200 bg-white p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              Thêm dịch vụ / vật tư mới
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              aria-label="Đóng biểu mẫu thêm mới"
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <label
                htmlFor="cat-new-name"
                className="block text-xs font-semibold text-slate-700"
              >
                Tên dịch vụ / vật tư
              </label>
              <input
                id="cat-new-name"
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="VD: Van khóa đồng phi 21"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="cat-new-type"
                className="block text-xs font-semibold text-slate-700"
              >
                Phân loại
              </label>
              <select
                id="cat-new-type"
                value={newCategory}
                onChange={(e) =>
                  setNewCategory(e.target.value as CatalogCategory)
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-600 focus:outline-none"
              >
                <option value="material">Vật tư</option>
                <option value="service">Dịch vụ</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="cat-new-unit"
                className="block text-xs font-semibold text-slate-700"
              >
                Đơn vị
              </label>
              <input
                id="cat-new-unit"
                type="text"
                required
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                placeholder="cái / mét / ca"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="cat-new-price"
                className="block text-xs font-semibold text-slate-700"
              >
                Đơn giá (VNĐ)
              </label>
              <input
                id="cat-new-price"
                type="number"
                min={0}
                step={1000}
                required
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums focus:border-sky-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="cat-new-warranty"
                className="block text-xs font-semibold text-slate-700"
              >
                BH / BD (tháng)
              </label>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                <select
                  aria-label="Bảo hành mặc định"
                  value={newWarranty}
                  onChange={(e) => setNewWarranty(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"
                >
                  <option value="0">BH: 0t</option>
                  <option value="1">BH: 1t</option>
                  <option value="3">BH: 3t</option>
                  <option value="6">BH: 6t</option>
                  <option value="12">BH: 12t</option>
                </select>
                <select
                  aria-label="Bảo dưỡng mặc định"
                  value={newMaintenance}
                  onChange={(e) => setNewMaintenance(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"
                >
                  <option value="0">BD: 0t</option>
                  <option value="3">BD: 3t</option>
                  <option value="6">BD: 6t</option>
                  <option value="12">BD: 12t</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={savingNew}
              className="rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {savingNew ? 'Đang thêm...' : 'Lưu vào bảng giá'}
            </button>
          </div>
        </form>
      )}

      {/* Catalog Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Tên dịch vụ / vật tư</th>
                <th className="px-4 py-3">Loại</th>
                <th className="px-4 py-3">ĐVT</th>
                <th className="px-4 py-3 text-right">Đơn giá hiện hành</th>
                <th className="px-4 py-3">Bảo hành / Bảo dưỡng</th>
                <th className="px-4 py-3">Cập nhật</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredItems.map((item) => {
                const isEditing = editingId === item.id;
                return (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editName}
                          aria-label={`Sửa tên ${item.name}`}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded border border-sky-400 px-2.5 py-1 text-sm focus:outline-none"
                        />
                      ) : (
                        item.name
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {item.category === 'service' ? 'Dịch vụ' : 'Vật tư'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editUnit}
                          aria-label={`Sửa đơn vị ${item.name}`}
                          onChange={(e) => setEditUnit(e.target.value)}
                          className="w-16 rounded border border-sky-400 px-2 py-1 text-xs focus:outline-none"
                        />
                      ) : (
                        item.unit
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          value={editPrice}
                          aria-label={`Sửa đơn giá ${item.name}`}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-28 rounded border border-sky-500 px-2.5 py-1 text-right font-mono text-sm font-semibold tabular-nums focus:outline-none"
                        />
                      ) : (
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          {formatVND(item.currentPrice)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <select
                            aria-label={`Sửa bảo hành ${item.name}`}
                            value={editWarranty}
                            onChange={(e) => setEditWarranty(e.target.value)}
                            className="rounded border border-slate-300 px-1.5 py-1 text-xs"
                          >
                            <option value="0">BH 0t</option>
                            <option value="1">BH 1t</option>
                            <option value="3">BH 3t</option>
                            <option value="6">BH 6t</option>
                            <option value="12">BH 12t</option>
                          </select>
                          <select
                            aria-label={`Sửa bảo dưỡng ${item.name}`}
                            value={editMaintenance}
                            onChange={(e) => setEditMaintenance(e.target.value)}
                            className="rounded border border-slate-300 px-1.5 py-1 text-xs"
                          >
                            <option value="0">BD 0t</option>
                            <option value="3">BD 3t</option>
                            <option value="6">BD 6t</option>
                            <option value="12">BD 12t</option>
                          </select>
                        </div>
                      ) : (
                        <span>
                          BH:{' '}
                          {item.defaultWarrantyMonths > 0
                            ? `${item.defaultWarrantyMonths} tháng`
                            : 'Không'}
                          {item.defaultMaintenanceMonths > 0
                            ? ` · Nhắc BD ${item.defaultMaintenanceMonths} tháng`
                            : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 tabular-nums">
                      {formatDateVN(item.updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={savingEdit}
                            onClick={() => handleSaveEdit(item.id)}
                            aria-label={`Lưu giá mới cho ${item.name}`}
                            className="inline-flex items-center gap-1 rounded bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-700"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Lưu
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            aria-label={`Hủy sửa ${item.name}`}
                            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(item)}
                            aria-label={`Chỉnh sửa ${item.name}`}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                          >
                            <Pencil className="h-3 w-3" />
                            Sửa giá
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteItem(item.id)}
                            aria-label={`Xóa ${item.name}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
