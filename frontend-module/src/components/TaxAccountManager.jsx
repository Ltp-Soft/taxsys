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
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800">Danh Sách Mã Số Thuế Doanh Nghiệp</h3>
              <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                {accounts.length} công ty
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Chọn công ty để tải hóa đơn điện tử hoặc thêm công ty mới vào danh sách
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl shadow-xs transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm MST Mới</span>
        </button>
      </div>

      {/* Account Items */}
      {accounts.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <p className="text-xs text-slate-500 mb-2">Chưa có Mã số thuế nào được lưu</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="text-xs font-bold text-blue-600 hover:underline"
          >
            + Nhấp vào đây để thêm MST đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {accounts.map((acc) => {
            const isSelected = activeAccount?.id === acc.id;
            return (
              <div
                key={acc.id}
                onClick={() => onSelectAccount(acc)}
                className={`group relative flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="min-w-0 pr-3">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono font-bold text-xs text-slate-800">{acc.mst}</span>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                        <CheckCircle className="w-3 h-3" /> Đang chọn
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate max-w-[200px]" title={acc.companyName}>
                    {acc.companyName}
                  </p>
                </div>

                <button
                  onClick={(e) => handleDeleteAccount(acc.id, e)}
                  className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition shrink-0"
                  title="Xóa MST này"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Thêm MST */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-slate-800 border border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" /> Thêm Doanh Nghiệp Mới
            </h3>

            <form onSubmit={handleAddAccount} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mã Số Thuế (MST) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: 0101234567"
                  value={mst}
                  onChange={(e) => setMst(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên Công Ty (Tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="VD: Công ty TNHH ABC..."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mật khẩu trang Hóa Đơn Điện Tử <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Mật khẩu hoadondientu.gdt.gov.vn"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Mật khẩu lưu cục bộ trên máy tính của bạn, không gửi lên Server.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition"
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
