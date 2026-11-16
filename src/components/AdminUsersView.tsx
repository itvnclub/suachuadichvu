import React, { useMemo, useState } from 'react';
import {
  Check,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserX,
  Wrench,
  X,
} from 'lucide-react';
import type { PublicUser, UserRole } from '../types';
import { formatDateVN } from '../utils/serviceLogic';

interface AdminUsersViewProps {
  users: PublicUser[];
  currentUserId: string;
  onCreateUser: (payload: {
    username: string;
    password: string;
    fullName: string;
    phone: string;
    role: UserRole;
    specialty: string;
    active: boolean;
  }) => Promise<void>;
  onUpdateUser: (
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
  ) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
}

export const AdminUsersView: React.FC<AdminUsersViewProps> = ({
  users,
  currentUserId,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
}) => {
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Add user modal/panel state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('123456');
  const [newFullName, setNewFullName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('technician');
  const [newSpecialty, setNewSpecialty] = useState('');
  const [newActive, setNewActive] = useState(true);
  const [savingNew, setSavingNew] = useState(false);

  // Edit modal state
  const [editingUser, setEditingUser] = useState<PublicUser | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('technician');
  const [editSpecialty, setEditSpecialty] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editPassword, setEditPassword] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Inline delete confirm state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (
        q &&
        !u.fullName.toLowerCase().includes(q) &&
        !u.username.toLowerCase().includes(q) &&
        !u.phone.includes(q) &&
        !u.specialty.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [users, roleFilter, searchQuery]);

  const adminCount = useMemo(
    () => users.filter((u) => u.role === 'admin').length,
    [users]
  );
  const techCount = useMemo(
    () => users.filter((u) => u.role === 'technician').length,
    [users]
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSavingNew(true);
    try {
      await onCreateUser({
        username: newUsername,
        password: newPassword,
        fullName: newFullName,
        phone: newPhone,
        role: newRole,
        specialty: newSpecialty,
        active: newActive,
      });
      setSuccessMsg(`Đã thêm người dùng "${newFullName.trim()}" thành công.`);
      setNewUsername('');
      setNewPassword('123456');
      setNewFullName('');
      setNewPhone('');
      setNewRole('technician');
      setNewSpecialty('');
      setNewActive(true);
      setShowAddForm(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không thể tạo người dùng mới.'
      );
    } finally {
      setSavingNew(false);
    }
  };

  const openEditModal = (u: PublicUser) => {
    setEditingUser(u);
    setEditUsername(u.username);
    setEditFullName(u.fullName);
    setEditPhone(u.phone);
    setEditRole(u.role);
    setEditSpecialty(u.specialty);
    setEditActive(u.active);
    setEditPassword('');
    setError(null);
    setSuccessMsg(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setError(null);
    setSuccessMsg(null);
    setSavingEdit(true);
    try {
      await onUpdateUser(editingUser.id, {
        username: editUsername,
        fullName: editFullName,
        phone: editPhone,
        role: editRole,
        specialty: editSpecialty,
        active: editActive,
        ...(editPassword.trim() ? { password: editPassword.trim() } : {}),
      });
      setSuccessMsg(`Đã cập nhật thông tin "${editFullName.trim()}".`);
      setEditingUser(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không thể cập nhật người dùng.'
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async (user: PublicUser) => {
    setError(null);
    setSuccessMsg(null);
    setDeletingId(user.id);
    try {
      await onDeleteUser(user.id);
      setSuccessMsg(`Đã xóa tài khoản "${user.fullName}".`);
      setConfirmDeleteId(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không thể xóa người dùng.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setRoleFilter('all')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                roleFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({users.length})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('admin')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                roleFilter === 'admin'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Admin ({adminCount})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('technician')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                roleFilter === 'technician'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Thợ thi công ({techCount})
            </button>
          </div>

          <div className="relative w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên, tài khoản, SĐT..."
              aria-label="Tìm kiếm người dùng"
              className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pr-3 pl-9 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowAddForm((v) => !v);
            setError(null);
            setSuccessMsg(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Thêm người dùng
        </button>
      </div>

      {/* Info Banner */}
      <div className="rounded-lg border border-sky-200 bg-sky-50/70 px-4 py-3 text-xs text-sky-900">
        Các tài khoản vai trò <strong>Thợ thi công</strong> đang hoạt động sẽ
        tự động đồng bộ vào danh sách điều phối khi tạo đơn hàng và có thể đăng
        nhập tại đường dẫn <span className="font-mono font-semibold">/crm/</span>.
      </div>

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
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          {successMsg}
        </div>
      )}

      {/* Add User Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-slate-200 bg-white p-5"
        >
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">
              Thêm tài khoản nhân sự mới
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              aria-label="Đóng biểu mẫu thêm người dùng"
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label
                htmlFor="user-new-fullname"
                className="block text-xs font-semibold text-slate-700"
              >
                Họ và tên
              </label>
              <input
                id="user-new-fullname"
                type="text"
                required
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="VD: Phạm Tuấn Kiệt"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="user-new-username"
                className="block text-xs font-semibold text-slate-700"
              >
                Tên đăng nhập
              </label>
              <input
                id="user-new-username"
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="VD: kiet (viết liền không dấu)"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-sky-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="user-new-password"
                className="block text-xs font-semibold text-slate-700"
              >
                Mật khẩu khởi tạo
              </label>
              <input
                id="user-new-password"
                type="text"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-sky-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="user-new-phone"
                className="block text-xs font-semibold text-slate-700"
              >
                Số điện thoại
              </label>
              <input
                id="user-new-phone"
                type="tel"
                required
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="VD: 0905123456"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums focus:border-sky-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="user-new-role"
                className="block text-xs font-semibold text-slate-700"
              >
                Vai trò
              </label>
              <select
                id="user-new-role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-600 focus:outline-none"
              >
                <option value="technician">Thợ thi công</option>
                <option value="admin">Quản trị viên (Admin)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="user-new-specialty"
                className="block text-xs font-semibold text-slate-700"
              >
                Chuyên môn / Bộ phận
              </label>
              <input
                id="user-new-specialty"
                type="text"
                value={newSpecialty}
                onChange={(e) => setNewSpecialty(e.target.value)}
                placeholder="VD: Điện lạnh & Máy giặt"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={newActive}
                onChange={(e) => setNewActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600"
              />
              Kích hoạt tài khoản ngay
            </label>

            <div className="flex items-center gap-2">
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
                {savingNew ? 'Đang lưu...' : 'Tạo tài khoản'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Users Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Họ và tên</th>
                <th className="px-4 py-3">Tên đăng nhập</th>
                <th className="px-4 py-3">Số điện thoại</th>
                <th className="px-4 py-3">Vai trò</th>
                <th className="px-4 py-3">Chuyên môn / Bộ phận</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Ngày tạo</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    Không có người dùng nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSelf = u.id === currentUserId;
                  const isConfirmingDelete = confirmDeleteId === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {u.fullName}
                        {isSelf && (
                          <span className="ml-2 text-xs font-normal text-sky-700">
                            (Đang đăng nhập)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">
                        {u.username}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700 tabular-nums">
                        {u.phone}
                      </td>
                      <td className="px-4 py-3">
                        {u.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800 whitespace-nowrap">
                            <Shield className="h-3.5 w-3.5 text-sky-700" />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 whitespace-nowrap">
                            <Wrench className="h-3.5 w-3.5 text-sky-700" />
                            Thợ thi công
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {u.specialty}
                      </td>
                      <td className="px-4 py-3">
                        {u.active ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 whitespace-nowrap">
                            <UserCheck className="h-3.5 w-3.5" />
                            Đang hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 whitespace-nowrap">
                            <UserX className="h-3.5 w-3.5" />
                            Tạm khóa
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500 tabular-nums">
                        {formatDateVN(u.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isConfirmingDelete ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={deletingId === u.id}
                              onClick={() => handleConfirmDelete(u)}
                              aria-label={`Xác nhận xóa ${u.fullName}`}
                              className="rounded bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700"
                            >
                              Xác nhận xóa
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(u)}
                              aria-label={`Sửa người dùng ${u.fullName}`}
                              className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                            >
                              <Pencil className="h-3 w-3" />
                              Sửa
                            </button>
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(u.id)}
                                aria-label={`Xóa người dùng ${u.fullName}`}
                                className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-user-modal-title"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3
                id="edit-user-modal-title"
                className="text-base font-bold text-slate-900"
              >
                Chỉnh sửa tài khoản — {editingUser.fullName}
              </h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                aria-label="Đóng hộp thoại sửa người dùng"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="edit-user-fullname"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Họ và tên
                  </label>
                  <input
                    id="edit-user-fullname"
                    type="text"
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-user-username"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Tên đăng nhập
                  </label>
                  <input
                    id="edit-user-username"
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-sky-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-user-phone"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Số điện thoại
                  </label>
                  <input
                    id="edit-user-phone"
                    type="tel"
                    required
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums focus:border-sky-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-user-role"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Vai trò
                  </label>
                  <select
                    id="edit-user-role"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-600 focus:outline-none"
                  >
                    <option value="technician">Thợ thi công</option>
                    <option value="admin">Quản trị viên (Admin)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="edit-user-specialty"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Chuyên môn / Bộ phận
                  </label>
                  <input
                    id="edit-user-specialty"
                    type="text"
                    value={editSpecialty}
                    onChange={(e) => setEditSpecialty(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="edit-user-password"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Đặt lại mật khẩu mới (để trống nếu giữ nguyên)
                  </label>
                  <input
                    id="edit-user-password"
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới nếu muốn đổi"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600"
                />
                Tài khoản đang hoạt động (cho phép đăng nhập & nhận đơn)
              </label>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  {savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
