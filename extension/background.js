import { RateLimiter } from './utils/rateLimiter.js';
import { ApiRunner } from './utils/apiRunner.js';
import { SchemaInterceptor } from './interceptor.js';

console.log('[TaxSync Background] Service worker initialized.');

const rateLimiter = new RateLimiter(350);

// Helper tính ngày cuối tháng (hỗ trợ năm nhuận)
function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function formatDateDDMMYYYY(day, month, year) {
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  return `${dd}/${mm}/${year}`;
}

// Helper tạo khoảng thời gian cho 1 tháng duy nhất (Đối soát theo tháng)
function getSingleMonthChunk(month, year) {
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  const lastDay = getDaysInMonth(y, m);
  return [{
    label: `Tháng ${m}/${y}`,
    month: m,
    year: y,
    from_date: formatDateDDMMYYYY(1, m, y),
    to_date: formatDateDDMMYYYY(lastDay, m, y)
  }];
}

// Chia Quý thành 3 khoảng thời gian tháng
function getQuarterMonthChunks(quarter, year) {
  const q = parseInt(quarter, 10);
  const y = parseInt(year, 10);
  const startMonth = (q - 1) * 3 + 1;

  const chunks = [];
  for (let i = 0; i < 3; i++) {
    const m = startMonth + i;
    const lastDay = getDaysInMonth(y, m);
    chunks.push({
      label: `Tháng ${m}/${y}`,
      month: m,
      year: y,
      from_date: formatDateDDMMYYYY(1, m, y),
      to_date: formatDateDDMMYYYY(lastDay, m, y)
    });
  }
  return chunks;
}

// Helper thông minh: Chuẩn hóa ngày tháng theo múi giờ Việt Nam (UTC+7)
// Xử lý triệt để việc Cục thuế trả timestamp UTC như 2024-09-30T17:00:00Z -> chuyển thành 01/10/2024
function parseAndNormalizeVNDate(rawDateStr) {
  if (!rawDateStr) {
    return { formatted: '', day: 0, month: 0, year: 0, timestamp: 0 };
  }
  const str = String(rawDateStr).trim();

  // Dạng ISO từ Cổng thuế (VD: 2024-09-30T17:00:00.000+00:00 hoặc 2024-09-30T17:00:00Z)
  if (str.includes('T') || str.includes('Z') || (str.includes('-') && str.length >= 10)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const parts = formatter.formatToParts(d);
      const day = parseInt(parts.find(p => p.type === 'day')?.value || '1', 10);
      const month = parseInt(parts.find(p => p.type === 'month')?.value || '1', 10);
      const year = parseInt(parts.find(p => p.type === 'year')?.value || '2026', 10);
      return {
        formatted: formatDateDDMMYYYY(day, month, year),
        day,
        month,
        year,
        timestamp: d.getTime()
      };
    }
  }

  // Dạng dd/MM/yyyy
  if (str.includes('/')) {
    const [dPart] = str.split(' ');
    const [dd, mm, yyyy] = dPart.split('/');
    const day = parseInt(dd, 10) || 1;
    const month = parseInt(mm, 10) || 1;
    const year = parseInt(yyyy, 10) || 2026;
    const ts = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00+07:00`).getTime();
    return {
      formatted: formatDateDDMMYYYY(day, month, year),
      day,
      month,
      year,
      timestamp: isNaN(ts) ? 0 : ts
    };
  }

  return { formatted: str, day: 0, month: 0, year: 0, timestamp: 0 };
}

// Hàm thông báo tiến độ về Web Dashboard & Extension Popup
function broadcastProgress(progressData) {
  const message = {
    type: 'TAX_SYNC_PROGRESS',
    data: progressData
  };

  chrome.runtime.sendMessage(message).catch(() => {});

  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
      }
    }
  });
}

/**
 * Thực hiện Luồng 1: Giải Captcha & Đăng nhập
 */
async function authenticateUser(apiRunner, config, username, password, manualCaptcha = null, manualCkey = null) {
  // Nếu người dùng đã nhập mã captcha tay
  if (manualCaptcha && manualCkey) {
    broadcastProgress({
      stage: 'AUTH_SUBMIT',
      step: `Đang gửi xác thực với mã Captcha nhập tay: ${manualCaptcha}...`,
      percent: 10
    });

    const authEndpoint = config.endpoints.authenticate.path;
    const payloadMap = config.endpoints.authenticate.payload_map;

    const authPayload = {
      [payloadMap.username]: username,
      [payloadMap.password]: password,
      [payloadMap.captcha_value]: manualCaptcha,
      [payloadMap.captcha_key]: manualCkey
    };

    const authResponse = await apiRunner.requestTax(authEndpoint, {
      method: 'POST',
      body: JSON.stringify(authPayload)
    });

    const tokenPath = config.endpoints.authenticate.token_response_path || 'jwt';
    const jwtToken = authResponse[tokenPath] || authResponse.token;

    if (jwtToken) {
      apiRunner.setJwt(jwtToken);
      console.log('[Auth] Authenticated successfully with manual captcha!');
      broadcastProgress({
        stage: 'AUTH_SUCCESS',
        step: `Đăng nhập thành công MST ${username}! Bắt đầu quét hóa đơn...`,
        percent: 12
      });
      return {
        jwt: jwtToken,
        ckey: manualCkey,
        cvalue: manualCaptcha
      };
    } else {
      throw new Error('Không nhận được token xác thực.');
    }
  }

  // Luồng tự động (qua AI hoặc yêu cầu nhập tay nếu AI không khả dụng)
  const maxRetries = config.request_settings?.max_captcha_retries || 3;
  let attempts = 0;

  while (attempts < maxRetries) {
    attempts++;
    broadcastProgress({
      stage: 'AUTH',
      step: `Đang kết nối Cổng thuế & lấy mã Captcha (Lần ${attempts}/${maxRetries})...`,
      percent: 5
    });

    try {
      // 1. Lấy Captcha từ cổng thuế
      const captchaEndpoint = config.endpoints.captcha.path;
      const captchaRes = await apiRunner.requestTax(captchaEndpoint, { method: 'GET' });

      const ckey = captchaRes.key || captchaRes.ckey;
      const captchaContent = captchaRes.content || captchaRes.svg || captchaRes.image;

      if (!ckey || !captchaContent) {
        throw new Error('Không nhận được dữ liệu Captcha từ Cổng thuế.');
      }

      // 2. Thử giải Captcha qua AI Vision OCR
      let solvedCode = null;
      try {
        broadcastProgress({
          stage: 'CAPTCHA_SOLVING',
          step: `Đang nhận diện ký tự quang học bảo mật (Neural OCR)...`,
          percent: 8,
          captcha_svg: captchaContent,
          ckey: ckey
        });

        solvedCode = await apiRunner.solveCaptcha(captchaContent, ckey);
        console.log(`[Auth] AI Solved captcha: ${solvedCode}`);
      } catch (aiErr) {
        console.warn('[Auth] AI Captcha solving unavailable:', aiErr.message);

        // Bắn tín hiệu để Web Dashboard hiện popup nhập tay
        broadcastProgress({
          stage: 'NEED_MANUAL_CAPTCHA',
          step: 'Máy chủ nhận diện tự động đang bận. Vui lòng nhập trực tiếp mã bảo vệ trên màn hình.',
          captcha_svg: captchaContent,
          ckey: ckey,
          percent: 8
        });

        const error = new Error('NEED_MANUAL_CAPTCHA');
        error.captcha_svg = captchaContent;
        error.ckey = ckey;
        throw error;
      }

      // 3. Đăng nhập
      broadcastProgress({
        stage: 'AUTH_SUBMIT',
        step: `Đang xác thực tài khoản ${username} với mã [${solvedCode}]...`,
        percent: 10
      });

      const authEndpoint = config.endpoints.authenticate.path;
      const payloadMap = config.endpoints.authenticate.payload_map;

      const authPayload = {
        [payloadMap.username]: username,
        [payloadMap.password]: password,
        [payloadMap.captcha_value]: solvedCode,
        [payloadMap.captcha_key]: ckey
      };

      const authResponse = await apiRunner.requestTax(authEndpoint, {
        method: 'POST',
        body: JSON.stringify(authPayload)
      });

      const tokenPath = config.endpoints.authenticate.token_response_path || 'jwt';
      const jwtToken = authResponse[tokenPath] || authResponse.token;

      if (jwtToken) {
        apiRunner.setJwt(jwtToken);
        console.log('[Auth] Authenticated successfully!');
        broadcastProgress({
          stage: 'AUTH_SUCCESS',
          step: `Đăng nhập thành công MST ${username}! Bắt đầu quét hóa đơn...`,
          percent: 12
        });
        return {
          jwt: jwtToken,
          ckey: ckey,
          cvalue: solvedCode
        };
      } else {
        throw new Error('Không tìm thấy token đăng nhập trong kết quả.');
      }
    } catch (err) {
      if (err.message === 'NEED_MANUAL_CAPTCHA') {
        throw err;
      }

      console.warn(`[Auth Attempt ${attempts}] Error:`, err.message);

      const errMsg = (err.message || '').toLowerCase();
      if (errMsg.includes('sai mật khẩu') || errMsg.includes('mật khẩu không đúng') || errMsg.includes('tài khoản không tồn tại')) {
        throw new Error(`Đăng nhập thất bại: Sai tên đăng nhập hoặc mật khẩu! Vui lòng kiểm tra lại MST và Mật khẩu.`);
      }

      if (attempts >= maxRetries) {
        console.warn(`[Auth] AI đã thử ${maxRetries} lần nhưng không thành công. Lấy mã mới và chuyển sang Modal cho người dùng.`);
        broadcastProgress({
          stage: 'AUTH_FAILED_MAX_RETRIES',
          step: `AI đã thử giải 3 lần chưa khớp. Đang tải mã Captcha mới để bạn nhập trực tiếp...`,
          percent: 8
        });

        try {
          const freshCaptcha = await apiRunner.requestTax(config.endpoints.captcha.path, { method: 'GET' });
          const freshCkey = freshCaptcha.key || freshCaptcha.ckey;
          const freshContent = freshCaptcha.content || freshCaptcha.svg || freshCaptcha.image;

          broadcastProgress({
            stage: 'NEED_MANUAL_CAPTCHA',
            step: `AI đã thử giải 3 lần không khớp. Vui lòng nhập mã Captcha hiển thị trên màn hình để tiếp tục.`,
            captcha_svg: freshContent,
            ckey: freshCkey,
            percent: 8
          });

          const manualErr = new Error('NEED_MANUAL_CAPTCHA');
          manualErr.captcha_svg = freshContent;
          manualErr.ckey = freshCkey;
          throw manualErr;
        } catch (fetchErr) {
          if (fetchErr.message === 'NEED_MANUAL_CAPTCHA') throw fetchErr;
          throw new Error(`Xác thực thất bại sau ${maxRetries} lần thử: ${err.message}`);
        }
      }

      await rateLimiter.wait(1000);
    }
  }
}

/**
 * Trích xuất giá trị trường theo nested path hoặc key
 */
function getFieldValue(obj, fieldPath) {
  if (!obj || !fieldPath) return undefined;
  if (obj[fieldPath] !== undefined) return obj[fieldPath];

  const parts = fieldPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Ánh xạ dữ liệu thô sang cấu trúc hóa đơn chuẩn (kèm chuẩn hóa ngày giờ Việt Nam)
 */
function mapInvoiceItem(rawItem, fieldMapping, stream, statusDict) {
  const get = (key) => {
    const rawKey = fieldMapping[key];
    return rawKey ? getFieldValue(rawItem, rawKey) : undefined;
  };

  const statusRaw = get('trang_thai_hoa_don');
  const statusStr = statusRaw !== undefined ? String(statusRaw) : '1';
  const statusLabel = statusDict[statusStr] || `Trạng thái (${statusStr})`;

  // Chuẩn hóa ngày lập sang múi giờ Việt Nam
  const rawNgay = get('ngay_lap') || rawItem.tdlap || rawItem.nlap || '';
  const parsedDate = parseAndNormalizeVNDate(rawNgay);

  return {
    id: get('id') || rawItem.id || `${rawItem.khmshdon}_${rawItem.khhdon}_${rawItem.shdon}`,
    loai_hoa_don: stream.source_label || (stream.id.includes('pos') ? 'HĐ Máy tính tiền' : 'HĐ Điện tử'),
    stream_type: stream.type,
    ky_hieu_mau_so: get('ky_hieu_mau_so') || '',
    ky_hieu_hoa_don: get('ky_hieu_hoa_don') || '',
    so_hoa_don: get('so_hoa_don') || '',
    ngay_lap: parsedDate.formatted || rawNgay,
    parsed_date: parsedDate,
    mst_nguoi_ban: get('mst_nguoi_ban') || '',
    ten_nguoi_ban: get('ten_nguoi_ban') || '',
    dia_chi_nguoi_ban: get('dia_chi_nguoi_ban') || '',
    mst_nguoi_mua: get('mst_nguoi_mua') || '',
    ten_nguoi_mua: get('ten_nguoi_mua') || '',
    dia_chi_nguoi_mua: get('dia_chi_nguoi_mua') || '',
    tong_tien_chua_thue: Number(get('tong_tien_chua_thue')) || 0,
    tong_tien_thue: Number(get('tong_tien_thue')) || 0,
    tong_tien_chiet_khau: Number(get('tong_tien_chiet_khau')) || 0,
    tong_tien_thanh_toan: Number(get('tong_tien_thanh_toan')) || 0,
    don_vi_tien_te: get('don_vi_tien_te') || 'VND',
    ty_gia: Number(get('ty_gia')) || 1,
    trang_thai_hoa_don: statusStr,
    trang_thai_nhan: statusLabel,
    ket_qua_kiem_tra: get('ket_qua_kiem_tra') || '',
    is_valid_for_tax: statusStr !== '4' && statusStr !== '6',
    raw_data: rawItem
  };
}

// Kiểm tra xem hóa đơn có nằm đúng trong Quý hoặc Tháng được yêu cầu không
function isInvoiceInRequestedPeriod(inv, options) {
  if (!options || !options.strict_period) return true;
  const p = inv.parsed_date;
  if (!p || !p.month || !p.year) return true;

  const targetYear = parseInt(options.target_year, 10);
  if (targetYear && p.year !== targetYear) {
    return false;
  }

  if (options.target_month) {
    const targetMonth = parseInt(options.target_month, 10);
    return p.month === targetMonth;
  }

  if (options.target_quarter) {
    const q = parseInt(options.target_quarter, 10);
    const allowedMonths = [(q - 1) * 3 + 1, (q - 1) * 3 + 2, (q - 1) * 3 + 3];
    return allowedMonths.includes(p.month);
  }

  return true;
}

/**
 * Lấy mã Captcha mới và giải mã tự động bằng Gemini AI cho luồng Máy Tính Tiền (POS)
 */
async function getFreshCaptchaForPos(apiRunner) {
  try {
    const captchaRes = await apiRunner.requestTax('/captcha', { method: 'GET' });
    const freshCkey = captchaRes.key || captchaRes.ckey;
    const captchaContent = captchaRes.content || captchaRes.svg || captchaRes.image;
    if (!freshCkey || !captchaContent) return null;

    const freshCode = await apiRunner.solveCaptcha(captchaContent, freshCkey);
    console.log(`[PosCaptcha] Đã giải thành công Captcha mới cho HĐ Máy tính tiền: ${freshCode} (ckey: ${freshCkey})`);
    return { ckey: freshCkey, cvalue: freshCode };
  } catch (err) {
    console.warn('[PosCaptcha] Không thể lấy Captcha tự động cho POS:', err.message);
    return null;
  }
}

/**
 * Thực hiện Luồng 2: Quét vét cạn hóa đơn không bỏ sót (Zero-Miss Fetching)
 */
async function fetchAllInvoices(apiRunner, config, dateChunks, ckey = '', cvalue = '', options = {}) {
  const purchaseMap = new Map();
  const soldMap = new Map();
  let outOfPeriodCount = 0;

  let streams = config.endpoints.streams || [];
  // Mặc định luôn quét cả HĐ Điện tử và HĐ Máy tính tiền để KHÔNG BỎ SÓT chi phí mua vào
  if (options && options.include_pos === false) {
    streams = streams.filter(s => !s.id.includes('pos'));
  }

  const delayMs = config.request_settings?.delay_between_requests_ms || 350;
  const pageSize = config.request_settings?.page_size || 50;

  const totalSteps = dateChunks.length * streams.length;
  let currentStep = 0;

  for (let cIdx = 0; cIdx < dateChunks.length; cIdx++) {
    const chunk = dateChunks[cIdx];

    for (let sIdx = 0; sIdx < streams.length; sIdx++) {
      const stream = streams[sIdx];
      currentStep++;

      const isPosStream = stream.id.includes('pos');
      let activeCkey = ckey;
      let activeCvalue = cvalue;

      // HĐ Máy tính tiền yêu cầu mã Captcha độc lập mới, tránh lỗi Captcha hết hạn từ bước đăng nhập
      if (isPosStream) {
        broadcastProgress({
          stage: 'FETCHING',
          month_label: chunk.label,
          stream_label: `${stream.type === 'MUA_VAO' ? 'Mua vào' : 'Bán ra'} - ${stream.source_label}`,
          step: `Đang giải mã ký tự bảo vệ cho HĐ Máy tính tiền (${chunk.label})...`,
          percent: Math.min(95, Math.round(12 + (currentStep / totalSteps) * 80)),
          purchase_count: purchaseMap.size,
          sold_count: soldMap.size
        });

        const fresh = await getFreshCaptchaForPos(apiRunner);
        if (fresh) {
          activeCkey = fresh.ckey;
          activeCvalue = fresh.cvalue;
        }
      }

      const percent = Math.min(
        95,
        Math.round(12 + (currentStep / totalSteps) * 80)
      );

      broadcastProgress({
        stage: 'FETCHING',
        month_label: chunk.label,
        stream_label: `${stream.type === 'MUA_VAO' ? 'Mua vào' : 'Bán ra'} - ${stream.source_label}`,
        step: `[${currentStep}/${totalSteps}] Đang quét ${chunk.label} (${stream.source_label} ${stream.type === 'MUA_VAO' ? 'Mua vào' : 'Bán ra'})...`,
        percent: percent,
        purchase_count: purchaseMap.size,
        sold_count: soldMap.size
      });

      let queryStr = stream.query_template
        .replace('{{size}}', pageSize)
        .replace('{{from_date}}', chunk.from_date)
        .replace('{{to_date}}', chunk.to_date)
        .replace('{{ckey}}', encodeURIComponent(activeCkey || ''))
        .replace('{{cvalue}}', encodeURIComponent(activeCvalue || ''));

      let nextState = null;
      let streamFinished = false;
      let fetchedInStream = 0;

      while (!streamFinished) {
        let fullPath = `${stream.path}?${queryStr}`;
        if (nextState) {
          fullPath += `&${config.pagination.next_page_query_param || 'state'}=${encodeURIComponent(nextState)}`;
        }

        await rateLimiter.wait(delayMs);

        try {
          const res = await apiRunner.requestTax(fullPath, { method: 'GET' });

          const items = res[config.pagination.items_array_path || 'datas'] || [];
          const totalCount = res[config.pagination.total_count_path || 'total'] || 0;
          nextState = res[config.pagination.next_page_token_path || 'state'];

          console.log(`[Stream ${stream.id} - ${chunk.label}] Fetched ${items.length} items (Total: ${totalCount})`);

          if (items.length > 0) {
            if (SchemaInterceptor.detectDrift(items[0], config.field_mapping)) {
              console.warn('[SchemaDrift] Detected possible schema drift! Triggering AI Auto-Heal...');
              try {
                const sanitizedSample = SchemaInterceptor.sanitizeSample(items[0]);
                const healResult = await apiRunner.healSchema(sanitizedSample, config.field_mapping);
                if (healResult.updated_mapping) {
                  config.field_mapping = healResult.updated_mapping;
                }
              } catch (healErr) {
                console.error('[SchemaDrift] Auto-heal failed:', healErr.message);
              }
            }

            for (const rawItem of items) {
              const mapped = mapInvoiceItem(rawItem, config.field_mapping, stream, config.status_dictionary);

              // Bộ lọc thông minh: Nếu ngày lập nằm ngoài kỳ được chọn (ví dụ 30/09 trong Quý 4)
              if (options && options.strict_period && !isInvoiceInRequestedPeriod(mapped, options)) {
                console.warn(`[SmartDateFilter] Loại trừ HĐ ngoài kỳ: Số ${mapped.so_hoa_don}, Ngày ${mapped.ngay_lap}`);
                outOfPeriodCount++;
                continue;
              }

              if (stream.type === 'MUA_VAO') {
                purchaseMap.set(mapped.id, mapped);
              } else {
                soldMap.set(mapped.id, mapped);
              }
            }

            fetchedInStream += items.length;
          }

          if (!nextState || items.length === 0 || (totalCount > 0 && fetchedInStream >= totalCount)) {
            streamFinished = true;
          }
        } catch (fetchErr) {
          // Nếu gặp lỗi Captcha hoặc Timeout ở luồng Máy tính tiền, tự động thử lại 1 lần với Captcha mới
          if (isPosStream && (fetchErr.message?.includes('captcha') || fetchErr.message?.includes('504'))) {
            console.log(`[PosStream] Thử lại với Captcha mới cho ${stream.id}...`);
            const retryFresh = await getFreshCaptchaForPos(apiRunner);
            if (retryFresh) {
              const retryQuery = stream.query_template
                .replace('{{size}}', pageSize)
                .replace('{{from_date}}', chunk.from_date)
                .replace('{{to_date}}', chunk.to_date)
                .replace('{{ckey}}', encodeURIComponent(retryFresh.ckey))
                .replace('{{cvalue}}', encodeURIComponent(retryFresh.cvalue));
              const retryPath = nextState 
                ? `${stream.path}?${retryQuery}&${config.pagination.next_page_query_param || 'state'}=${encodeURIComponent(nextState)}`
                : `${stream.path}?${retryQuery}`;
              try {
                const retryRes = await apiRunner.requestTax(retryPath, { method: 'GET' });
                const rItems = retryRes[config.pagination.items_array_path || 'datas'] || [];
                const rTotal = retryRes[config.pagination.total_count_path || 'total'] || 0;
                nextState = retryRes[config.pagination.next_page_token_path || 'state'];
                for (const rawItem of rItems) {
                  const mapped = mapInvoiceItem(rawItem, config.field_mapping, stream, config.status_dictionary);
                  if (options && options.strict_period && !isInvoiceInRequestedPeriod(mapped, options)) {
                    outOfPeriodCount++;
                    continue;
                  }
                  if (stream.type === 'MUA_VAO') purchaseMap.set(mapped.id, mapped);
                  else soldMap.set(mapped.id, mapped);
                }
                fetchedInStream += rItems.length;
                if (!nextState || rItems.length === 0 || (rTotal > 0 && fetchedInStream >= rTotal)) {
                  streamFinished = true;
                }
                continue;
              } catch (e2) {
                console.warn(`[PosStream] Thử lại POS không thành công: ${e2.message}`);
              }
            }
          }

          if (isPosStream) {
            console.warn(`[Info] Doanh nghiệp không đăng ký hoặc Cổng thuế POS phản hồi chậm (${stream.source_label}): ${fetchErr.message}. Tự động bỏ qua an toàn.`);
          } else {
            console.error(`[Fetch Stream Error] ${fullPath}:`, fetchErr.message);
          }
          streamFinished = true;
        }
      }
    }
  }

  const sortByDate = (a, b) => {
    const parseDate = (d) => {
      if (!d) return 0;
      if (d.includes('/')) {
        const [day, mon, yr] = d.split('/');
        return new Date(`${yr}-${mon}-${day}`).getTime() || 0;
      }
      return new Date(d).getTime() || 0;
    };
    return parseDate(a.ngay_lap) - parseDate(b.ngay_lap);
  };

  const purchaseList = Array.from(purchaseMap.values()).sort(sortByDate);
  const soldList = Array.from(soldMap.values()).sort(sortByDate);

  return {
    purchase: purchaseList,
    sold: soldList,
    out_of_period_count: outOfPeriodCount
  };
}

/**
 * Xử lý tiến trình tổng hợp
 */
async function handleSyncRequest(payload) {
  const {
    username,
    password,
    quarter = null,
    month = null,
    year,
    from_date,
    to_date,
    strict_period = true,
    include_pos = true,
    backend_url = 'https://tax.ltp-soft.com',
    license_key = '',
    manual_captcha = null,
    manual_ckey = null
  } = payload;

  const periodDesc = month ? `Tháng ${month}/${year}` : (quarter ? `Quý ${quarter}/${year}` : `${from_date} đến ${to_date}`);
  console.log(`[SyncJob] Starting sync for MST: ${username}, Period: ${periodDesc}`);

  // Kiểm tra giới hạn 1 MST miễn phí (lưu trong chrome.storage.local - chống bypass Ctrl+F5)
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const storeData = await chrome.storage.local.get(['registered_msts', 'license_key']);
    const registeredMsts = storeData.registered_msts || [];
    const activeLicense = (license_key && license_key !== 'free-lead-magnet') ? license_key : storeData.license_key;

    if (!registeredMsts.includes(username)) {
      if (registeredMsts.length >= 2 && !activeLicense) {
        throw new Error('LIMIT_EXCEEDED: Bạn đang sử dụng gói Miễn phí (đã dùng tối đa 02 Mã số thuế: ' + registeredMsts.join(', ') + '). Để tra cứu từ MST thứ 3 trở lên (' + username + '), vui lòng nâng cấp bản Pro hoặc đăng ký sử dụng phần mềm chấm công LTP Attendance!');
      }
      registeredMsts.push(username);
      await chrome.storage.local.set({ registered_msts: registeredMsts });
    }
  }

  // 1. Khởi tạo ApiRunner và tải cấu hình động
  const tempRunner = new ApiRunner('https://hoadondientu.gdt.gov.vn/api', backend_url, license_key);
  
  broadcastProgress({
    stage: 'INIT',
    step: 'Đang kết nối Cổng Thuế Điện Tử (hoadondientu.gdt.gov.vn)...',
    percent: 2
  });

  const dynamicConfig = await tempRunner.fetchConfig();
  const apiRunner = new ApiRunner(dynamicConfig.base_url, backend_url, license_key);

  // 2. Xác thực & Đăng nhập lấy JWT
  const authData = await authenticateUser(apiRunner, dynamicConfig, username, password, manual_captcha, manual_ckey);

  // 3. Chuẩn bị các Date Chunks (hỗ trợ theo Tháng, theo Quý hoặc tùy chọn ngày)
  let dateChunks = [];
  if (month && year) {
    dateChunks = getSingleMonthChunk(month, year);
  } else if (quarter && year) {
    dateChunks = getQuarterMonthChunks(quarter, year);
  } else if (from_date && to_date) {
    dateChunks = [{
      label: `${from_date} đến ${to_date}`,
      from_date: from_date,
      to_date: to_date
    }];
  } else {
    throw new Error('Vui lòng chọn Tháng, Quý/Năm hoặc khoảng ngày tra cứu.');
  }

  // 4. Quét hóa đơn không bỏ sót (kèm bộ lọc thông minh chuẩn hóa ngày giờ VN)
  const result = await fetchAllInvoices(
    apiRunner,
    dynamicConfig,
    dateChunks,
    authData?.ckey,
    authData?.cvalue,
    {
      strict_period,
      include_pos,
      target_year: year,
      target_quarter: quarter,
      target_month: month,
      from_date,
      to_date
    }
  );

  // 5. Tính toán tóm tắt
  const sumValid = (list, field) => list
    .filter(item => item.is_valid_for_tax)
    .reduce((acc, curr) => acc + (Number(curr[field]) || 0), 0);

  const summary = {
    mst: username,
    quarter: quarter,
    month: month,
    period_label: periodDesc,
    year: year || new Date().getFullYear(),
    count_purchase: result.purchase.length,
    count_sold: result.sold.length,
    out_of_period_count: result.out_of_period_count || 0,
    valid_count_purchase: result.purchase.filter(i => i.is_valid_for_tax).length,
    valid_count_sold: result.sold.filter(i => i.is_valid_for_tax).length,
    total_amount_purchase: sumValid(result.purchase, 'tong_tien_thanh_toan'),
    total_amount_sold: sumValid(result.sold, 'tong_tien_thanh_toan'),
    total_tax_purchase: sumValid(result.purchase, 'tong_tien_thue'),
    total_tax_sold: sumValid(result.sold, 'tong_tien_thue'),
    synced_at: new Date().toISOString()
  };

  let completionMessage = `Đã hoàn tất! Thu thập ${result.purchase.length} HĐ Mua vào và ${result.sold.length} HĐ Bán ra (${periodDesc}).`;
  if (result.out_of_period_count > 0) {
    completionMessage += ` (Đã tự động loại bỏ ${result.out_of_period_count} tờ sai kỳ do lệch giờ Cục thuế).`;
  }

  broadcastProgress({
    stage: 'COMPLETED',
    step: completionMessage,
    percent: 100,
    summary
  });

  return {
    success: true,
    data: result,
    summary
  };
}

// Lắng nghe messages từ Popup hoặc Content Script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'START_SYNC') {
    handleSyncRequest(request.payload)
      .then((data) => sendResponse({ success: true, ...data }))
      .catch((err) => {
        console.error('[Sync Error]:', err);
        if (err.message === 'NEED_MANUAL_CAPTCHA') {
          sendResponse({
            success: false,
            need_manual_captcha: true,
            captcha_svg: err.captcha_svg,
            ckey: err.ckey,
            error: 'Vui lòng nhập mã Captcha để tiếp tục.'
          });
          return;
        }

        broadcastProgress({
          stage: 'ERROR',
          step: `Lỗi: ${err.message}`,
          percent: 0,
          error: err.message
        });
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  if (request.type === 'GET_CAPTCHA') {
    const runner = new ApiRunner('https://hoadondientu.gdt.gov.vn/api');
    runner.requestTax('/captcha', { method: 'GET' })
      .then(res => sendResponse({ success: true, data: res }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.type === 'UPDATE_MST') {
    const { oldMst, newMst } = request.payload || {};
    chrome.storage.local.get(['registered_msts'], (store) => {
      let registered = store.registered_msts || [];
      if (oldMst && newMst) {
        registered = registered.map(m => m === oldMst ? newMst : m);
        chrome.storage.local.set({ registered_msts: registered }, () => {
          console.log('[MST Update] Updated registered MSTs after typo fix:', registered);
          sendResponse({ success: true, registered_msts: registered });
        });
      } else {
        sendResponse({ success: false, message: 'Invalid payload' });
      }
    });
    return true;
  }

  if (request.type === 'PING') {
    sendResponse({ success: true, version: '1.0.1', status: 'ready' });
    return false;
  }
});
