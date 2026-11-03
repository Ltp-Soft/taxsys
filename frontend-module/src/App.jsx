import React, { useState, useEffect } from 'react';
import TaxAccountManager from './components/TaxAccountManager';
import SyncControlPanel from './components/SyncControlPanel';
import InvoicePreview from './components/InvoicePreview';
import LeadMagnetBanner from './components/LeadMagnetBanner';
import {
  Shield,
  ShieldCheck,
  CheckCircle,
  ExternalLink,
  Download,
  Sparkles
} from 'lucide-react';

export const CHROME_STORE_URL = 'https://chromewebstore.google.com/detail/ltp-taxsync-t%E1%BA%A3i-t%E1%BB%95ng-h%E1%BB%A3p/iapkfljbplgogeifmpfkgagnfkcgnmed?authuser=0&hl=en&pli=1';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[TaxSync ErrorBoundary]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl m-6 text-center max-w-xl mx-auto">
          <h2 className="text-base font-bold text-red-800 mb-2">Đã xảy ra sự cố hiển thị</h2>
          <p className="text-xs text-red-600 mb-4">{this.state.error?.message || 'Lỗi render dữ liệu'}</p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
          >
            Tải Lại Giao Diện
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [activeAccount, setActiveAccount] = useState(null);
  const [invoiceData, setInvoiceData] = useState(null);
  const [syncMeta, setSyncMeta] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState('checking');

  useEffect(() => {
    let timeoutId;
    const handleMsg = (event) => {
      if (event.data?.type === 'TAX_EXTENSION_READY' || event.data?.type === 'TAX_EXTENSION_PONG') {
        setExtensionStatus('connected');
        clearTimeout(timeoutId);
      }
    };
    window.addEventListener('message', handleMsg);
    window.postMessage({ type: 'TAX_EXTENSION_PING', requestId: 'ping_app' }, '*');
    timeoutId = setTimeout(() => {
      setExtensionStatus((prev) => (prev === 'connected' ? 'connected' : 'missing'));
    }, 1500);

    return () => {
      window.removeEventListener('message', handleMsg);
      clearTimeout(timeoutId);
    };
  }, []);

  const handleSelectAccount = (acc) => {
    setActiveAccount(acc);
    // Nếu chuyển sang công ty khác thì dọn sạch dữ liệu xem trước của công ty trước
    if (activeAccount && acc && activeAccount.mst !== acc.mst) {
      setInvoiceData(null);
      setSyncMeta(null);
    }
  };

  const handleSyncCompleted = (data, meta) => {
    setInvoiceData(data);
    setSyncMeta(meta);
  };

  return (
    <ErrorBoundary>
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
            <a
              href="https://ltp-soft.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 rounded-xl shadow-sm transition"
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

      {/* Main Workspace (Trang thực thi công việc văn phòng) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex-1 w-full space-y-5">
        {/* Khối Cài Đặt Extension & Giải Thích Bảo Mật Chuẩn Google Chrome */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-slate-700/60 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
            <div className="space-y-2.5 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Được Google Chrome Kiểm Duyệt & Xác Minh An Toàn
                </span>
                <span className="inline-flex items-center gap-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-medium px-2.5 py-0.5 rounded-full">
                  <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
                  Nhà Phát Triển: LTP-soft.com
                </span>
              </div>

              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>💡 Tại sao cần Extension?</span>
              </h2>

              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                Tiện ích chạy trực tiếp từ <strong>IP máy tính của bạn</strong> để gọi Cổng Thuế Tổng Cục Thuế (<code className="text-amber-300 bg-slate-800/80 px-1.5 py-0.5 rounded font-mono text-xs">hoadondientu.gdt.gov.vn</code>), giúp không bị nghẽn mạng và bảo mật tuyệt đối không lộ mật khẩu.
              </p>

              <p className="text-xs text-slate-300 leading-relaxed">
                Nhà phát triển <strong>LTP-soft.com</strong> được Google Chrome xác minh là <strong>không lưu mật khẩu và hóa đơn</strong> phía máy chủ. Toàn bộ dữ liệu nhạy cảm được xử lý và lưu trữ hoàn toàn trên máy tính của bạn. Giao diện web chỉ đóng vai trò hiển thị số liệu và xuất file báo cáo Excel chuẩn kế toán.
              </p>
            </div>

            <div className="shrink-0 w-full lg:w-auto flex flex-col items-stretch lg:items-end gap-2.5">
              <a
                href={CHROME_STORE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg hover:shadow-emerald-500/25 transition transform active:scale-95 text-center"
              >
                <span>Cài Đặt Tại Cửa Hàng Google Chrome</span>
                <ExternalLink className="w-3.5 h-3.5 text-emerald-100" />
              </a>

              <div className="text-[11px] text-center lg:text-right">
                {extensionStatus === 'connected' ? (
                  <span className="text-emerald-400 font-bold inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                    <CheckCircle className="w-3.5 h-3.5" /> Tiện ích đã sẵn sàng trên trình duyệt
                  </span>
                ) : (
                  <span className="text-slate-400">
                    Miễn phí 100% • 1-Click Thêm vào Chrome
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Khối quản lý MST Doanh Nghiệp */}
        <TaxAccountManager
          activeAccount={activeAccount}
          onSelectAccount={handleSelectAccount}
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
  </ErrorBoundary>
);
}
