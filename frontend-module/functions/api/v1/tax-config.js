// Cloudflare Pages Function: /api/v1/tax-config
// Serves dynamic tax configuration with CORS headers

const TAX_API_CONFIG = {
  "version": "1.0.2",
  "updated_at": "2026-10-31T07:25:00Z",
  "base_url": "https://hoadondientu.gdt.gov.vn/api",
  "request_settings": {
    "page_size": 50,
    "delay_between_requests_ms": 350,
    "max_captcha_retries": 3
  },
  "endpoints": {
    "captcha": {
      "method": "GET",
      "path": "/captcha"
    },
    "authenticate": {
      "method": "POST",
      "path": "/security-taxpayer/authenticate",
      "payload_map": {
        "username": "username",
        "password": "password",
        "captcha_value": "cvalue",
        "captcha_key": "ckey"
      },
      "token_response_path": "jwt"
    },
    "streams": [
      {
        "id": "purchase_normal",
        "type": "MUA_VAO",
        "source_label": "HĐ Điện tử",
        "method": "GET",
        "path": "/query/invoices/purchase",
        "query_template": "sort=tdlap:desc&size={{size}}&search=tdlap=ge={{from_date}}T00:00:00;tdlap=le={{to_date}}T23:59:59"
      },
      {
        "id": "purchase_pos",
        "type": "MUA_VAO",
        "source_label": "HĐ Máy tính tiền",
        "method": "GET",
        "path": "/sco-query/invoices/purchase",
        "query_template": "sort=tdlap:desc&size={{size}}&search=tdlap=ge={{from_date}}T00:00:00;tdlap=le={{to_date}}T23:59:59&ckey={{ckey}}&cvalue={{cvalue}}"
      },
      {
        "id": "sold_normal",
        "type": "BAN_RA",
        "source_label": "HĐ Điện tử",
        "method": "GET",
        "path": "/query/invoices/sold",
        "query_template": "sort=tdlap:desc&size={{size}}&search=tdlap=ge={{from_date}}T00:00:00;tdlap=le={{to_date}}T23:59:59"
      },
      {
        "id": "sold_pos",
        "type": "BAN_RA",
        "source_label": "HĐ Máy tính tiền",
        "method": "GET",
        "path": "/sco-query/invoices/sold",
        "query_template": "sort=tdlap:desc&size={{size}}&search=tdlap=ge={{from_date}}T00:00:00;tdlap=le={{to_date}}T23:59:59&ckey={{ckey}}&cvalue={{cvalue}}"
      }
    ]
  },
  "pagination": {
    "items_array_path": "datas",
    "total_count_path": "total",
    "next_page_token_path": "state",
    "next_page_query_param": "state"
  },
  "field_mapping": {
    "id": "id",
    "ky_hieu_mau_so": "khmshdon",
    "ky_hieu_hoa_don": "khhdon",
    "so_hoa_don": "shdon",
    "ngay_lap": "tdlap",
    "mst_nguoi_ban": "nbmst",
    "ten_nguoi_ban": "nbten",
    "dia_chi_nguoi_ban": "nbdchi",
    "mst_nguoi_mua": "nmmst",
    "ten_nguoi_mua": "nmten",
    "dia_chi_nguoi_mua": "nmdchi",
    "tong_tien_chua_thue": "tgtcthue",
    "tong_tien_thue": "tgtthue",
    "tong_tien_chiet_khau": "ttcktmai",
    "tong_tien_thanh_toan": "tgtttbso",
    "don_vi_tien_te": "dvtte",
    "ty_gia": "tgia",
    "trang_thai_hoa_don": "tthai",
    "ket_qua_kiem_tra": "ttxly"
  },
  "status_dictionary": {
    "1": "Hóa đơn mới",
    "2": "Hóa đơn thay thế",
    "3": "Hóa đơn điều chỉnh",
    "4": "Hóa đơn đã bị thay thế",
    "5": "Hóa đơn đã bị điều chỉnh",
    "6": "Hóa đơn đã bị hủy"
  }
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-License-Key'
    }
  });
}

export async function onRequestGet() {
  return new Response(JSON.stringify({
    success: true,
    data: TAX_API_CONFIG
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300'
    }
  });
}
