/**
 * Module phát hiện lệch cấu trúc dữ liệu (Schema Drift Detection)
 * & Ẩn danh hóa dữ liệu (Sanitization) trước khi gửi AI phân tích
 */

export class SchemaInterceptor {
  /**
   * Kiểm tra xem các trường quan trọng có bị undefined không
   */
  static detectDrift(sampleItem, fieldMapping) {
    if (!sampleItem) return false;

    const criticalFields = ['so_hoa_don', 'ngay_lap', 'tong_tien_thanh_toan'];
    let undefinedCount = 0;

    for (const field of criticalFields) {
      const mappedKey = fieldMapping[field];
      if (!mappedKey || sampleItem[mappedKey] === undefined || sampleItem[mappedKey] === null) {
        undefinedCount++;
      }
    }

    // Nếu có từ 2/3 trường cốt lõi bị thiếu -> Báo hiệu lệch Schema
    return undefinedCount >= 2;
  }

  /**
   * Ẩn danh hóa dữ liệu nhạy cảm (Tên công ty, địa chỉ, MST thực)
   * Giữ nguyên toàn bộ cấu trúc Key-Value và kiểu dữ liệu cho AI phân tích
   */
  static sanitizeSample(sampleItem) {
    if (!sampleItem || typeof sampleItem !== 'object') return {};

    const sanitized = {};
    for (const [key, value] of Object.entries(sampleItem)) {
      if (typeof value === 'string') {
        const lowerKey = key.toLowerCase();
        // Kiểm tra xem key có liên quan đến tên, địa chỉ, hoặc thông tin cá nhân
        if (
          lowerKey.includes('ten') ||
          lowerKey.includes('name') ||
          lowerKey.includes('dchi') ||
          lowerKey.includes('address')
        ) {
          sanitized[key] = 'REDACTED_COMPANY_NAME';
        } else if (lowerKey.includes('mst') || lowerKey.includes('tax')) {
          sanitized[key] = '0100000000';
        } else {
          sanitized[key] = value;
        }
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
