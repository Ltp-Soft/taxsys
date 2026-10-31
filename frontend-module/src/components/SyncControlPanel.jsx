import React, { useState, useEffect } from 'react';
import { Play, Calendar, AlertTriangle, CheckCircle2, RefreshCw, Cpu, Key, HelpCircle, FileCheck } from 'lucide-react';

export default function SyncControlPanel({ activeAccount, onSyncCompleted, isSyncing, setIsSyncing }) {
  // Chế độ chọn: 'quarter' (Theo Quý), 'month' (Theo Tháng), 'custom' (Khoảng ngày)
  const [syncPeriodType, setSyncPeriodType] = useState('quarter');
  const [quarter, setQuarter] = useState('4');
  const [month, setMonth] = useState('10');
  const [year, setYear] = useState('2025');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [strictPeriod, setStrictPeriod] = useState(true); // Bộ lọc thông minh GMT+7 & loại trừ sai kỳ
  const [includePos, setIncludePos] = useState(true); // Mặc định BẬT để quét vét cạn 100% không bỏ sót HĐ Mua vào từ máy tính tiền
  const [backendUrl, setBackendUrl] = useState('http://localhost:3001');

  // Quản lý Modal nâng cấp bản quyền khi vượt quá 1 MST
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeErrorMsg, setUpgradeErrorMsg] = useState('');

  // Quản lý Modal nhập Captcha tay khi offline/chưa bật AI
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [captchaCkey, setCaptchaCkey] = useState('');
  const [manualCode, setManualCode] = useState('');

  const [extensionStatus, setExtensionStatus] = useState('checking');
  const [progress, setProgress] = useState({
    percent: 0,
    stage: 'IDLE',
    step: 'Sẵn sàng tải dữ liệu',
    purchaseCount: 0,
    soldCount: 0
  });

  useEffect(() => {
    let timeoutId;

    const handleMessage = (event) => {
      if (event.data?.type === 'TAX_EXTENSION_READY' || event.data?.type === 'TAX_EXTENSION_PONG') {
        setExtensionStatus('connected');
        clearTimeout(timeoutId);
      }

      if (event.data?.type === 'TAX_EXTENSION_PROGRESS') {
        const d = event.data.data;
        setProgress({
          percent: d.percent || 0,
          stage: d.stage || 'PROCESSING',
          step: d.step || 'Đang xử lý...',
          purchaseCount: d.purchase_count || 0,
          soldCount: d.sold_count || 0
        });

        if (d.stage === 'NEED_MANUAL_CAPTCHA') {
          setCaptchaSvg(d.captcha_svg || '');
          setCaptchaCkey(d.ckey || '');
          setShowCaptchaModal(true);
        }
      }

      if (event.data?.type === 'TAX_EXTENSION_SYNC_RESULT') {
        const res = event.data.response;
        if (res && res.need_manual_captcha) {
          setCaptchaSvg(res.captcha_svg || '');
          setCaptchaCkey(res.ckey || '');
          setShowCaptchaModal(true);
          return;
        }

        setIsSyncing(false);
        if (res && res.success) {
          const currentPeriodLabel = syncPeriodType === 'month'
            ? `Tháng ${month}/${year}`
            : (syncPeriodType === 'quarter' ? `Quý ${quarter}/${year}` : `${fromDate} đến ${toDate}`);

          onSyncCompleted(res.data, {
            mst: activeAccount?.mst,
            quarter: syncPeriodType === 'quarter' ? quarter : null,
            month: syncPeriodType === 'month' ? month : null,
            year: year,
            periodLabel: currentPeriodLabel,
            companyName: activeAccount?.companyName,
            summary: res.summary
          });
        } else {
          const err = res?.error || 'Lỗi không xác định';
          if (err.includes('LIMIT_EXCEEDED')) {
            setUpgradeErrorMsg(err.replace('LIMIT_EXCEEDED: ', ''));
            setShowUpgradeModal(true);
          } else {
            alert(`Đồng bộ thất bại: ${err}`);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);

    window.postMessage({ type: 'TAX_EXTENSION_PING', requestId: 'ping_init' }, '*');
    timeoutId = setTimeout(() => {
      if (extensionStatus !== 'connected') {
        setExtensionStatus('missing');
      }
    }, 1500);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeoutId);
    };
  }, [activeAccount, syncPeriodType, quarter, month, year, fromDate, toDate]);

  const handleStartSync = (manualCodeVal = null, manualCkeyVal = null) => {
    if (!activeAccount) {
      alert('Vui lòng chọn hoặc thêm một Mã Số Thuế Doanh Nghiệp trước khi đồng bộ.');
      return;
    }

    if (extensionStatus !== 'connected') {
      alert('Chưa phát hiện Chrome Extension! Vui lòng mở chrome://extensions, bật Developer mode và bấm Tải lại Extension.');
      return;
    }

    setIsSyncing(true);
    setProgress({
      percent: 2,
      stage: 'STARTING',
      step: manualCodeVal ? 'Đang gửi mã Captcha xác thực...' : 'Đang kết nối Cổng Thuế Điện Tử...',
      purchaseCount: 0,
      soldCount: 0
    });

    const payload = {
      username: activeAccount.mst,
      password: activeAccount.password,
      quarter: syncPeriodType === 'quarter' ? quarter : null,
      month: syncPeriodType === 'month' ? month : null,
      year: year,
      from_date: syncPeriodType === 'custom' ? fromDate : null,
      to_date: syncPeriodType === 'custom' ? toDate : null,
      strict_period: strictPeriod,
      include_pos: includePos,
      backend_url: backendUrl,
      license_key: 'free-lead-magnet',
      manual_captcha: manualCodeVal,
      manual_ckey: manualCkeyVal
    };

    window.postMessage({
      type: 'TAX_EXTENSION_START_SYNC',
      requestId: Date.now().toString(),
      payload: payload
    }, '*');
  };

  const submitManualCaptcha = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    setShowCaptchaModal(false);
    handleStartSync(manualCode.trim(), captchaCkey);
    setManualCode('');
  };

  // Nạp dữ liệu mẫu để TEST OFFLINE nhanh không cần đăng nhập thật
  const handleLoadMockData = () => {
    const mockPurchase = [
      {
        id: '1',
        loai_hoa_don: 'HĐ Điện tử',
        ky_hieu_mau_so: '1',
        ky_hieu_hoa_don: 'C26TAA',
        so_hoa_don: '00000125',
        ngay_lap: '15/01/2026',
        mst_nguoi_ban: '0102345678',
        ten_nguoi_ban: 'CÔNG TY TNHH VẬT TƯ THIẾT BỊ HÀ NỘI',
        dia_chi_nguoi_ban: 'Số 12 Phố Huế, Hoàn Kiếm, Hà Nội',
        tong_tien_chua_thue: 12500000,
        tong_tien_thue: 1250000,
        tong_tien_chiet_khau: 0,
        tong_tien_thanh_toan: 13750000,
        don_vi_tien_te: 'VND',
        ty_gia: 1,
        trang_thai_nhan: 'Hóa đơn mới',
        is_valid_for_tax: true
      },
      {
        id: '2',
        loai_hoa_don: 'HĐ Máy tính tiền',
        ky_hieu_mau_so: '1',
        ky_hieu_hoa_don: 'M26TBB',
        so_hoa_don: '00000892',
        ngay_lap: '02/02/2026',
        mst_nguoi_ban: '0315678910',
        ten_nguoi_ban: 'CHUỖI CỬA HÀNG TIỆN LỢI & VĂN PHÒNG PHẨM SAO MAI',
        dia_chi_nguoi_ban: '45 Nguyễn Thị Minh Khai, Q.1, TP.HCM',
        tong_tien_chua_thue: 3450000,
        tong_tien_thue: 276000,
        tong_tien_chiet_khau: 50000,
        tong_tien_thanh_toan: 3676000,
        don_vi_tien_te: 'VND',
        ty_gia: 1,
        trang_thai_nhan: 'Hóa đơn mới',
        is_valid_for_tax: true
      },
      {
        id: '3',
        loai_hoa_don: 'HĐ Điện tử',
        ky_hieu_mau_so: '1',
        ky_hieu_hoa_don: 'C26TCC',
        so_hoa_don: '00000045',
        ngay_lap: '10/02/2026',
        mst_nguoi_ban: '0400123987',
        ten_nguoi_ban: 'CÔNG TY CP THƯƠNG MẠI DỊCH VỤ ĐÀ NẴNG',
        dia_chi_nguoi_ban: '108 Lê Duẩn, Hải Châu, Đà Nẵng',
        tong_tien_chua_thue: 8900000,
        tong_tien_thue: 890000,
        tong_tien_chiet_khau: 0,
        tong_tien_thanh_toan: 9790000,
        don_vi_tien_te: 'VND',
        ty_gia: 1,
        trang_thai_nhan: 'Hóa đơn đã bị hủy',
        is_valid_for_tax: false // Hóa đơn bị hủy, test xem nền vàng và loại trừ
      }
    ];

    const mockSold = [
      {
        id: '101',
        loai_hoa_don: 'HĐ Điện tử',
        ky_hieu_mau_so: '1',
        ky_hieu_hoa_don: 'C26LTP',
        so_hoa_don: '00000012',
        ngay_lap: '20/01/2026',
        mst_nguoi_mua: '0317654107',
        ten_nguoi_mua: 'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ LÊ TÀI PHÁT',
        dia_chi_nguoi_mua: 'TP. Hồ Chí Minh',
        tong_tien_chua_thue: 25000000,
        tong_tien_thue: 2500000,
        tong_tien_chiet_khau: 0,
        tong_tien_thanh_toan: 27500000,
        don_vi_tien_te: 'VND',
        ty_gia: 1,
        trang_thai_nhan: 'Hóa đơn mới',
        is_valid_for_tax: true
      },
      {
        id: '102',
        loai_hoa_don: 'HĐ Máy tính tiền',
        ky_hieu_mau_so: '1',
        ky_hieu_hoa_don: 'M26POS',
        so_hoa_don: '00000543',
        ngay_lap: '14/03/2026',
        mst_nguoi_mua: '0108999888',
        ten_nguoi_mua: 'CÔNG TY TNHH XÂY DỰNG MINH PHÁT',
        dia_chi_nguoi_mua: 'Quận Cầu Giấy, Hà Nội',
        tong_tien_chua_thue: 18000000,
        tong_tien_thue: 1440000,
        tong_tien_chiet_khau: 0,
        tong_tien_thanh_toan: 19440000,
        don_vi_tien_te: 'VND',
        ty_gia: 1,
        trang_thai_nhan: 'Hóa đơn mới',
        is_valid_for_tax: true
      }
    ];

    onSyncCompleted({
      purchase: mockPurchase,
      sold: mockSold
    }, {
      mst: activeAccount?.mst || '0110582230',
      quarter: quarter,
      year: year,
      companyName: activeAccount?.companyName || 'Công ty Test Offline',
      summary: {
        mst: activeAccount?.mst || '0110582230',
        quarter: quarter,
        year: year,
        count_purchase: 3,
        count_sold: 2,
        valid_count_purchase: 2,
        valid_count_sold: 2
      }
    });
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 sm:p-7 shadow-2xl mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800 pb-5 mb-6">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-blue-600" />
            Cấu Hình Kỳ Tra Cứu & Đồng Bộ Hóa Đơn
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Kết nối trực tiếp Cổng Thuế Điện Tử (hoadondientu.gdt.gov.vn) qua IP máy khách.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Nút test dữ liệu mẫu Offline */}
          <button
            onClick={handleLoadMockData}
            type="button"
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-3.5 py-2 rounded-xl border border-indigo-500/30 transition"
            title="Xem ngay giao diện và xuất file Excel với dữ liệu mẫu không cần đăng nhập"
          >
            <FileCheck className="w-4 h-4 text-indigo-600" />
            <span>Nạp Dữ Liệu Mẫu (Test Offline)</span>
          </button>

          {/* Trạng thái kết nối Extension */}
          {extensionStatus === 'connected' ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/15 px-3 py-1.5 rounded-full border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Chrome Extension: Đã Kết Nối</span>
            </div>
          ) : extensionStatus === 'checking' ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
              <span>Đang kiểm tra Extension...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-500/15 px-3 py-1.5 rounded-full border border-amber-500/30">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Chưa nhận Extension (Vào chrome://extensions tải lại)</span>
            </div>
          )}
        </div>
      </div>

      {/* Bộ chọn chế độ: Theo Quý / Theo Tháng / Khoảng Ngày */}
      <div className="flex items-center gap-2 mb-4 p-1 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 w-fit mb-5">
        <button
          type="button"
          onClick={() => setSyncPeriodType('quarter')}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${
            syncPeriodType === 'quarter'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Theo Quý (Kê Khai)
        </button>
        <button
          type="button"
          onClick={() => setSyncPeriodType('month')}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${
            syncPeriodType === 'month'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Theo Tháng (Đối Soát Nhanh)
        </button>
        <button
          type="button"
          onClick={() => setSyncPeriodType('custom')}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${
            syncPeriodType === 'custom'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Tùy Chọn Khoảng Ngày
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">Doanh Nghiệp Đang Chọn</label>
          <div className="text-sm font-bold text-white font-mono bg-slate-950 px-4 py-3 rounded-xl border border-slate-800 truncate">
            {activeAccount ? `${activeAccount.mst} - ${activeAccount.companyName}` : '⚠️ Chưa chọn MST'}
          </div>
        </div>

        {/* Chế độ Theo Quý */}
        {syncPeriodType === 'quarter' && (
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Chọn Quý Kê Khai</label>
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              disabled={isSyncing}
              className="w-full text-sm font-medium px-3 py-2 border border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 bg-slate-950 text-white text-xs px-4 py-3"
            >
              <option value="1">Quý 1 (Tháng 1 - Tháng 3)</option>
              <option value="2">Quý 2 (Tháng 4 - Tháng 6)</option>
              <option value="3">Quý 3 (Tháng 7 - Tháng 9)</option>
              <option value="4">Quý 4 (Tháng 10 - Tháng 12)</option>
            </select>
          </div>
        )}

        {/* Chế độ Theo Tháng */}
        {syncPeriodType === 'month' && (
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Chọn Tháng Đối Soát</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              disabled={isSyncing}
              className="w-full text-sm font-medium px-3 py-2 border border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 bg-slate-950 text-white text-xs px-4 py-3"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
          </div>
        )}

        {/* Chế độ Khoảng Ngày */}
        {syncPeriodType === 'custom' && (
          <div className="col-span-2 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Từ Ngày (dd/mm/yyyy)</label>
              <input
                type="text"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                placeholder="01/10/2025"
                disabled={isSyncing}
                className="w-full text-sm px-3 py-2 border border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 bg-slate-950 text-white text-xs px-4 py-3"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Đến Ngày (dd/mm/yyyy)</label>
              <input
                type="text"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                placeholder="31/10/2025"
                disabled={isSyncing}
                className="w-full text-sm px-3 py-2 border border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 bg-slate-950 text-white text-xs px-4 py-3"
              />
            </div>
          </div>
        )}

        {syncPeriodType !== 'custom' && (
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Năm Kê Khai</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              disabled={isSyncing}
              min="2020"
              max="2030"
              className="w-full text-sm font-medium px-3 py-2 border border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 bg-slate-950 text-white text-xs px-4 py-3"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">Backend Server AI</label>
          <input
            type="text"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            disabled={isSyncing}
            placeholder="http://localhost:3001"
            className="w-full text-sm px-3 py-2 border border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 bg-slate-950 text-white text-xs px-4 py-3"
          />
        </div>
      </div>

      {/* Tùy chọn Logic thông minh Smart Date & Máy tính tiền */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 mb-6 space-y-4">
        <div className="flex items-start gap-3">
          <input
            id="strictPeriodToggle"
            type="checkbox"
            checked={strictPeriod}
            onChange={(e) => setStrictPeriod(e.target.checked)}
            className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
          />
          <label htmlFor="strictPeriodToggle" className="cursor-pointer">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
              🛡️ Bộ Lọc Thông Minh Smart Date (Múi giờ Việt Nam GMT+7 & Loại trừ hóa đơn sai kỳ)
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">Khuyên Dùng</span>
            </span>
            <p className="text-[11px] text-slate-400 mt-1">
              Tự động bù trừ chênh lệch múi giờ UTC của Cục Thuế (giải quyết triệt để lỗi ngày 30/09 hiển thị trong Quý 4), đồng thời bảo vệ số liệu kê khai chính xác cho kế toán.
            </p>
          </label>
        </div>

        <div className="flex items-start gap-3 pt-2.5 border-t border-slate-800/80 pt-3.5">
          <input
            id="includePosToggle"
            type="checkbox"
            checked={includePos}
            onChange={(e) => setIncludePos(e.target.checked)}
            className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
          />
          <label htmlFor="includePosToggle" className="cursor-pointer">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
              🏪 Quét Toàn Diện Hóa Đơn Từ Máy Tính Tiền (POS)
              <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">Không Bỏ Sót HĐ Mua Vào</span>
            </span>
            <p className="text-[11px] text-slate-400 mt-1">
              Đảm bảo thu thập trọn vẹn 100% các hóa đơn Mua Vào (như chi phí ăn uống, công tác, xăng dầu, khách sạn, siêu thị... của nhân viên). Hệ thống tự động dùng Gemini AI giải Captcha riêng cho luồng này để tránh bị Cục Thuế chặn.
            </p>
          </label>
        </div>
      </div>

      {isSyncing && (
        <div className="bg-slate-950 border border-blue-500/40 rounded-2xl p-5 mb-6 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-800 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-600 animate-spin" />
              {progress.step}
            </span>
            <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
              {progress.percent}%
            </span>
          </div>
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300 ease-out"
              style={{ width: `${progress.percent}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Tiến trình tự động hóa giải Captcha & phân trang</span>
            <span>
              Đã thu thập: <strong>{progress.purchaseCount}</strong> Mua vào | <strong>{progress.soldCount}</strong> Bán ra
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => handleStartSync()}
          disabled={isSyncing || !activeAccount}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold text-white shadow-md transition ${
            isSyncing || !activeAccount
              ? 'bg-slate-300 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 hover:from-blue-500 hover:to-cyan-400 shadow-xl shadow-blue-600/30 px-8 py-3.5 rounded-2xl text-sm font-black'
          }`}
        >
          {isSyncing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Đang Quét Hóa Đơn Tự Động...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              Tải & Đồng Bộ {syncPeriodType === 'month' ? `Tháng ${month}/${year}` : (syncPeriodType === 'quarter' ? `Quý ${quarter}/${year}` : 'Theo Khoảng Ngày')}
            </>
          )}
        </button>
      </div>

      {/* Modal Nhập Captcha Thủ Công (Khi test offline hoặc chưa có AI) */}
      {showCaptchaModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-slate-800">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-600" /> Xác Thực Mã Captcha
              </h3>
              <button
                onClick={() => { setShowCaptchaModal(false); setIsSyncing(false); }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              Mã bảo vệ từ Cổng Thuế Tổng Cục Thuế. Vui lòng nhập các ký tự nhìn thấy bên dưới:
            </p>

            {/* Hiển thị SVG Captcha */}
            {captchaSvg && (
              <div
                className="bg-amber-50/50 border border-amber-200 rounded-lg p-2 mb-3 flex items-center justify-center overflow-hidden"
                dangerouslySetInnerHTML={{ __html: captchaSvg }}
              />
            )}

            <form onSubmit={submitManualCaptcha} className="space-y-3">
              <div>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={8}
                  placeholder="Nhập mã Captcha vào đây"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  className="w-full text-center text-lg font-mono font-bold tracking-widest px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCaptchaModal(false); setIsSyncing(false); }}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition"
                >
                  Xác Nhận & Tiếp Tục
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nâng Cấp Bản Quyền / Giới Hạn 1 MST */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 text-slate-100">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-2 text-2xl font-bold">
                👑
              </div>
              <h3 className="text-base font-black text-white">
                Mở Khóa Tra Cứu Không Giới Hạn Mã Số Thuế
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {upgradeErrorMsg || 'Phiên bản miễn phí hỗ trợ tối đa 01 Mã số thuế Doanh nghiệp.'}
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 mb-5 text-slate-300">
              <h4 className="text-xs font-black text-cyan-400 uppercase tracking-wider mb-2">
                Đặc Quyền Gói Pro / Khách Hàng LTP Attendance:
              </h4>
              <ul className="text-xs text-slate-700 space-y-1.5 font-medium">
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span> Không giới hạn số lượng công ty & MST
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span> Tự động giải Captcha bằng Google Gemini AI Pro
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span> Tặng kèm khi đăng ký Máy Chấm Công LTP Attendance
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <a
                href="https://ltp-soft.com"
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold rounded-lg shadow-md transition"
              >
                <span>Đăng Ký LTP Attendance (Dùng Thử 60 Ngày Miễn Phí)</span>
              </a>
              <a
                href="https://zalo.me/0969851396"
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg transition"
              >
                <span>Hỗ Trợ Nâng Cấp Bản Pro (Zalo: 0969.851.396)</span>
              </a>
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="w-full py-2 text-xs font-medium text-slate-400 hover:text-slate-600 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
