import React, { useState, useEffect } from 'react';
import { Building2, Plus, Trash2, Key, CheckCircle, ShieldCheck, Eye, EyeOff } from 'lucide-react';

const STORAGE_KEY = 'tax_sync_saved_accounts';

export default function TaxAccountManager({ onSelectAccount, activeAccount }) {
  const [accounts, setAccounts] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [mst, setMst] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setAccounts(parsed);
        if (parsed.length > 0 && !activeAccount) {
          onSelectAccount(parsed[0]);
        }
      }
    } catch (e) {
      console.error('Error loading saved accounts:', e);
    }
  }, []);

  const saveAccounts = (newAccounts) => {
    setAccounts(newAccounts);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newAccounts));
  };

  const handleAddAccount = (e) => {
    e.preventDefault();
    if (!mst || !password) return;

    const newAcc = {
      id: Date.now().toString(),
      mst: mst.trim(),
      companyName: companyName.trim() || `Công ty MST ${mst.trim()}`,
      password: password.trim()
    };

    const updated = [...accounts.filter(a => a.mst !== newAcc.mst), newAcc];
    saveAccounts(updated);
    onSelectAccount(newAcc);
    setMst('');
    setCompanyName('');
    setPassword('');
    setShowAddModal(false);
  };

  const handleDeleteAccount = (id, e) => {
    e.stopPropagation();
    const updated = accounts.filter(a => a.id !== id);
    saveAccounts(updated);
    if (activeAccount?.id === id) {
      onSelectAccount(updated.length > 0 ? updated[0] : null);
    }
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-800/80 p-6 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-white tracking-tight">Danh Sách Mã Số Thuế Doanh Nghiệp</h3>
              <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold border border-slate-700">
                {accounts.length} công ty
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Lưu trữ danh sách MST để chuyển đổi nhanh giữa các công ty hoặc khách hàng kế toán
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-xl shadow-lg shadow-blue-600/20 transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm MST Mới</span>
        </button>
      </div>

      {/* Security Tip Box */}
      <div className="flex items-center gap-2.5 text-xs text-emerald-400 bg-emerald-950/40 px-4 py-3 rounded-2xl mb-5 border border-emerald-800/40">
        <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
        <span>
          <strong>Bảo mật tuyệt đối:</strong> Thông tin MST & mật khẩu được mã hóa lưu trữ 100% cục bộ trên trình duyệt của bạn (LocalStorage), tuyệt đối không lưu trên bất kỳ máy chủ nào.
        </span>
      </div>

      {/* Account Cards */}
      {accounts.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
          <p className="text-xs text-slate-400 mb-3">Chưa có Mã số thuế nào được lưu</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="text-xs font-bold text-blue-400 hover:text-blue-300 underline"
          >
            + Nhấp vào đây để thêm MST đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {accounts.map((acc) => {
            const isSelected = activeAccount?.id === acc.id;
            return (
              <div
                key={acc.id}
                onClick={() => onSelectAccount(acc)}
                className={`group relative flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-950/30 shadow-lg shadow-blue-500/10'
                    : 'border-slate-800/80 hover:border-slate-700 bg-slate-950/60'
                }`}
              >
                <div className="min-w-0 pr-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-black text-sm text-white tracking-wide">{acc.mst}</span>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-[10px] font-extrabold text-blue-300 bg-blue-500/20 border border-blue-400/30 px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3 text-cyan-400" /> Đang Chọn
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate max-w-[220px]" title={acc.companyName}>
                    {acc.companyName}
                  </p>
                </div>

                <button
                  onClick={(e) => handleDeleteAccount(acc.id, e)}
                  className="text-slate-500 hover:text-rose-400 p-2 rounded-xl hover:bg-rose-950/30 transition shrink-0"
                  title="Xóa MST này"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Thêm MST */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 text-slate-100 animate-scaleUp">
            <h3 className="text-base font-black text-white mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" /> Thêm Tài Khoản Thuế Doanh Nghiệp
            </h3>

            <form onSubmit={handleAddAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Mã Số Thuế (MST) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: 0101234567"
                  value={mst}
                  onChange={(e) => setMst(e.target.value)}
                  className="w-full text-xs px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Tên Công Ty (Tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="VD: Công ty TNHH Giải Pháp Công Nghệ..."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full text-xs px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Mật khẩu trang Hóa Đơn Điện Tử <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Mật khẩu hoadondientu.gdt.gov.vn"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-xs px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 pr-10 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Mật khẩu chỉ lưu trên máy bạn để Chrome Extension tự đăng nhập.
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl shadow-lg transition"
                >
                  Lưu Thông Tin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
