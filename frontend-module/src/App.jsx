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
  Phone,
  FileSpreadsheet,
  Cpu,
  Lock,
  ChevronRight,
  Zap,
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
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white font-sans">
      {/* Top Header / Navbar (Chuẩn phong cách ltp-soft.com) */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Brand Name */}
          <div className="flex items-center gap-3.5">
            <a href="https://ltp-soft.com" target="_blank" rel="noreferrer" className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="LTP Soft"
                className="h-10 w-auto max-w-[130px] object-contain drop-shadow"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div className="pl-3 border-l border-slate-800">
                <span className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                  LTP <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400">TAX SYNC</span>
                </span>
                <p className="text-[10px] text-slate-400 font-mono tracking-wider">SMART SAAS PLATFORM</p>
              </div>
            </a>
            <span className="hidden sm:inline-flex items-center gap-1 ml-2 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Miễn Phí 100%
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs sm:text-sm font-semibold text-slate-300">
            <button
              onClick={() => setShowExtensionGuide(true)}
              className="flex items-center gap-1.5 text-slate-300 hover:text-white transition py-1"
            >
              <HelpCircle className="w-4 h-4 text-blue-400" />
              <span>Cài Extension</span>
            </button>
            <a
              href="https://ltp-soft.com#pricing"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition"
            >
              Bảng Giá Chấm Công
            </a>
            <a
              href="https://ltp-soft.com/affiliate"
              target="_blank"
              rel="noreferrer"
              className="text-amber-400 hover:text-amber-300 font-bold transition flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" /> Đối Tác KOL
            </a>
          </nav>

          {/* CTA Button */}
          <div className="flex items-center gap-3">
            <a
              href="https://ltp-soft.com"
              target="_blank"
              rel="noreferrer"
              className="px-4 sm:px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-xl shadow-lg shadow-blue-600/30 text-xs sm:text-sm transition flex items-center gap-2"
            >
              <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
              <span>Nền Tảng LTP Soft</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-10 overflow-hidden">
        {/* Ambient Glowing Orbs with Smooth Hardware Floating (Giống trang chủ ltp-soft.com) */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-blue-600/20 via-indigo-600/15 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-gradient-to-br from-cyan-500/15 via-blue-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 backdrop-blur border border-slate-800 text-xs text-blue-400 font-semibold mb-6 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Tiện ích tự động hóa thuế dành riêng cho Doanh Nghiệp & Kế Toán</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white max-w-5xl mx-auto leading-tight sm:leading-none">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-blue-200">
              Hệ Thống Tải & Tổng Hợp{' '}
            </span>
            <span className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 via-indigo-400 to-amber-300">
              Hóa Đơn Thuế AI
            </span>
          </h1>

          <p className="mt-4 text-base sm:text-lg font-bold text-slate-300 max-w-3xl mx-auto">
            Giải phóng 90% thời gian tra cứu từng tờ hóa đơn điện tử từ Tổng Cục Thuế
          </p>

          <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-3xl mx-auto font-normal leading-relaxed">
            Tự động gom toàn bộ hóa đơn Mua Vào & Bán Ra trong Quý về file <strong className="text-emerald-400">Excel 2 Sheet</strong> chuẩn mực kế toán kiểm toán • AI Gemini tự động giải Captcha • Kết nối trực tiếp IP máy khách, <strong className="text-white">bảo mật cục bộ 100%</strong>.
          </p>

          {/* 4 Feature Badges (Kiểu 5 thẻ card trang chủ ltp-soft.com) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 max-w-4xl mx-auto mt-8 text-left">
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 shadow-lg backdrop-blur-md">
              <span className="text-lg">🎁</span>
              <p className="text-xs font-black text-white mt-1">0đ Bản Quyền</p>
              <p className="text-[11px] text-slate-400">Tặng miễn phí cho Doanh Nghiệp & Kế toán</p>
            </div>

            <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 shadow-lg backdrop-blur-md">
              <span className="text-lg">🤖</span>
              <p className="text-xs font-black text-white mt-1">AI Giải Captcha</p>
              <p className="text-[11px] text-slate-400">Tự động vượt mã xác thực Tổng Cục Thuế</p>
            </div>

            <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 shadow-lg backdrop-blur-md">
              <span className="text-lg">🔒</span>
              <p className="text-xs font-black text-white mt-1">100% Cục Bộ</p>
              <p className="text-[11px] text-slate-400">Không lưu mật khẩu hay hóa đơn lên Cloud</p>
            </div>

            <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 shadow-lg backdrop-blur-md">
              <span className="text-lg">📊</span>
              <p className="text-xs font-black text-white mt-1">Excel 2 Sheet Chuẩn</p>
              <p className="text-[11px] text-slate-400">Kèm công thức =SUM() và =SUMIF() kiểm toán</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Container Work Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-6 relative z-10">
        {/* Banner Mồi Bán Máy Chấm Công & Chấm Công Thông Minh LTP */}
        <LeadMagnetBanner />

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
      </main>

      {/* Modal Hướng Dẫn Cài Đặt Chrome Extension */}
      {showExtensionGuide && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full p-6 sm:p-7 text-slate-100 max-h-[90vh] overflow-y-auto animate-scaleUp">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Download className="w-5 h-5 text-blue-400" />
                Hướng Dẫn Cài Đặt Chrome Extension (Chỉ mất 1 phút)
              </h3>
              <button
                onClick={() => setShowExtensionGuide(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="bg-blue-950/40 border border-blue-800/50 rounded-2xl p-4 text-blue-200">
                <strong>Tại sao cần Extension?</strong> Tiện ích chạy trực tiếp từ IP máy tính của bạn để gọi Cổng Thuế Tổng Cục Thuế (<code className="text-cyan-300">hoadondientu.gdt.gov.vn</code>), giúp không bị nghẽn mạng và bảo mật tuyệt đối không lộ mật khẩu ra ngoài.
              </div>

              <div className="flex items-start gap-3 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <p className="font-bold text-white mb-0.5">Mở trang Tiện ích trên trình duyệt Chrome</p>
                  <p className="text-slate-400">Truy cập vào địa chỉ: <code className="bg-slate-800 px-2 py-0.5 rounded text-cyan-400 font-mono">chrome://extensions</code></p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <p className="font-bold text-white mb-0.5">Bật "Chế độ cho nhà phát triển" (Developer mode)</p>
                  <p className="text-slate-400">Gạt công tắc ở góc trên bên phải màn hình sang trạng thái BẬT.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <p className="font-bold text-white mb-0.5">Tải thư mục Extension</p>
                  <p className="text-slate-400">Bấm nút <strong>"Tải tiện ích đã giải nén" (Load unpacked)</strong> ở góc trái, sau đó chọn thư mục <code className="bg-slate-800 px-2 py-0.5 rounded font-mono text-cyan-400">extension</code> trong bộ công cụ này.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0">
                  4
                </div>
                <div>
                  <p className="font-bold text-white mb-0.5">Hoàn tất & F5 lại trang Web này</p>
                  <p className="text-slate-400">Sau khi cài đặt xong, bạn sẽ thấy biểu tượng huy hiệu màu xanh <strong>"Chrome Extension: Đã Kết Nối"</strong>.</p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowExtensionGuide(false)}
                className="px-6 py-2.5 text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl shadow-lg transition"
              >
                Đã Hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer (Đồng bộ thương hiệu ltp-soft.com) */}
      <footer className="bg-slate-950 border-t border-slate-800/80 py-8 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="text-center md:text-left">
            <p className="font-bold text-slate-200">
              © 2026 LTP TAX SYNC • Phát triển & Bảo trợ bởi Công ty TNHH TMDV Lê Tài Phát (LTP Soft)
            </p>
            <p className="mt-1 text-slate-500">
              Hệ sinh thái Quản trị & Chấm công Thông minh không cần máy chấm công: <a href="https://ltp-soft.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline font-bold">ltp-soft.com</a>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <Shield className="w-4 h-4" /> Bảo Mật 100% Client-Side
            </span>
            <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
              <Award className="w-4 h-4" /> AI Gemini 2.5 Flash
            </span>
            <a href="https://ltp-soft.com" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white transition flex items-center gap-1">
              <span>LTP Attendance</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
