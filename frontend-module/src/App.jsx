import React, { useState } from 'react';
import TaxAccountManager from './components/TaxAccountManager';
import SyncControlPanel from './components/SyncControlPanel';
import InvoicePreview from './components/InvoicePreview';
import LeadMagnetBanner from './components/LeadMagnetBanner';
import {
  HelpCircle,
  Shield,
  Award,
  Sparkles,
  Download,
  CheckCircle,
  ExternalLink,
  Lock,
  Building2
} from 'lucide-react';

export default function App() {
  const [activeAccount, setActiveAccount] = useState(null);
  const [invoiceData, setInvoiceData] = useState(null);
  const [syncMeta, setSyncMeta] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showExtensionGuide, setShowExtensionGuide] = useState(false);

  const handleSyncCompleted = (data, meta) => {
    setInvoiceData(data);
    setSyncMeta(meta);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 font-sans flex flex-col">
      {/* Top Header / Navbar (Giữ nguyên nhận diện thương hiệu LTP Soft) */}
      <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand Name */}
          <div className="flex items-center gap-3">
            <a href="https://ltp-soft.com" target="_blank" rel="noreferrer" className="flex items-center gap-2.5">
              <img
                src="/logo.png"
                alt="LTP Soft"
                className="h-9 w-auto max-w-[120px] object-contain drop-shadow"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div className="pl-2.5 border-l border-slate-700">
                <span className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                  LTP <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400">TAX SYNC</span>
                </span>
                <p className="text-[9px] text-slate-400 font-mono tracking-wider">EXECUTIVE TAX UTILITY</p>
              </div>
            </a>
            <span className="hidden sm:inline-flex items-center gap-1 ml-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Miễn Phí 100%
            </span>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowExtensionGuide(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 px-3 py-1.5 rounded-xl border border-slate-700 transition"
            >
              <HelpCircle className="w-4 h-4 text-blue-400" />
              <span>Hướng Dẫn Cài Extension</span>
            </button>
            <a
              href="https://ltp-soft.com"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 rounded-xl shadow-sm transition"
            >
              <span>LTP Attendance</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Cam Kết Bảo Mật Tinh Gọn (Bank-Grade Privacy Strip) */}
      <div className="bg-slate-900 border-b border-slate-800 text-slate-300 text-xs py-2 px-4 sm:px-6 shadow-inner">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold text-slate-200">
              Cam kết bảo mật 100% Cục Bộ (Client-Side Sandbox):
            </span>
            <span className="text-slate-400">
              Mật khẩu thuế & hóa đơn lưu trực tiếp trên máy tính của bạn. Extension kết nối thẳng tới cổng <code className="text-emerald-400 bg-slate-800 px-1 py-0.5 rounded font-mono">hoadondientu.gdt.gov.vn</code> — tuyệt đối không lưu trên Cloud.
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-emerald-400 font-medium shrink-0">
            <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Không Lưu Password</span>
            <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Zero-Cloud Storage</span>
          </div>
        </div>
      </div>

      {/* Main Workspace (Trang thực thi công việc văn phòng nền trắng) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex-1 w-full space-y-5">
        {/* Khối quản lý MST Doanh Nghiệp */}
        <TaxAccountManager
          activeAccount={activeAccount}
          onSelectAccount={setActiveAccount}
        />

        {/* Khối điều khiển kỳ tra cứu & đồng bộ */}
        <SyncControlPanel
          activeAccount={activeAccount}
          onSyncCompleted={handleSyncCompleted}
          isSyncing={isSyncing}
          setIsSyncing={setIsSyncing}
        />

        {/* Bảng xem trước hóa đơn & Nút xuất Excel */}
        <InvoicePreview
          invoiceData={invoiceData}
          syncMeta={syncMeta}
        />

        {/* Mini Banner Tiếp Thị LTP Attendance (Gọn gàng, không choán chỗ) */}
        <LeadMagnetBanner />
      </main>

      {/* Modal Hướng Dẫn Cài Đặt Chrome Extension */}
      {showExtensionGuide && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 text-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Download className="w-5 h-5 text-blue-600" />
                Hướng Dẫn Cài Đặt Extension (Chỉ mất 1 phút)
              </h3>
              <button
                onClick={() => setShowExtensionGuide(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-blue-900 font-medium">
                💡 <strong>Tại sao cần Extension?</strong> Tiện ích chạy trực tiếp từ IP máy tính của bạn để gọi Cổng Thuế Tổng Cục Thuế (<code className="text-blue-700 font-mono">hoadondientu.gdt.gov.vn</code>), giúp không bị nghẽn mạng và bảo mật tuyệt đối không lộ mật khẩu.
              </div>

              <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <p className="font-bold text-slate-800 mb-0.5">Mở trang Quản lý tiện ích Chrome</p>
                  <p className="text-slate-600">Truy cập vào: <code className="bg-white px-2 py-0.5 rounded border border-slate-300 text-blue-600 font-mono">chrome://extensions</code></p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <p className="font-bold text-slate-800 mb-0.5">Bật "Chế độ cho nhà phát triển" (Developer mode)</p>
                  <p className="text-slate-600">Gạt công tắc ở góc trên bên phải màn hình sang trạng thái BẬT.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <p className="font-bold text-slate-800 mb-0.5">Tải thư mục Extension</p>
                  <p className="text-slate-600">Bấm nút <strong>"Tải tiện ích đã giải nén" (Load unpacked)</strong> ở góc trái, sau đó chọn thư mục <code className="bg-white px-2 py-0.5 rounded border border-slate-300 font-mono text-blue-600">extension</code>.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                  4
                </div>
                <div>
                  <p className="font-bold text-slate-800 mb-0.5">Hoàn tất & F5 lại trang Web</p>
                  <p className="text-slate-600">Sau khi cài xong, hệ thống sẽ hiện biểu tượng màu xanh <strong>"Chrome Extension: Đã Kết Nối"</strong>.</p>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowExtensionGuide(false)}
                className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition"
              >
                Đã Hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Nhẹ Nhàng Chuẩn Văn Phòng */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            © 2026 LTP TAX SYNC • Phát triển bởi Công ty TNHH TMDV Lê Tài Phát (LTP Soft)
          </p>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Giải pháp Chấm công 4.0: <a href="https://ltp-soft.com" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-bold">ltp-soft.com</a></span>
          </div>
        </div>
      </footer>
    </div>
  );
}
