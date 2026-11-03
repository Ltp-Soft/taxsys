import React, { useState, useEffect } from 'react';
import { Building2, Plus, Trash2, Key, CheckCircle, ShieldCheck, Eye, EyeOff, Lock, Edit2, AlertCircle } from 'lucide-react';

const STORAGE_KEY = 'tax_sync_saved_accounts';

// Tính khoảng cách ký tự (Levenshtein) để phát hiện đánh máy nhầm 1 số
function getLevenshteinDistance(a, b) {
  const s1 = String(a || '').trim();
  const s2 = String(b || '').trim();
  const dp = Array(s1.length + 1).fill(null).map(() => Array(s2.length + 1).fill(null));
  for (let i = 0; i <= s1.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= s2.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= s1.length; i += 1) {
    for (let j = 1; j <= s2.length; j += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + indicator
      );
    }
  }
  return dp[s1.length][s2.length];
}

export default function TaxAccountManager({ onSelectAccount, activeAccount }) {
  const [accounts, setAccounts] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [mst, setMst] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Modal Chỉnh Sửa Tài Khoản (Đổi mật khẩu / Khóa MST chống lạm dụng)
  const [editingAccount, setEditingAccount] = useState(null);
  const [editMst, setEditMst] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editShowPassword, setEditShowPassword] = useState(false);
  const [allowTypoFix, setAllowTypoFix] = useState(false);
  const [editError, setEditError] = useState('');

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

  const handleStartEdit = (acc, e) => {
    e.stopPropagation();
    setEditingAccount(acc);
    setEditMst(acc.mst);
    setEditCompanyName(acc.companyName || '');
    setEditPassword(acc.password || '');
    setEditShowPassword(false);
    setAllowTypoFix(false);
    setEditError('');
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingAccount) return;
    setEditError('');

    const trimmedMst = editMst.trim();
    const trimmedPass = editPassword.trim();
    const trimmedName = editCompanyName.trim();

    if (!trimmedMst || !trimmedPass) {
      setEditError('Mã số thuế và Mật khẩu không được để trống.');
      return;
    }

    // Kiểm tra Levenshtein distance nếu người dùng thay đổi MST (Smart Typo Guard)
    if (trimmedMst !== editingAccount.mst) {
      const dist = getLevenshteinDistance(editingAccount.mst, trimmedMst);
      if (dist > 1) {
        setEditError('⛔ Không thể đổi sang MST của công ty khác! Gói bản quyền định danh cố định tối đa 02 MST. Bạn chỉ được phép điều chỉnh tối đa 1 ký tự nếu gõ nhầm một số khi nhập liệu.');
        return;
      }
      // Bắn sự kiện đồng bộ cập nhật MST đã sửa sang Chrome Extension để không bị tính trùng hạn mức
      if (typeof window !== 'undefined') {
        window.postMessage({
          type: 'TAX_EXTENSION_UPDATE_MST',
          payload: { oldMst: editingAccount.mst, newMst: trimmedMst }
        }, '*');
      }
    }

    const updatedAcc = {
      ...editingAccount,
      mst: trimmedMst,
      companyName: trimmedName || `Công ty MST ${trimmedMst}`,
      password: trimmedPass
    };

    const updatedList = accounts.map(a => a.id === editingAccount.id ? updatedAcc : a);
    saveAccounts(updatedList);
    if (activeAccount?.id === editingAccount.id) {
      onSelectAccount(updatedAcc);
    }
    setEditingAccount(null);
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

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => handleStartEdit(acc, e)}
                    className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition"
                    title="Chỉnh sửa Mật khẩu / Sửa lỗi gõ nhầm MST"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteAccount(acc.id, e)}
                    className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition"
                    title="Xóa MST này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
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

      {/* Modal Chỉnh Sửa Doanh Nghiệp (Cập nhật mật khẩu / Khóa MST chống lạm dụng) */}
      {editingAccount && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-800 border border-slate-100">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-600" />
                Cập Nhật Mật Khẩu & Thông Tin Doanh Nghiệp
              </h3>
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700 leading-relaxed">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Trường Mã Số Thuế (Mặc định KHÓA để chống lạm dụng MST) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Mã Số Thuế (Định danh bản quyền)</span>
                  </label>
                  {!allowTypoFix ? (
                    <button
                      type="button"
                      onClick={() => setAllowTypoFix(true)}
                      className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Gõ nhầm 1 số?</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                      Cho phép sửa tối đa 1 số gõ nhầm
                    </span>
                  )}
                </div>

                <input
                  type="text"
                  required
                  value={editMst}
                  readOnly={!allowTypoFix}
                  onChange={(e) => setEditMst(e.target.value)}
                  className={`w-full text-xs px-3.5 py-2.5 rounded-xl font-mono transition ${
                    allowTypoFix
                      ? 'bg-amber-50/50 border-2 border-amber-400 text-slate-900 focus:outline-none'
                      : 'bg-slate-100 border border-slate-300 text-slate-600 cursor-not-allowed'
                  }`}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  {allowTypoFix
                    ? '⚠️ Cơ chế bảo vệ: Chỉ cho phép điều chỉnh 1 số nếu gõ nhầm khi nhập liệu. Không thể đổi sang MST của công ty khác.'
                    : '🔒 Mã số thuế được cố định theo hạn mức 02 công ty miễn phí để chống gian lận.'}
                </p>
              </div>

              {/* Trường Mật khẩu thuế (Cho phép sửa thoải mái nếu trước đó gõ sai) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mật khẩu trang Hóa Đơn Điện Tử <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={editShowPassword ? 'text' : 'password'}
                    required
                    placeholder="Nhập lại mật khẩu đúng..."
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setEditShowPassword(!editShowPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {editShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-emerald-700 mt-1 font-medium">
                  ✓ Bạn có thể cập nhật lại mật khẩu bất cứ lúc nào nếu đăng nhập bị báo sai mật khẩu.
                </p>
              </div>

              {/* Trường Tên công ty */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên Doanh Nghiệp (Hiển thị trên bảng kê Excel)
                </label>
                <input
                  type="text"
                  placeholder="VD: Công ty TNHH TMDV..."
                  value={editCompanyName}
                  onChange={(e) => setEditCompanyName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition"
                >
                  Lưu Cập Nhật
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
