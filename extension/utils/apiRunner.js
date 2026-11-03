/**
 * Bộ thực thi HTTP Request dựa trên Dynamic Config
 */

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class ApiRunner {
  constructor(baseUrl, backendUrl, licenseKey = '') {
    this.baseUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : 'https://hoadondientu.gdt.gov.vn/api';
    this.backendUrl = backendUrl ? backendUrl.replace(/\/+$/, '') : 'https://tax.ltp-soft.com';
    this.licenseKey = licenseKey;
    this.jwt = null;
  }

  setJwt(token) {
    this.jwt = token;
  }

  /**
   * Gọi API lên cổng Thuế
   */
  async requestTax(path, options = {}) {
    let url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;

    // Tự động bỏ port :30000 nếu cấu hình cũ còn sót
    if (url.includes(':30000')) {
      url = url.replace(':30000', '');
    }

    // Đảm bảo có tiền tố /api
    if (!url.includes('/api/')) {
      url = url.replace('hoadondientu.gdt.gov.vn/', 'hoadondientu.gdt.gov.vn/api/');
    }

    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      'request-id': generateUUID(),
      'End-Point': '/',
      ...(this.jwt ? { 'Authorization': `Bearer ${this.jwt}` } : {}),
      ...(options.headers || {})
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson = null;
      try {
        errorJson = JSON.parse(errorText);
      } catch (e) {
        // Not JSON
      }

      const err = new Error(errorJson?.message || `Tax API Error [${response.status}]: ${errorText}`);
      err.status = response.status;
      err.data = errorJson;
      throw err;
    }

    return await response.json();
  }

  /**
   * Gọi API lên Backend trung tâm
   */
  async requestBackend(path, options = {}) {
    const url = `${this.backendUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.licenseKey ? { 'X-License-Key': this.licenseKey } : {}),
      ...(options.headers || {})
    };

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs || 8000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errJson = null;
        try {
          errJson = JSON.parse(errorText);
        } catch (e) {}

        throw new Error(errJson?.message || `Backend Error [${response.status}]: ${errorText}`);
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Hết thời gian chờ máy chủ AI giải Captcha (> 8s). Chuyển sang chế độ nhập mã tay.');
      }
      throw err;
    }
  }

  /**
   * Lấy cấu hình động từ Backend (hoặc fallback nếu backend offline)
   */
  async fetchConfig() {
    try {
      const res = await this.requestBackend('/api/v1/tax-config');
      if (res && res.data) return res.data;
    } catch (err) {
      console.warn('[ApiRunner] Cannot reach backend config, using internal fallback config:', err.message);
    }

    // Fallback cấu hình chuẩn trực tiếp
    return {
      version: '1.0.1',
      base_url: 'https://hoadondientu.gdt.gov.vn/api',
      request_settings: {
        page_size: 50,
        delay_between_requests_ms: 350,
        max_captcha_retries: 3
      },
      endpoints: {
        captcha: { method: 'GET', path: '/captcha' },
        authenticate: {
          method: 'POST',
          path: '/security-taxpayer/authenticate',
          payload_map: {
            username: 'username',
            password: 'password',
            captcha_value: 'cvalue',
            captcha_key: 'ckey'
          },
          token_response_path: 'jwt'
        },
        streams: [
          {
            id: 'purchase_normal',
            type: 'MUA_VAO',
            source_label: 'HĐ Điện tử',
            method: 'GET',
            path: '/query/invoices/purchase',
            query_template: 'sort=tdlap:desc&size={{size}}&search=tdlap=ge={{from_date}}T00:00:00;tdlap=le={{to_date}}T23:59:59'
          },
          {
            id: 'purchase_pos',
            type: 'MUA_VAO',
            source_label: 'HĐ Máy tính tiền',
            method: 'GET',
            path: '/sco-query/invoices/purchase',
            query_template: 'sort=tdlap:desc&size={{size}}&search=tdlap=ge={{from_date}}T00:00:00;tdlap=le={{to_date}}T23:59:59&ckey={{ckey}}&cvalue={{cvalue}}'
          },
          {
            id: 'sold_normal',
            type: 'BAN_RA',
            source_label: 'HĐ Điện tử',
            method: 'GET',
            path: '/query/invoices/sold',
            query_template: 'sort=tdlap:desc&size={{size}}&search=tdlap=ge={{from_date}}T00:00:00;tdlap=le={{to_date}}T23:59:59'
          },
          {
            id: 'sold_pos',
            type: 'BAN_RA',
            source_label: 'HĐ Máy tính tiền',
            method: 'GET',
            path: '/sco-query/invoices/sold',
            query_template: 'sort=tdlap:desc&size={{size}}&search=tdlap=ge={{from_date}}T00:00:00;tdlap=le={{to_date}}T23:59:59&ckey={{ckey}}&cvalue={{cvalue}}'
          }
        ]
      },
      pagination: {
        items_array_path: 'datas',
        total_count_path: 'total',
        next_page_token_path: 'state',
        next_page_query_param: 'state'
      },
      field_mapping: {
        id: 'id',
        ky_hieu_mau_so: 'khmshdon',
        ky_hieu_hoa_don: 'khhdon',
        so_hoa_don: 'shdon',
        ngay_lap: 'tdlap',
        mst_nguoi_ban: 'nbmst',
        ten_nguoi_ban: 'nbten',
        dia_chi_nguoi_ban: 'nbdchi',
        mst_nguoi_mua: 'nmmst',
        ten_nguoi_mua: 'nmten',
        dia_chi_nguoi_mua: 'nmdchi',
        tong_tien_chua_thue: 'tgtcthue',
        tong_tien_thue: 'tgtthue',
        tong_tien_chiet_khau: 'ttcktmai',
        tong_tien_thanh_toan: 'tgtttbso',
        don_vi_tien_te: 'dvtte',
        ty_gia: 'tgia',
        trang_thai_hoa_don: 'tthai',
        ket_qua_kiem_tra: 'ttxly'
      },
      status_dictionary: {
        '1': 'Hóa đơn mới',
        '2': 'Hóa đơn thay thế',
        '3': 'Hóa đơn điều chỉnh',
        '4': 'Hóa đơn đã bị thay thế',
        '5': 'Hóa đơn đã bị điều chỉnh',
        '6': 'Hóa đơn đã bị hủy'
      }
    };
  }

  /**
   * Gửi ảnh Captcha lên Backend để Gemini OCR
   */
  async solveCaptcha(image, ckey) {
    const res = await this.requestBackend('/api/v1/solve-captcha', {
      method: 'POST',
      body: JSON.stringify({ image, ckey })
    });
    return res.code;
  }

  /**
   * Gửi mẫu JSON bị lệch trường về Backend để AI Schema Self-Healing
   */
  async healSchema(sampleData, currentMapping) {
    const res = await this.requestBackend('/api/v1/heal-schema', {
      method: 'POST',
      body: JSON.stringify({
        sample_data: sampleData,
        current_mapping: currentMapping
      })
    });
    return res.data;
  }
}
