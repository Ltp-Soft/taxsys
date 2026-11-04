import React, { useState, useEffect, useRef } from 'react';
import { Play, Calendar, AlertTriangle, CheckCircle2, RefreshCw, Cpu, Key, HelpCircle, FileCheck, Activity, Trash2 } from 'lucide-react';
import { evaluateInvoiceValidity } from '../utils/excelExporter';

export default function SyncControlPanel({ activeAccount, onSyncCompleted, onClearPreviousResults, isSyncing, setIsSyncing }) {
  // Chế độ chọn: 'quarter' (Theo Quý), 'month' (Theo Tháng), 'custom' (Khoảng ngày)
  const [syncPeriodType, setSyncPeriodType] = useState('quarter');
  const [quarter, setQuarter] = useState('4');
  const [month, setMonth] = useState('10');
  const [year, setYear] = useState('2025');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [strictPeriod, setStrictPeriod] = useState(true); // Bộ lọc thông minh GMT+7 & loại trừ sai kỳ
  const [includePos, setIncludePos] = useState(true); // Mặc định BẬT để quét vét cạn 100% không bỏ sót HĐ Mua vào từ máy tính tiền
  const defaultBackend = (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
    ? window.location.origin
    : 'http://localhost:3001';
  const [backendUrl, setBackendUrl] = useState(defaultBackend);

  // Quản lý Modal nâng cấp bản quyền khi vượt quá 1 MST
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  // State Thanh toán tự động SePay VietQR cho Tool Thuế
  const [checkoutEmail, setCheckoutEmail] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [checkoutPlan, setCheckoutPlan] = useState('PRO_ANNUAL');
  const [checkoutOrder, setCheckoutOrder] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [manualLicenseInput, setManualLicenseInput] = useState('');
  const [manualLicenseMsg, setManualLicenseMsg] = useState(null);
  const [activeTabModal, setActiveTabModal] = useState('buy'); // 'buy' | 'manual'

  const [upgradeErrorMsg, setUpgradeErrorMsg] = useState('');

  // Quản lý Modal nhập Captcha tay khi AI thử 3 lần không khớp hoặc người dùng muốn tự nhập
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [captchaCkey, setCaptchaCkey] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [isRefreshingCaptcha, setIsRefreshingCaptcha] = useState(false);
  const [captchaModalNote, setCaptchaModalNote] = useState('');

  const [extensionStatus, setExtensionStatus] = useState('checking');
  const [progress, setProgress] = useState({
    percent: 0,
    stage: 'IDLE',
    step: 'Sẵn sàng tải dữ liệu',
    purchaseCount: 0,
    soldCount: 0
  });

  // Đo Ping trực tiếp tới Cổng Thuế (hoadondientu.gdt.gov.vn) & Quản lý xóa Cache khi chuyển MST
  const [gdtPingMs, setGdtPingMs] = useState(null);
  const [gdtPingStatus, setGdtPingStatus] = useState('idle'); // 'idle' | 'good' | 'medium' | 'slow'
  const [isMeasuringPing, setIsMeasuringPing] = useState(false);
  const [cacheFlushNotice, setCacheFlushNotice] = useState('');
  const [isFlushingCache, setIsFlushingCache] = useState(false);

  const lastSyncedMstRef = useRef(null);
  const prevSelectedMstRef = useRef(null);
  const activeRequestIdRef = useRef(null);
  const autoRetriedStaleCacheRef = useRef(false);

  const updatePingBadge = (ms) => {
    const val = Math.max(1, Math.round(Number(ms) || 0));
    setGdtPingMs(val);
    if (val < 380) setGdtPingStatus('good');
    else if (val <= 800) setGdtPingStatus('medium');
    else setGdtPingStatus('slow');
  };

  // Hàm đo độ trễ mạng thực tế tới Cổng Thuế (hoadondientu.gdt.gov.vn)
  const measureGdtPing = async () => {
    if (isMeasuringPing) return;
    setIsMeasuringPing(true);
    const startMs = Date.now();
    let resolved = false;
    const reqId = 'ping_gdt_' + startMs;

    const extPingListener = (ev) => {
      if (ev.data?.type === 'TAX_EXTENSION_PING_GDT_RESULT' && ev.data?.requestId === reqId) {
        resolved = true;
        window.removeEventListener('message', extPingListener);
        const pingVal = ev.data?.response?.ping_ms || (Date.now() - startMs);
        updatePingBadge(pingVal);
        setIsMeasuringPing(false);
      }
    };
    window.addEventListener('message', extPingListener);
    window.postMessage({ type: 'TAX_EXTENSION_PING_GDT', requestId: reqId }, '*');

    setTimeout(async () => {
      window.removeEventListener('message', extPingListener);
      if (!resolved) {
        const fbStart = Date.now();
        try {
          const effectiveBackend = (backendUrl === 'http://localhost:3001' && typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
            ? window.location.origin
            : backendUrl;
          const resp = await fetch(`${effectiveBackend.replace(/\/+$/, '')}/api/v1/solve-captcha?ping=1`, { cache: 'no-store' });
          const data = await resp.json();
          const finalPing = data?.ping_ms || (Date.now() - fbStart);
          updatePingBadge(finalPing);
        } catch {
          updatePingBadge(Date.now() - fbStart);
          setGdtPingStatus('slow');
        } finally {
          setIsMeasuringPing(false);
        }
      }
    }, 650);
  };

  useEffect(() => {
    measureGdtPing();
    const timer = setInterval(() => {
      measureGdtPing();
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Tự động kích hoạt thông báo chạy chữ xóa Cache khi người dùng chuyển từ MST 1 sang MST 2
  useEffect(() => {
    const currentMst = activeAccount?.mst || null;
    if (prevSelectedMstRef.current && currentMst && prevSelectedMstRef.current !== currentMst) {
      const oldMst = prevSelectedMstRef.current;
      setIsFlushingCache(true);
      setCacheFlushNotice(
        `🧹 Đang xóa sạch bộ nhớ đệm (Cache, Cookie & Phiên GDT) của MST [${oldMst}] và khởi tạo kênh kết nối độc lập cho MST [${currentMst}]... Đảm bảo số liệu kế toán chính xác tuyệt đối 100%.`
      );
      setCaptchaSvg('');
      setCaptchaCkey('');
      setManualCode('');
      autoRetriedStaleCacheRef.current = false;

      window.postMessage({
        type: 'TAX_EXTENSION_CLEAR_CACHE',
        requestId: 'flush_' + Date.now(),
        payload: { prevMst: oldMst, nextMst: currentMst }
      }, '*');

      const t = setTimeout(() => {
        setIsFlushingCache(false);
        setCacheFlushNotice(`✓ Đã làm sạch bộ nhớ đệm phiên trước. Kênh dữ liệu độc lập cho MST ${currentMst} đã sẵn sàng!`);
        setTimeout(() => setCacheFlushNotice(''), 3500);
      }, 1500);

      prevSelectedMstRef.current = currentMst;
      return () => clearTimeout(t);
    }
    prevSelectedMstRef.current = currentMst;
  }, [activeAccount?.mst]);

  // Nút chủ động Xóa Cache & Làm Mới Phiên
  const handleManualFlushCache = () => {
    setIsFlushingCache(true);
    onClearPreviousResults?.();
    setCaptchaSvg('');
    setCaptchaCkey('');
    setManualCode('');
    lastSyncedMstRef.current = null;
    autoRetriedStaleCacheRef.current = false;

    const targetLabel = activeAccount?.mst ? `MST ${activeAccount.mst}` : 'phiên hiện tại';
    setCacheFlushNotice(
      `🧹 Đang giải phóng toàn bộ Cache, Token phiên cũ và kiểm tra lại độ trễ Cổng Thuế cho ${targetLabel}...`
    );

    window.postMessage({
      type: 'TAX_EXTENSION_CLEAR_CACHE',
      requestId: 'manual_flush_' + Date.now()
    }, '*');
    measureGdtPing();

    setTimeout(() => {
      setIsFlushingCache(false);
      setCacheFlushNotice(`✓ Đã dọn sạch 100% Cache & làm mới kênh kết nối Cổng Thuế cho ${targetLabel}. Bạn có thể bấm Tải & Đồng Bộ ngay!`);
      setTimeout(() => setCacheFlushNotice(''), 4000);
    }, 1200);
  };

  // Kiểm tra độc lập MST & Chuẩn hóa cột "Kết quả kiểm tra hóa đơn" ngay khi nhận dữ liệu từ Extension
  const sanitizeAndVerifyInvoicesForMst = (rawData, targetMst) => {
    const cleanTarget = String(targetMst || '').replace(/[^0-9]/g, '');
    const baseTarget10 = cleanTarget.length >= 10 ? cleanTarget.substring(0, 10) : '';
    let foreignMstDropped = 0;

    const processList = (list, isPurchase) => {
      if (!Array.isArray(list)) return [];
      const result = [];
      for (const inv of list) {
        if (!inv) continue;
        // Kiểm tra chéo MST sở hữu để chống dính Cache từ MST trước (ngay cả khi dùng Extension bản cũ)
        if (baseTarget10) {
          const ownerMst = String(isPurchase ? (inv.mst_nguoi_mua || inv.raw_data?.nmmst || '') : (inv.mst_nguoi_ban || inv.raw_data?.nbmst || '')).replace(/[^0-9]/g, '');
          if (ownerMst.length >= 10 && !ownerMst.startsWith(baseTarget10)) {
            foreignMstDropped++;
            continue;
          }
        }
        const evalInfo = evaluateInvoiceValidity(inv);
        result.push({
          ...inv,
          ket_qua_kiem_tra: evalInfo.checkResultLabel,
          is_rejected_code: evalInfo.isRejectedCode,
          is_cancelled_or_replaced: evalInfo.isCancelledOrReplaced,
          is_valid_for_tax: evalInfo.isValid,
          ghi_chu_ke_khai: evalInfo.ghiChuKeKhai
        });
      }
      return result;
    };

    const cleanPurchase = processList(rawData?.purchase, true);
    const cleanSold = processList(rawData?.sold, false);

    return {
      purchase: cleanPurchase,
      sold: cleanSold,
      foreignMstDropped
    };
  };

  // Đồng bộ Telemetry & Kiểm tra quyền PRO từ Server Quản Trị (ltp-soft.com)
  const reportTaxTelemetry = async (eventType = 'PAGE_VIEW', customMst = null) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      let clientId = localStorage.getItem('ltp_tax_client_id');
      if (!clientId) {
        clientId = 'client_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
        localStorage.setItem('ltp_tax_client_id', clientId);
      }
      const savedKey = localStorage.getItem('ltp_tax_license_key') || '';
      const savedEmail = localStorage.getItem('ltp_tax_user_email') || '';
      let savedAccounts = [];
      try {
        savedAccounts = JSON.parse(localStorage.getItem('tax_sync_accounts_v1') || '[]');
      } catch {
        savedAccounts = [];
      }
      const mstList = savedAccounts.map(a => ({ mst: a.mst, name: a.companyName || '' }));

      const res = await fetch('https://ltp-soft.com/api/tax/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          email: savedEmail,
          license_key: savedKey,
          mst_list: mstList,
          current_mst: customMst || activeAccount?.mst || null,
          event_type: eventType
        })
      });
      const data = await res.json();
      if (data && data.is_pro && data.license_key) {
        localStorage.setItem('ltp_tax_license_key', data.license_key);
      }
    } catch (e) {
      // Bỏ qua lỗi mạng nếu offline
    }
  };

  useEffect(() => {
    reportTaxTelemetry('PAGE_VIEW');
  }, [activeAccount?.mst]);

  // Hàm lấy mã Captcha mới (ưu tiên qua Extension, tự động fallback qua API nếu khách dùng bản Extension cũ trên Store)
  const handleRefreshCaptcha = async (customNote = null) => {
    if (customNote !== null) setCaptchaModalNote(customNote);
    setIsRefreshingCaptcha(true);
    setManualCode('');

    let resolvedByExt = false;
    const reqId = 'cap_' + Date.now();

    const extListener = (ev) => {
      if (ev.data?.type === 'TAX_EXTENSION_GET_CAPTCHA_RESULT' && ev.data?.requestId === reqId) {
        const res = ev.data.response;
        if (res && res.success && res.data && (res.data.content || res.data.svg)) {
          resolvedByExt = true;
          setCaptchaSvg(res.data.content || res.data.svg || '');
          setCaptchaCkey(res.data.key || res.data.ckey || '');
          setIsRefreshingCaptcha(false);
        }
        window.removeEventListener('message', extListener);
      }
    };
    window.addEventListener('message', extListener);
    window.postMessage({ type: 'TAX_EXTENSION_GET_CAPTCHA', requestId: reqId }, '*');

    setTimeout(async () => {
      window.removeEventListener('message', extListener);
      if (!resolvedByExt) {
        try {
          const effectiveBackend = (backendUrl === 'http://localhost:3001' && typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
            ? window.location.origin
            : backendUrl;
          const resp = await fetch(`${effectiveBackend.replace(/\/+$/, '')}/api/v1/solve-captcha`);
          const data = await resp.json();
          if (data && data.success && data.content) {
            setCaptchaSvg(data.content);
            setCaptchaCkey(data.ckey || '');
          }
        } catch (err) {
          console.warn('[CaptchaFallback] Không lấy được captcha từ fallback API:', err);
        } finally {
          setIsRefreshingCaptcha(false);
        }
      }
    }, 650);
  };

  useEffect(() => {
    let timeoutId;

    const handleMessage = (event) => {
      if (event.data?.type === 'TAX_EXTENSION_READY' || event.data?.type === 'TAX_EXTENSION_PONG') {
        setExtensionStatus('connected');
        clearTimeout(timeoutId);
      }

      if (event.data?.type === 'TAX_EXTENSION_PROGRESS') {
        const d = event.data.data;
        if (d.ping_ms) {
          updatePingBadge(d.ping_ms);
        }
        setProgress({
          percent: d.percent || 0,
          stage: d.stage || 'PROCESSING',
          step: d.step || 'Đang xử lý...',
          purchaseCount: d.purchase_count || 0,
          soldCount: d.sold_count || 0
        });

        if (d.stage === 'NEED_MANUAL_CAPTCHA') {
          console.log('[Sync] AI failed 3 times or requested manual captcha. Opening modal for user.');
          const svgData = d.captcha_svg || '';
          const ckeyData = d.ckey || '';
          setCaptchaModalNote('⚠️ Mã bảo vệ lần này có độ nhiễu cao. Vui lòng nhìn ảnh bên dưới và nhập 6 ký tự để tiếp tục:');
          setIsSyncing(false);
          setShowCaptchaModal(true);
          if (svgData && ckeyData) {
            setCaptchaSvg(svgData);
            setCaptchaCkey(ckeyData);
          } else {
            handleRefreshCaptcha();
          }
        }
      }

      if (event.data?.type === 'TAX_EXTENSION_GET_CAPTCHA_RESULT') {
        setIsRefreshingCaptcha(false);
        const res = event.data.response;
        if (res?.ping_ms) {
          updatePingBadge(res.ping_ms);
        }
        if (res && res.success && res.data) {
          setCaptchaSvg(res.data.content || res.data.svg || '');
          setCaptchaCkey(res.data.key || res.data.ckey || '');
          setManualCode('');
        }
      }

      if (event.data?.type === 'TAX_EXTENSION_SYNC_RESULT') {
        // Bỏ qua nếu đây là phản hồi trễ của một phiên cũ đã bị hủy hoặc đổi MST
        if (activeRequestIdRef.current && event.data.requestId && event.data.requestId !== activeRequestIdRef.current) {
          console.warn('[SyncResult] Ignored stale sync result from old requestId:', event.data.requestId);
          return;
        }

        const res = event.data.response;
        if (res && res.need_manual_captcha) {
          console.log('[SyncResult] Received need_manual_captcha. Opening modal.');
          const svgData = res.captcha_svg || '';
          const ckeyData = res.ckey || '';
          setCaptchaModalNote('⚠️ AI đã thử tự động 3 lần chưa khớp. Vui lòng nhìn ảnh và nhập mã Captcha bên dưới:');
          setIsSyncing(false);
          setShowCaptchaModal(true);
          if (svgData && ckeyData) {
            setCaptchaSvg(svgData);
            setCaptchaCkey(ckeyData);
          } else {
            handleRefreshCaptcha();
          }
          return;
        }

        if (res && res.success) {
          const sanitized = sanitizeAndVerifyInvoicesForMst(res.data, activeAccount?.mst);
          const rawTotalCount = (res.data?.purchase?.length || 0) + (res.data?.sold?.length || 0);
          const cleanTotalCount = sanitized.purchase.length + sanitized.sold.length;

          // Nếu phát hiện trình duyệt trả về toàn bộ cache của MST trước (trên bản Extension cũ) -> tự động làm sạch và quét lại 1 lần
          if (rawTotalCount > 0 && cleanTotalCount === 0 && sanitized.foreignMstDropped > 0 && !autoRetriedStaleCacheRef.current) {
            console.warn('[CacheGuard] Phát hiện dữ liệu trả về thuộc MST trước do Cache trình duyệt. Đang tự động xóa Cache và tải lại...');
            autoRetriedStaleCacheRef.current = true;
            setProgress({
              percent: 8,
              stage: 'FLUSHING_CACHE',
              step: `🧹 Phát hiện bộ nhớ đệm từ MST trước — Đang tự động làm sạch Cache và tải lại dữ liệu chuẩn cho MST ${activeAccount?.mst}...`,
              purchaseCount: 0,
              soldCount: 0
            });
            setTimeout(() => {
              handleStartSync(null, null, true);
            }, 1400);
            return;
          }

          setIsSyncing(false);
          lastSyncedMstRef.current = activeAccount?.mst || null;
          if (res.summary?.last_ping_ms) {
            updatePingBadge(res.summary.last_ping_ms);
          }

          const currentPeriodLabel = syncPeriodType === 'month'
            ? `Tháng ${month}/${year}`
            : (syncPeriodType === 'quarter' ? `Quý ${quarter}/${year}` : `${fromDate} đến ${toDate}`);

          onSyncCompleted(
            {
              purchase: sanitized.purchase,
              sold: sanitized.sold
            },
            {
              mst: activeAccount?.mst,
              quarter: syncPeriodType === 'quarter' ? quarter : null,
              month: syncPeriodType === 'month' ? month : null,
              year: year,
              periodLabel: currentPeriodLabel,
              companyName: activeAccount?.companyName,
              summary: {
                ...res.summary,
                foreign_mst_dropped: sanitized.foreignMstDropped
              }
            }
          );
        } else {
          setIsSyncing(false);
          const err = res?.error || 'Lỗi không xác định';
          const errLower = err.toLowerCase();
          if (err.includes('LIMIT_EXCEEDED')) {
            setUpgradeErrorMsg(err.replace('LIMIT_EXCEEDED: ', ''));
            setShowUpgradeModal(true);
          } else if (errLower.includes('sai mật khẩu') || errLower.includes('mật khẩu không đúng') || errLower.includes('tài khoản không tồn tại') || errLower.includes('sai tên đăng nhập')) {
            alert(`Đăng nhập thất bại: ${err}`);
          } else if (
            err.includes('Xác thực thất bại sau') ||
            errLower.includes('captcha') ||
            errLower.includes('mã bảo vệ') ||
            errLower.includes('không nhận được token') ||
            errLower.includes('400') ||
            errLower.includes('401')
          ) {
            // Bắt mọi lỗi giải Captcha thất bại (kể cả trên bản Extension cũ từ Chrome Web Store) -> mở ngay bảng nhập Captcha tay!
            console.log('[SyncResult] Captcha failed after retries, opening manual captcha modal with fresh captcha.');
            setShowCaptchaModal(true);
            handleRefreshCaptcha('⚠️ Giải mã tự động chưa khớp hoặc mã vừa nhập bị sai. Hệ thống đã tải mã Captcha mới, vui lòng nhập 6 ký tự bên dưới:');
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

  const handleStartSync = async (manualCodeVal = null, manualCkeyVal = null, isInternalRetry = false) => {
    if (!activeAccount) {
      alert('Vui lòng chọn hoặc thêm một Mã Số Thuế Doanh Nghiệp trước khi đồng bộ.');
      return;
    }

    if (extensionStatus !== 'connected') {
      alert('Chưa phát hiện Chrome Extension! Vui lòng mở chrome://extensions, bật Developer mode và bấm Tải lại Extension.');
      return;
    }

    if (!isInternalRetry && !manualCodeVal) {
      autoRetriedStaleCacheRef.current = false;
    }

    // Dọn sạch bảng kết quả cũ trước khi tải phiên mới để tránh nhầm lẫn số liệu
    if (!manualCodeVal) {
      onClearPreviousResults?.();
    }

    setIsSyncing(true);

    // Nếu vừa tra cứu xong 1 MST trước đó (hoặc chuyển sang MST thứ 2), thực hiện bước Xóa Cache & Làm mượt phiên (1.3 giây)
    const isSwitchingOrRepeatSync = !manualCodeVal && (lastSyncedMstRef.current !== null || isFlushingCache);
    if (isSwitchingOrRepeatSync) {
      const prevMstText = lastSyncedMstRef.current && lastSyncedMstRef.current !== activeAccount.mst
        ? `của MST cũ (${lastSyncedMstRef.current})`
        : 'của phiên tra cứu trước';

      setProgress({
        percent: 2,
        stage: 'FLUSHING_CACHE',
        step: `🧹 Đang xóa bộ nhớ đệm (Cache & Session) ${prevMstText} để bảo vệ độ chính xác kế toán...`,
        purchaseCount: 0,
        soldCount: 0
      });

      window.postMessage({
        type: 'TAX_EXTENSION_CLEAR_CACHE',
        requestId: 'pre_sync_flush_' + Date.now(),
        payload: { prevMst: lastSyncedMstRef.current, nextMst: activeAccount.mst }
      }, '*');

      await new Promise((r) => setTimeout(r, 700));

      setProgress({
        percent: 5,
        stage: 'PREPARING_CHANNEL',
        step: `📡 Đang kiểm tra độ trễ Cổng Thuế (${gdtPingMs ? `${gdtPingMs}ms` : 'Ổn định'}) và thiết lập kênh kết nối độc lập cho MST ${activeAccount.mst}...`,
        purchaseCount: 0,
        soldCount: 0
      });

      await new Promise((r) => setTimeout(r, 650));
    } else {
      setProgress({
        percent: 3,
        stage: 'STARTING',
        step: manualCodeVal
          ? `Đang gửi mã Captcha xác thực cho MST ${activeAccount.mst}...`
          : `Đang khởi tạo kênh kết nối Cổng Thuế Điện Tử cho MST ${activeAccount.mst}...`,
        purchaseCount: 0,
        soldCount: 0
      });
    }

    const effectiveBackend = (backendUrl === 'http://localhost:3001' && typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
      ? window.location.origin
      : backendUrl;

    const savedLicenseKey = (typeof window !== 'undefined' && window.localStorage)
      ? (window.localStorage.getItem('ltp_tax_license_key') || 'free-lead-magnet')
      : 'free-lead-magnet';

    const reqId = 'sync_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    activeRequestIdRef.current = reqId;

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
      backend_url: effectiveBackend,
      license_key: savedLicenseKey,
      manual_captcha: manualCodeVal,
      manual_ckey: manualCkeyVal
    };

    window.postMessage({
      type: 'TAX_EXTENSION_START_SYNC',
      requestId: reqId,
      payload: payload
    }, '*');

    reportTaxTelemetry('SYNC_INVOICES', activeAccount.mst);
  };

  // Tạo đơn hàng VietQR tự động cho bản quyền PRO
  const handleCreatePaymentOrder = async (e) => {
    e.preventDefault();
    if (!checkoutEmail.trim() || !checkoutEmail.includes('@')) {
      alert('Vui lòng nhập địa chỉ Email hợp lệ để nhận mã bản quyền.');
      return;
    }
    setCheckoutLoading(true);
    try {
      const res = await fetch('https://ltp-soft.com/api/tax/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: checkoutEmail.trim(),
          phone: checkoutPhone.trim(),
          plan_type: checkoutPlan
        })
      });
      const data = await res.json();
      if (data && data.success && data.order) {
        setCheckoutOrder(data.order);
      } else {
        alert(data?.error || 'Không thể khởi tạo đơn hàng. Vui lòng thử lại.');
      }
    } catch (err) {
      alert('Lỗi kết nối máy chủ thanh toán: ' + err.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Tự động kiểm tra trạng thái thanh toán SePay mỗi 3 giây khi đang hiển thị QR
  useEffect(() => {
    if (!checkoutOrder || checkoutSuccess) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`https://ltp-soft.com/api/tax/check-payment?order_id=${encodeURIComponent(checkoutOrder.id)}`);
        const data = await res.json();
        if (data && data.paid && data.license_key) {
          localStorage.setItem('ltp_tax_license_key', data.license_key);
          setCheckoutSuccess(true);
          clearInterval(timer);
        }
      } catch (e) {}
    }, 3000);
    return () => clearInterval(timer);
  }, [checkoutOrder, checkoutSuccess]);

  // Kích hoạt hoặc khôi phục bằng mã License Key hoặc Email đã mua
  const handleActivateManualKey = async (e) => {
    e.preventDefault();
    const keyInput = manualLicenseInput.trim();
    if (!keyInput) return;
    setManualLicenseMsg(null);
    try {
      const clientId = localStorage.getItem('ltp_tax_client_id') || '';
      let savedAccounts = [];
      try {
        savedAccounts = JSON.parse(localStorage.getItem('tax_sync_accounts_v1') || '[]');
      } catch {}
      const mstList = savedAccounts.map(a => ({ mst: a.mst, name: a.companyName || '' }));

      let res;
      let data;
      try {
        res = await fetch('https://ltp-soft.com/api/tax/verify-license', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            license_key: keyInput,
            client_id: clientId,
            mst_list: mstList
          })
        });
        data = await res.json();
      } catch (networkErr) {
        // Fallback gọi qua proxy cùng tên miền tax.ltp-soft.com nếu trình duyệt chặn cross-domain
        res = await fetch('/api/v1/verify-license', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            license_key: keyInput,
            client_id: clientId,
            mst_list: mstList
          })
        });
        data = await res.json();
      }
      if (data && data.valid) {
        const finalKey = data.license_key || keyInput.toUpperCase();
        localStorage.setItem('ltp_tax_license_key', finalKey);
        if (data.email || keyInput.includes('@')) {
          localStorage.setItem('ltp_tax_user_email', (data.email || keyInput).trim().toLowerCase());
        }
        setManualLicenseMsg({ type: 'SUCCESS', text: `✓ ${data.message || 'Kích hoạt bản quyền PRO thành công'}! Bạn có thể đóng bảng này và bấm Tải & Đồng Bộ ngay.` });
      } else {
        setManualLicenseMsg({ type: 'ERROR', text: data?.error || 'Mã bản quyền hoặc Email không hợp lệ / chưa được kích hoạt.' });
      }
    } catch (err) {
      setManualLicenseMsg({ type: 'ERROR', text: 'Không thể kiểm tra mã bản quyền: ' + err.message });
    }
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
      },
      {
        id: '4',
        loai_hoa_don: 'HĐ Điện tử',
        ky_hieu_mau_so: '1',
        ky_hieu_hoa_don: 'C26TDD',
        so_hoa_don: '00003412',
        ngay_lap: '24/02/2026',
        mst_nguoi_ban: '0101234888',
        ten_nguoi_ban: 'TẬP ĐOÀN CÔNG NGHỆ VÀ VIỄN THÔNG HẠ TẦNG SỐ',
        dia_chi_nguoi_ban: 'Tòa nhà FPT, Phố Duy Tân, Cầu Giấy, Hà Nội',
        tong_tien_chua_thue: 45000000,
        tong_tien_thue: 4500000,
        tong_tien_chiet_khau: 0,
        tong_tien_thanh_toan: 49500000,
        don_vi_tien_te: 'VND',
        ty_gia: 1,
        trang_thai_nhan: 'Hóa đơn mới',
        is_valid_for_tax: true // Hóa đơn >= 20 triệu (bắt buộc chuyển khoản ngân hàng)
      },
      {
        id: '5',
        loai_hoa_don: 'HĐ Điện tử',
        ky_hieu_mau_so: '1',
        ky_hieu_hoa_don: 'C26TEE',
        so_hoa_don: '00001099',
        ngay_lap: '05/03/2026',
        mst_nguoi_ban: '0309988771',
        ten_nguoi_ban: 'CÔNG TY CP QUẢN LÝ BẤT ĐỘNG SẢN & TÒA NHÀ SÀI GÒN',
        dia_chi_nguoi_ban: '5B Tôn Đức Thắng, Phường Bến Nghé, Quận 1, TP.HCM',
        tong_tien_chua_thue: 28000000,
        tong_tien_thue: 2800000,
        tong_tien_chiet_khau: 0,
        tong_tien_thanh_toan: 30800000,
        don_vi_tien_te: 'VND',
        ty_gia: 1,
        trang_thai_nhan: 'Hóa đơn mới',
        ket_qua_kiem_tra: 'Đã cấp mã hóa đơn',
        is_valid_for_tax: true // Hóa đơn >= 20 triệu
      },
      {
        id: '6',
        loai_hoa_don: 'HĐ Điện tử',
        ky_hieu_mau_so: '1',
        ky_hieu_hoa_don: 'C26ERR',
        so_hoa_don: '00004019',
        ngay_lap: '18/03/2026',
        mst_nguoi_ban: '0314455667',
        ten_nguoi_ban: 'CÔNG TY TNHH CUNG ỨNG VẬT TƯ KỸ THUẬT NAM VIỆT',
        dia_chi_nguoi_ban: 'Quận Tân Bình, TP.HCM',
        tong_tien_chua_thue: 15000000,
        tong_tien_thue: 1500000,
        tong_tien_chiet_khau: 0,
        tong_tien_thanh_toan: 16500000,
        don_vi_tien_te: 'VND',
        ty_gia: 1,
        trang_thai_nhan: 'Hóa đơn mới',
        ket_qua_kiem_tra: 'Hóa đơn không đủ điều kiện cấp mã',
        is_rejected_code: true,
        is_valid_for_tax: false
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
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100 pb-4 mb-4">
        <div>
          <h2 className="text-base font-bold text-sm font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Cấu Hình Kỳ Tra Cứu & Đồng Bộ Hóa Đơn
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Kết nối trực tiếp Cổng Thuế Điện Tử (hoadondientu.gdt.gov.vn) qua IP máy khách.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Đồng hồ đo Ping trực tiếp tới Cổng Thuế (hoadondientu.gdt.gov.vn) */}
          <button
            type="button"
            onClick={measureGdtPing}
            disabled={isMeasuringPing}
            title="Nhấn để đo lại độ trễ (Ping) trực tiếp tới máy chủ Tổng Cục Thuế (hoadondientu.gdt.gov.vn)"
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border transition cursor-pointer ${
              gdtPingStatus === 'good'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : gdtPingStatus === 'medium'
                ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                : gdtPingStatus === 'slow'
                ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <Activity className={`w-3.5 h-3.5 ${isMeasuringPing ? 'animate-spin' : ''}`} />
            {isMeasuringPing ? (
              <span>Đang đo Ping Thuế...</span>
            ) : gdtPingMs !== null ? (
              <span>
                Ping Cổng Thuế: <strong>{gdtPingMs} ms</strong>{' '}
                {gdtPingStatus === 'good'
                  ? '(Mạng Tốt)'
                  : gdtPingStatus === 'medium'
                  ? '(Trung Bình)'
                  : '(Mạng Chậm - Đã Bật Bảo Vệ)'}
              </span>
            ) : (
              <span>Đo Ping Cổng Thuế</span>
            )}
          </button>

          {/* Trạng thái kết nối Extension */}
          {extensionStatus === 'connected' ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Chrome Extension: Đã Kết Nối</span>
            </div>
          ) : extensionStatus === 'checking' ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
              <span>Đang kiểm tra Extension...</span>
            </div>
          ) : (
            <a
              href="https://chromewebstore.google.com/detail/ltp-taxsync-t%E1%BA%A3i-t%E1%BB%95ng-h%E1%BB%A3p/iapkfljbplgogeifmpfkgagnfkcgnmed"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1 rounded-full border border-amber-300 transition shadow-xs"
              title="Nhấn để mở trang tiện ích trên Chrome Web Store và bấm Thêm vào Chrome"
            >
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Chưa nhận Extension 👉 Bấm Cài 1-Click trên Web Store</span>
            </a>
          )}
        </div>
      </div>

      {/* Thanh thông báo chạy chữ mượt mà khi Xóa Cache / Chuyển đổi giữa các MST */}
      {cacheFlushNotice && (
        <div
          className={`mb-4 px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 transition-all ${
            isFlushingCache
              ? 'bg-indigo-50 border-indigo-200 text-indigo-900 animate-pulse'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {isFlushingCache ? (
              <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span className="truncate">{cacheFlushNotice}</span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-white/80 border border-current/20 shrink-0">
            Zero-Cache Isolation
          </span>
        </div>
      )}

      {/* Cảnh báo thông minh khi mạng yếu / Cổng Thuế phản hồi chậm */}
      {gdtPingStatus === 'slow' && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Chế Độ Chống Thiếu Dữ Liệu Khi Mạng Yếu (Ping {gdtPingMs}ms):</strong>{' '}
            Máy chủ Tổng Cục Thuế đang phản hồi chậm. Hệ thống đã tự động kích hoạt chế độ{' '}
            <strong>Auto-Retry (thử lại tối đa 4 lần/trang)</strong> và <strong>đối soát tổng số hóa đơn</strong> để đảm bảo kế toán không bị thiếu sót bất kỳ hóa đơn nào.
          </div>
        </div>
      )}

      {/* Bộ chọn chế độ: Theo Quý / Theo Tháng / Khoảng Ngày */}
      <div className="flex items-center gap-2 mb-4 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setSyncPeriodType('quarter')}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${
            syncPeriodType === 'quarter'
              ? 'bg-white text-blue-700 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 font-medium'
          }`}
        >
          Theo Quý (Kê Khai)
        </button>
        <button
          type="button"
          onClick={() => setSyncPeriodType('month')}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${
            syncPeriodType === 'month'
              ? 'bg-white text-blue-700 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 font-medium'
          }`}
        >
          Theo Tháng (Đối Soát Nhanh)
        </button>
        <button
          type="button"
          onClick={() => setSyncPeriodType('custom')}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${
            syncPeriodType === 'custom'
              ? 'bg-white text-blue-700 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 font-medium'
          }`}
        >
          Tùy Chọn Khoảng Ngày
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Doanh Nghiệp Đang Chọn</label>
          <div className="text-xs font-bold text-slate-800 bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200 truncate">
            {activeAccount ? `${activeAccount.mst} - ${activeAccount.companyName}` : '⚠️ Chưa chọn MST'}
          </div>
        </div>

        {/* Chế độ Theo Quý */}
        {syncPeriodType === 'quarter' && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Chọn Quý Kê Khai</label>
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              disabled={isSyncing}
              className="w-full text-xs font-medium px-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 bg-white text-slate-800"
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
            <label className="block text-xs font-bold text-slate-700 mb-1">Chọn Tháng Đối Soát</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              disabled={isSyncing}
              className="w-full text-xs font-medium px-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 bg-white text-slate-800"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
          </div>
        )}

        {/* Chế độ Khoảng Ngày */}
        {syncPeriodType === 'custom' && (
          <div className="sm:col-span-2 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Từ Ngày (dd/mm/yyyy)</label>
              <input
                type="text"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                placeholder="01/10/2025"
                disabled={isSyncing}
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 bg-white text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Đến Ngày (dd/mm/yyyy)</label>
              <input
                type="text"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                placeholder="31/10/2025"
                disabled={isSyncing}
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 bg-white text-slate-800"
              />
            </div>
          </div>
        )}

        {syncPeriodType !== 'custom' && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Năm Kê Khai</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              disabled={isSyncing}
              min="2020"
              max="2030"
              className="w-full text-xs font-medium px-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 bg-white text-slate-800"
            />
          </div>
        )}
      </div>

      {isSyncing && (
        <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-800 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-600 animate-spin" />
              {progress.step}
            </span>
            <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
              {progress.percent}%
            </span>
          </div>
          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden mb-2">
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleManualFlushCache}
          disabled={isSyncing || isFlushingCache}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 transition cursor-pointer disabled:opacity-50"
          title="Xóa sạch bộ nhớ đệm (Cache & Session) của MST trước để chuẩn bị tra cứu MST tiếp theo chính xác tuyệt đối"
        >
          <Trash2 className="w-3.5 h-3.5 text-indigo-600" />
          <span>🧹 Làm Sạch Cache Phiên</span>
        </button>

        <button
          onClick={() => handleStartSync()}
          disabled={isSyncing || !activeAccount}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition ${
            isSyncing || !activeAccount
              ? 'bg-slate-300 cursor-not-allowed shadow-none'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer'
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

      {/* Modal Nhập Captcha Thủ Công (Tự động bật khi AI thử 3 lần chưa khớp hoặc khách chủ động mở) */}
      {showCaptchaModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-800 border border-slate-100">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-600" /> Xác Thực Mã Bảo Vệ (Captcha) Cổng Thuế
              </h3>
              <button
                onClick={() => { setShowCaptchaModal(false); setIsSyncing(false); }}
                className="text-slate-400 hover:text-slate-600 text-base font-bold px-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-900 leading-relaxed">
              {captchaModalNote || 'Mã bảo vệ từ Cổng Thuế Tổng Cục Thuế. Vui lòng nhìn ảnh bên dưới và nhập 6 ký tự:'}
            </div>

            {/* Khung hiển thị SVG Captcha + Nút Đổi Mã Khác */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 bg-white border-2 border-slate-200 rounded-xl p-3 min-h-[68px] flex items-center justify-center overflow-hidden shadow-inner">
                {isRefreshingCaptcha ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Đang tải mã Captcha mới...</span>
                  </div>
                ) : captchaSvg ? (
                  <div
                    className="scale-125 transform origin-center flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: captchaSvg }}
                  />
                ) : (
                  <span className="text-xs text-slate-400">Chưa có ảnh Captcha</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleRefreshCaptcha()}
                disabled={isRefreshingCaptcha}
                className="flex flex-col items-center justify-center gap-1 px-3 py-3 h-[68px] bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-xl text-[11px] font-bold transition shrink-0 cursor-pointer disabled:opacity-50"
                title="Đổi mã Captcha khác nếu ảnh hiện tại khó nhìn"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshingCaptcha ? 'animate-spin text-blue-600' : ''}`} />
                <span>Đổi mã</span>
              </button>
            </div>

            <form onSubmit={submitManualCaptcha} className="space-y-4">
              <div>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={8}
                  placeholder="NHẬP 6 KÝ TỰ (VD: G868EA)"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  className="w-full text-center text-xl font-mono font-extrabold tracking-[0.25em] px-4 py-3 border-2 border-blue-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 uppercase"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowCaptchaModal(false); setIsSyncing(false); }}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isRefreshingCaptcha || !manualCode.trim()}
                  className="px-6 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl shadow-sm transition cursor-pointer"
                >
                  Xác Nhận & Đồng Bộ Ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Thanh Toán & Kích Hoạt Bản Quyền Tự Động SePay VietQR */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 text-slate-800 border border-slate-100 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">👑</span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Bản Quyền PRO Tra Cứu Không Giới Hạn MST
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Hệ thống thanh toán tự động 24/7 kích hoạt trong 5 giây
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowUpgradeModal(false); setCheckoutOrder(null); setCheckoutSuccess(false); }}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Thông báo lý do nâng cấp */}
            {upgradeErrorMsg && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 mb-4 text-xs text-amber-950 leading-relaxed space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                  <span>ℹ️ Thông báo phân quyền gói sử dụng:</span>
                </div>
                <p>{upgradeErrorMsg}</p>
                <p className="text-[11px] text-amber-800 italic pt-1 border-t border-amber-200/60 mt-1">
                  💡 Chi phí gói PRO chỉ bằng 1 cốc trà sữa/tháng, tiết kiệm hàng chục giờ nhập liệu tay và bảo vệ bạn khỏi các lỗi loại trừ chi phí thuế!
                </p>
              </div>
            )}

            {/* Tab chuyển đổi: Mua tự động / Kích hoạt mã có sẵn */}
            <div className="flex border border-slate-200 rounded-xl p-1 bg-slate-100 mb-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTabModal('buy')}
                className={`flex-1 py-1.5 rounded-lg transition ${activeTabModal === 'buy' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}
              >
                Mua Gói Tự Động VietQR
              </button>
              <button
                type="button"
                onClick={() => setActiveTabModal('manual')}
                className={`flex-1 py-1.5 rounded-lg transition ${activeTabModal === 'manual' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}
              >
                Tôi Đã Có License Key
              </button>
            </div>

            {/* TAB 1: MUA TỰ ĐỘNG QUA SEPAY */}
            {activeTabModal === 'buy' && (
              <>
                {checkoutSuccess ? (
                  <div className="text-center py-6">
                    <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-bold">
                      ✓
                    </div>
                    <h4 className="text-base font-bold text-slate-900 mb-1">Thanh Toán Thành Công!</h4>
                    <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                      Bản quyền PRO đã được <strong>tự động kích hoạt ngay trên máy tính của bạn</strong>. Bạn có thể tra cứu không giới hạn mã số thuế.
                    </p>
                    <button
                      onClick={() => { setShowUpgradeModal(false); setCheckoutOrder(null); setCheckoutSuccess(false); }}
                      className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-xs"
                    >
                      Bắt Đầu Sử Dụng Ngay
                    </button>
                  </div>
                ) : checkoutOrder ? (
                  /* Đang hiển thị mã QR VietQR để quét */
                  <div className="space-y-4 text-center">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 leading-relaxed">
                      Mở ứng dụng Ngân hàng quét mã QR bên dưới. Hệ thống sẽ <strong>tự động kích hoạt trong 5-10 giây</strong> khi nhận được tiền.
                    </div>

                    <div className="inline-block p-2 bg-white border border-slate-200 rounded-2xl shadow-sm">
                      <img
                        src={checkoutOrder.qr_url}
                        alt="Mã VietQR"
                        className="w-56 h-auto object-contain mx-auto rounded-xl"
                      />
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-left text-xs space-y-1.5 font-medium">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Số tiền:</span>
                        <strong className="text-blue-700 font-bold font-mono">{(checkoutOrder.amount).toLocaleString('vi-VN')} đ</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Nội dung chuyển khoản:</span>
                        <strong className="text-slate-900 font-mono bg-amber-100 px-2 py-0.5 rounded text-amber-900 font-bold">{checkoutOrder.id}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Chủ tài khoản:</span>
                        <span className="text-slate-800 font-bold">{checkoutOrder.bank_account_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Trạng thái:</span>
                        <span className="text-amber-600 font-bold flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Đang chờ ngân hàng xác nhận...
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setCheckoutOrder(null)}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                      >
                        Quay Lại
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Form chọn gói & điền thông tin */
                  <form onSubmit={handleCreatePaymentOrder} className="space-y-3.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div
                        onClick={() => setCheckoutPlan('PRO_ANNUAL')}
                        className={`p-3.5 rounded-xl border cursor-pointer transition text-left relative ${checkoutPlan === 'PRO_ANNUAL' ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-2 ring-blue-500' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px] font-bold text-blue-700 uppercase">Gói 1 Năm</span>
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded">Khuyên dùng</span>
                        </div>
                        <strong className="text-base font-black text-slate-900">399.000 đ</strong>
                        <p className="text-[10px] text-slate-600 mt-0.5">Chỉ ~33k/tháng • Không giới hạn MST</p>
                      </div>

                      <div
                        onClick={() => setCheckoutPlan('PRO_LIFETIME')}
                        className={`p-3.5 rounded-xl border cursor-pointer transition text-left ${checkoutPlan === 'PRO_LIFETIME' ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-2 ring-blue-500' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px] font-bold text-amber-700 uppercase">Vĩnh Viễn (3 Năm+)</span>
                          <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded">VIP</span>
                        </div>
                        <strong className="text-base font-black text-slate-900">1.190.000 đ</strong>
                        <p className="text-[10px] text-slate-600 mt-0.5">Thanh toán 1 lần dùng trọn đời</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Email Nhận Bản Quyền <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="ketoan@congty.com"
                        value={checkoutEmail}
                        onChange={(e) => setCheckoutEmail(e.target.value)}
                        className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Số Điện Thoại / Zalo (Tùy chọn)
                      </label>
                      <input
                        type="tel"
                        placeholder="0912 345 678"
                        value={checkoutPhone}
                        onChange={(e) => setCheckoutPhone(e.target.value)}
                        className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={checkoutLoading}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2"
                      >
                        {checkoutLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : '👉 Tạo Mã VietQR Thanh Toán Ngay'}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            {/* TAB 2: KÍCH HOẠT / KHÔI PHỤC BẢN QUYỀN BẰNG EMAIL HOẶC LICENSE KEY */}
            {activeTabModal === 'manual' && (
              <form onSubmit={handleActivateManualKey} className="space-y-3.5">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Nếu bạn đổi sang máy tính mới, cài lại Windows hoặc đã mua bản quyền trước đó, chỉ cần nhập <strong>Email đã đăng ký</strong> (hoặc <strong>Mã License Key</strong> trong email) để mở khóa lại ngay lập tức:
                </p>

                {manualLicenseMsg && (
                  <div className={`p-3 rounded-xl text-xs font-semibold ${manualLicenseMsg.type === 'SUCCESS' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                    {manualLicenseMsg.text}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nhập Email Đã Mua Hoặc Mã License Key</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: ketoan@gmail.com hoặc LTP-TAX-12345"
                    value={manualLicenseInput}
                    onChange={(e) => setManualLicenseInput(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 font-semibold"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                  >
                    Kích Hoạt Bản Quyền Ngay
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
