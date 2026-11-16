import React, { useState } from 'react';
import { ArrowLeft, KeyRound, Lock, LogIn, User } from 'lucide-react';
import type { PublicUser } from '../types';
import { loginStaff, setStoredAuthToken } from '../utils/api';

interface CrmLoginViewProps {
  onLoginSuccess: (user: PublicUser) => void;
  onGoCustomerPortal: () => void;
}

export const CrmLoginView: React.FC<CrmLoginViewProps> = ({
  onLoginSuccess,
  onGoCustomerPortal,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await loginStaff(username, password);
      setStoredAuthToken(res.token);
      onLoginSuccess(res.user);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Đăng nhập không thành công.'
      );
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-5">
        <div className="text-center">
          <div className="font-display text-xl font-extrabold tracking-tight text-slate-900">
            An Tâm Kỹ Thuật
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Cổng quản trị & Điều phối nhân sự (/crm/)
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xs">
          <div className="border-b border-slate-100 pb-4">
            <h1 className="text-lg font-bold text-slate-900">
              Đăng nhập hệ thống CRM
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Dành cho Quản trị viên (Admin) và Thợ thi công của cửa hàng.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
              >
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="crm-username"
                className="block text-sm font-semibold text-slate-800"
              >
                Tên đăng nhập hoặc SĐT
              </label>
              <div className="relative mt-1.5">
                <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="crm-username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="VD: admin hoặc minh"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3 pl-10 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="crm-password"
                className="block text-sm font-semibold text-slate-800"
              >
                Mật khẩu
              </label>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="crm-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3 pl-10 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
            >
              <LogIn className="h-4 w-4" />
              {loading ? 'Đang xác thực...' : 'Đăng nhập CRM'}
            </button>
          </form>

          {/* Quick-fill demo staff credentials */}
          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <KeyRound className="h-3.5 w-3.5" />
              <span>Tài khoản mẫu (mật khẩu: 123456)</span>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => quickFill('admin', '123456')}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs transition-colors hover:border-sky-300 hover:bg-sky-50"
              >
                <div className="font-bold text-slate-900">Admin</div>
                <div className="font-mono text-slate-600">admin / 123456</div>
              </button>
              <button
                type="button"
                onClick={() => quickFill('minh', '123456')}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs transition-colors hover:border-sky-300 hover:bg-sky-50"
              >
                <div className="font-bold text-slate-900">Thợ (Minh)</div>
                <div className="font-mono text-slate-600">minh / 123456</div>
              </button>
            </div>
          </div>
        </div>

        <div className="text-center">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onGoCustomerPortal();
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Quay về trang tra cứu khách hàng
          </a>
        </div>
      </div>
    </div>
  );
};
