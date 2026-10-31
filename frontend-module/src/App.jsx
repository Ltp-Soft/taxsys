import React, { useState } from 'react';
import TaxAccountManager from './components/TaxAccountManager';
import SyncControlPanel from './components/SyncControlPanel';
import InvoicePreview from './components/InvoicePreview';
import LeadMagnetBanner from './components/LeadMagnetBanner';
import { HelpCircle, Shield, Award, Sparkles, Download, CheckCircle, ExternalLink, Phone, ArrowUpRight } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-md shadow-blue-500/20">
              🧾
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-white text-base sm:text-lg tracking-tight">
                  LTP <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">TaxSync</span>
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Miễn Phí 100%
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Tiện ích tổng hợp hóa đơn thuế 2 Sheet Excel • Hệ sinh thái Doanh nghiệp LTP Soft
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowExtensionGuide(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 px-3 py-2 rounded-xl transition border border-slate-700"
            >
              <HelpCircle className="w-4 h-4 text-blue-400" />
              <span>Hướng Dẫn Cài Extension</span>
            </button>
            <a
              href="https://ltp-soft.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-3.5 py-2 rounded-xl shadow-md shadow-blue-600/30 transition"
            >
              <span>LTP Attendance</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* Banner Cam kết bảo mật chuẩn Ngân hàng / Doanh nghiệp */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-4 sm:p-5 text-white shadow-lg border border-slate-700/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Cam Kết Bảo Mật Tuyệt Đối (Bank-Grade Privacy)
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold px-2 py-0.5 rounded-full">
                    100% Cục Bộ
                  </span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  Mật khẩu và dữ liệu hóa đơn được lưu trữ <strong>cục bộ trong trình duyệt của bạn (Local Sandbox)</strong>. Chrome Extension kết nối trực tiếp từ máy tính của bạn tới Cổng Thuế Tổng Cục Thuế (<code className="text-emerald-300">hoadondientu.gdt.gov.vn</code>) — <strong>Tuyệt đối không lưu trữ, không gửi mật khẩu hay hóa đơn lên máy chủ trung gian</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-medium text-slate-300 shrink-0 border-t md:border-t-0 md:border-l border-slate-700 pt-3 md:pt-0 md:pl-5">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Không Thu Thập Mật Khẩu</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Zero-Cloud Storage</span>
              </div>
            </div>
          </div>
        </div>

        {/* Banner Mồi Bán Máy Chấm Công & Giải Pháp Chấm Công LTP */}
        <LeadMagnetBanner />

        {/* Khối quản lý MST */}
        <TaxAccountManager
          activeAccount={activeAccount}
          onSelectAccount={setActiveAccount}
        />

        {/* Khối điều khiển đồng bộ */}
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
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 text-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Download className="w-5 h-5 text-blue-600" />
                Hướng Dẫn Cài Đặt Chrome Extension (Chỉ mất 1 phút)
              </h3>
              <button
                onClick={() => setShowExtensionGuide(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-blue-800">
                <strong>Tại sao cần Extension?</strong> Tiện ích chạy trực tiếp từ IP máy tính của bạn để gọi cổng Thuế, giúp không bao giờ bị nghẽn mạng hay lộ mật khẩu lên máy chủ.
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="font-bold text-slate-800 mb-0.5">Mở trang Tiện ích trên trình duyệt Chrome</p>
                  <p>Truy cập vào địa chỉ: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-600 font-mono">chrome://extensions</code></p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="font-bold text-slate-800 mb-0.5">Bật "Chế độ cho nhà phát triển" (Developer mode)</p>
                  <p>Gạt công tắc ở góc trên bên phải màn hình sang trạng thái BẬT.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0">
                  3
                </div>
                <div>
                  <p className="font-bold text-slate-800 mb-0.5">Tải thư mục Extension</p>
                  <p>Bấm nút <strong>"Tải tiện ích đã giải nén" (Load unpacked)</strong> ở góc trái, sau đó chọn thư mục <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">extension</code> trong bộ công cụ này.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0">
                  4
                </div>
                <div>
                  <p className="font-bold text-slate-800 mb-0.5">Hoàn tất & F5 lại trang Web này</p>
                  <p>Sau khi cài đặt xong, bạn sẽ thấy biểu tượng huy hiệu màu xanh <strong>"Chrome Extension: Đã Kết Nối"</strong>.</p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowExtensionGuide(false)}
                className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                Đã Hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 mt-auto py-6 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <div>
            <p className="font-semibold text-slate-200">
              © 2026 LTP TaxSync • Phát triển & Vận hành bởi Công ty TNHH TMDV Lê Tài Phát (LTP Soft)
            </p>
            <p className="mt-0.5 text-slate-400">
              Hệ sinh thái Quản trị & Chấm công Thông minh không cần máy chấm công: <a href="https://ltp-soft.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline font-bold">ltp-soft.com</a>
            </p>
          </div>

          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <Shield className="w-4 h-4" /> Bảo Mật 100% Client-Side
            </span>
            <span className="flex items-center gap-1.5 text-blue-400 font-medium">
              <Award className="w-4 h-4" /> AI Gemini 2.5 Flash Powered
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
