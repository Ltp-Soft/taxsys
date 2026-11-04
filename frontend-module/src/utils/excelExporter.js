import ExcelJS from 'exceljs';

/**
 * Helper chuẩn hóa ngày giờ sang Múi giờ Việt Nam (Asia/Ho_Chi_Minh GMT+7)
 */
function formatToVietnamDate(dateVal) {
  if (!dateVal) return '';
  const str = String(dateVal).trim();

  if (str.includes('T') || str.includes('Z') || (str.includes('-') && str.length >= 10)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      return formatter.format(d);
    }
  }

  if (str.includes('/')) {
    const [dPart] = str.split(' ');
    return dPart;
  }

  return str;
}

/**
 * Chuẩn hóa cột "Kết quả kiểm tra hóa đơn" (ttxly / ket_qua_kiem_tra từ Tổng Cục Thuế)
 * - Bình thường: "Đã cấp mã hóa đơn" (mã ttxly: 5, 6, 8, 0, 1, 7)
 * - Bất thường (Loại trừ khỏi chi phí/thuế): "Hóa đơn không đủ điều kiện cấp mã" (mã ttxly: 2, 3, 4 hoặc từ chối cấp mã)
 */
export function resolveInvoiceCheckResult(inv) {
  if (!inv) {
    return {
      isRejectedCode: false,
      code: 'DA_CAP_MA',
      label: 'Đã cấp mã hóa đơn',
      rawCode: '5'
    };
  }

  const rawVal =
    inv.ket_qua_kiem_tra !== undefined && inv.ket_qua_kiem_tra !== ''
      ? inv.ket_qua_kiem_tra
      : (inv.raw_data?.ttxly ?? inv.ttxly ?? inv.raw_data?.kqcht ?? '');

  const str = String(rawVal).trim();
  const lower = str.toLowerCase();

  // Mã ttxly của Tổng Cục Thuế cho hóa đơn bị từ chối / không đủ điều kiện cấp mã: 2, 3, 4
  const isRejected =
    str === '2' ||
    str === '3' ||
    str === '4' ||
    lower.includes('không đủ điều kiện') ||
    lower.includes('khong du dieu kien') ||
    lower.includes('từ chối cấp mã') ||
    lower.includes('cqt từ chối') ||
    lower.includes('không cấp mã');

  if (isRejected) {
    return {
      isRejectedCode: true,
      code: 'KHONG_DU_DIEU_KIEN',
      label: 'Hóa đơn không đủ điều kiện cấp mã',
      rawCode: str || '4'
    };
  }

  return {
    isRejectedCode: false,
    code: 'DA_CAP_MA',
    label: 'Đã cấp mã hóa đơn',
    rawCode: str || '5'
  };
}

/**
 * Đánh giá toàn diện tính hợp lệ của hóa đơn để kê khai thuế & tính chi phí:
 * Loại trừ cả Hóa đơn đã hủy/thay thế (tthai = 4, 6) VÀ "Hóa đơn không đủ điều kiện cấp mã" (ttxly = 2, 3, 4)
 */
export function evaluateInvoiceValidity(inv) {
  if (!inv) {
    return {
      isValid: false,
      isCancelledOrReplaced: true,
      isRejectedCode: false,
      checkResultLabel: 'Đã cấp mã hóa đơn',
      ghiChuKeKhai: 'Đã hủy/thay thế (Không kê khai)'
    };
  }

  const checkInfo = resolveInvoiceCheckResult(inv);
  const statusStr = String(inv.trang_thai_hoa_don ?? inv.raw_data?.tthai ?? '1').trim();
  const statusLabel = String(inv.trang_thai_nhan || '').toLowerCase();

  const isCancelledOrReplaced =
    statusStr === '4' ||
    statusStr === '6' ||
    statusLabel.includes('đã bị hủy') ||
    statusLabel.includes('đã bị thay thế') ||
    (inv.is_valid_for_tax === false && !checkInfo.isRejectedCode);

  const isRejectedCode = checkInfo.isRejectedCode;
  const isValid = !isCancelledOrReplaced && !isRejectedCode;

  let ghiChuKeKhai = 'Hợp lệ';
  if (isRejectedCode) {
    ghiChuKeKhai = 'Không đủ ĐK cấp mã (Loại trừ)';
  } else if (isCancelledOrReplaced) {
    ghiChuKeKhai = 'Đã hủy/thay thế (Không kê khai)';
  }

  return {
    isValid,
    isCancelledOrReplaced,
    isRejectedCode,
    checkResultLabel: checkInfo.label,
    ghiChuKeKhai
  };
}

/**
 * Tự động nhận diện và phân loại mức Thuế suất GTGT của hóa đơn (0%, 5%, 8%, 10%, KCT, Nhiều mức)
 */
export function detectInvoiceTaxRate(inv) {
  if (!inv) return { label: '0%', code: '0%', bgArgb: 'FFEDEDED', rowTintArgb: 'FFF9FAFB', textArgb: 'FF404040' };

  const PALETTE = {
    '0%': { label: '0%', code: '0%', bgArgb: 'FFEDEDED', rowTintArgb: 'FFF9FAFB', textArgb: 'FF404040' },
    '5%': { label: '5%', code: '5%', bgArgb: 'FFDAEEF3', rowTintArgb: 'FFF2F9FB', textArgb: 'FF005A9E' },
    '8%': { label: '8%', code: '8%', bgArgb: 'FFE2EFDA', rowTintArgb: 'FFF4FBF0', textArgb: 'FF276A3C' },
    '10%': { label: '10%', code: '10%', bgArgb: 'FFFCE4D6', rowTintArgb: 'FFFFF8F3', textArgb: 'FFC55A11' },
    'MULTI': { label: 'Nhiều mức', code: 'MULTI', bgArgb: 'FFE4DFEC', rowTintArgb: 'FFF8F5FC', textArgb: 'FF5F3DC4' }
  };

  const normalizeRateStr = (raw) => {
    if (raw === undefined || raw === null) return null;
    const s = String(raw).trim().toUpperCase();
    if (!s) return null;
    if (s === '0%' || s === '0' || s.includes('KCT') || s.includes('KKKNT') || s.includes('KHÔNG CHỊU THUẾ')) return '0%';
    if (s === '5%' || s === '5' || s === '0.05') return '5%';
    if (s === '8%' || s === '8' || s === '0.08') return '8%';
    if (s === '10%' || s === '10' || s === '0.1' || s === '0.10') return '10%';
    return null;
  };

  // 1. Ưu tiên kiểm tra mảng tổng hợp thuế suất từ API Tổng Cục Thuế (thttltsuat)
  const rawList = inv.raw_data?.thttltsuat || inv.thttltsuat;
  if (Array.isArray(rawList) && rawList.length > 0) {
    const foundRates = new Set();
    rawList.forEach(item => {
      const r = normalizeRateStr(item?.tsuat || item?.ltsuat);
      if (r) foundRates.add(r);
    });
    if (foundRates.size === 1) {
      const single = Array.from(foundRates)[0];
      return PALETTE[single];
    }
    if (foundRates.size > 1) {
      return {
        ...PALETTE['MULTI'],
        label: Array.from(foundRates).join('+')
      };
    }
  }

  // 2. Kiểm tra trường thue_suat / tsuat trực tiếp nếu có
  const directRate = normalizeRateStr(inv.thue_suat || inv.raw_data?.tsuat || inv.raw_data?.ltsuat);
  if (directRate && PALETTE[directRate]) {
    return PALETTE[directRate];
  }

  // 3. Nội suy chính xác từ Tiền chưa thuế và Tiền thuế GTGT
  const chuaThue = Number(inv.tong_tien_chua_thue) || 0;
  const tienThue = Number(inv.tong_tien_thue) || 0;

  if (tienThue <= 0) {
    return PALETTE['0%'];
  }

  if (chuaThue > 0) {
    const ratio = (tienThue / chuaThue) * 100;
    if (Math.abs(ratio - 5) <= 1.2) return PALETTE['5%'];
    if (Math.abs(ratio - 8) <= 1.3) return PALETTE['8%'];
    if (Math.abs(ratio - 10) <= 1.6) return PALETTE['10%'];
    return {
      ...PALETTE['MULTI'],
      label: `${ratio.toFixed(1)}%`
    };
  }

  return PALETTE['10%'];
}

export async function exportInvoicesToExcel({
  purchaseInvoices = [],
  soldInvoices = [],
  mst = '',
  quarter = '1',
  month = null,
  year = '2026',
  companyName = '',
  customPeriodLabel = null
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LTP Soft - TaxInvoice Sync Pro';
  workbook.created = new Date();

  let periodDisplay = customPeriodLabel;
  if (!periodDisplay) {
    if (month) {
      periodDisplay = `THÁNG ${month}/${year}`;
    } else if (quarter) {
      periodDisplay = `QUÝ ${quarter}/${year}`;
    } else {
      periodDisplay = `NĂM ${year}`;
    }
  }

  const HEADER_FILL = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E79' }
  };

  const HEADER_FONT = {
    name: 'Times New Roman',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' }
  };

  const WARNING_FILL = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFF2CC' }
  };

  const WARNING_FONT = {
    name: 'Times New Roman',
    size: 10,
    italic: true,
    color: { argb: 'FFC00000' }
  };

  const REJECTED_CODE_FILL = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFEBEE' }
  };

  const REJECTED_CODE_FONT = {
    name: 'Times New Roman',
    size: 10,
    bold: true,
    color: { argb: 'FFFF0000' }
  };

  const THIN_BORDER = {
    top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
  };

  const TOTAL_FILL = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2EFDA' }
  };

  // Cấu hình 19 cột (Cột R = Kết quả kiểm tra hóa đơn, Cột S = Ghi chú kê khai)
  const getColumnsConfig = (isPurchase) => [
    { header: 'STT', key: 'stt', width: 8, alignment: { horizontal: 'center' } },
    { header: 'Loại HĐ', key: 'loai_hoa_don', width: 16, alignment: { horizontal: 'center' } },
    { header: 'Ký hiệu mẫu', key: 'ky_hieu_mau_so', width: 13, alignment: { horizontal: 'center' } },
    { header: 'Ký hiệu HĐ', key: 'ky_hieu_hoa_don', width: 14, alignment: { horizontal: 'center' } },
    { header: 'Số hóa đơn', key: 'so_hoa_don', width: 14, alignment: { horizontal: 'center' } },
    { header: 'Ngày lập', key: 'ngay_lap', width: 14, alignment: { horizontal: 'center' } },
    { header: isPurchase ? 'MST Người bán' : 'MST Người mua', key: 'mst_doi_tac', width: 16, alignment: { horizontal: 'center' } },
    { header: isPurchase ? 'Tên Người bán' : 'Tên Người mua', key: 'ten_doi_tac', width: 36, alignment: { horizontal: 'left' } },
    { header: 'Địa chỉ', key: 'dia_chi', width: 38, alignment: { horizontal: 'left' } },
    { header: 'Tiền chưa thuế', key: 'tong_tien_chua_thue', width: 18, alignment: { horizontal: 'right' }, numFmt: '#,##0' },
    { header: 'Thuế suất', key: 'thue_suat', width: 13, alignment: { horizontal: 'center' } },
    { header: 'Tiền thuế GTGT', key: 'tong_tien_thue', width: 16, alignment: { horizontal: 'right' }, numFmt: '#,##0' },
    { header: 'Chiết khấu', key: 'tong_tien_chiet_khau', width: 15, alignment: { horizontal: 'right' }, numFmt: '#,##0' },
    { header: 'Tổng thanh toán', key: 'tong_tien_thanh_toan', width: 20, alignment: { horizontal: 'right' }, numFmt: '#,##0' },
    { header: 'Loại tiền', key: 'don_vi_tien_te', width: 10, alignment: { horizontal: 'center' } },
    { header: 'Tỷ giá', key: 'ty_gia', width: 10, alignment: { horizontal: 'right' }, numFmt: '#,##0.00' },
    { header: 'Trạng thái HĐ', key: 'trang_thai_nhan', width: 20, alignment: { horizontal: 'left' } },
    { header: 'Kết quả kiểm tra hóa đơn', key: 'ket_qua_kiem_tra', width: 28, alignment: { horizontal: 'left' } },
    { header: 'Ghi chú kê khai', key: 'ghi_chu', width: 26, alignment: { horizontal: 'left' } }
  ];

  // Helper build từng Sheet (Mua_Vao / Ban_Ra)
  const buildSheet = (sheetName, titleText, invoices, isPurchase) => {
    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ showGridLines: true }]
    });

    // 1. Tiêu đề công ty & bảng kê
    sheet.mergeCells('A1:S1');
    const titleRow = sheet.getCell('A1');
    titleRow.value = titleText.toUpperCase();
    titleRow.font = { name: 'Times New Roman', size: 16, bold: true, color: { argb: 'FF1F4E79' } };
    titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 32;

    sheet.mergeCells('A2:S2');
    const subTitle = sheet.getCell('A2');
    subTitle.value = `Mã số thuế: ${mst} | Kỳ kê khai: ${periodDisplay} | Ngày xuất file: ${new Date().toLocaleDateString('vi-VN')}`;
    subTitle.font = { name: 'Times New Roman', size: 11, italic: true };
    subTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 20;

    sheet.mergeCells('A3:S3');
    const noteCell = sheet.getCell('A3');
    noteCell.value = '(* Thuế suất: [Xám: 0%] • [Xanh dương: 5%] • [Xanh lá: 8%] • [Cam nhạt: 10%] | Chữ đỏ đậm: "Hóa đơn không đủ điều kiện cấp mã" — Tự động loại trừ khỏi Tổng hợp lệ bằng hàm =SUMIF / =SUMIFS)';
    noteCell.font = { name: 'Times New Roman', size: 10, italic: true, color: { argb: 'FFC00000' } };
    noteCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(3).height = 18;

    // 2. Dòng Header cột (Dòng 5)
    const headerRowIndex = 5;
    const cols = getColumnsConfig(isPurchase);
    sheet.getRow(headerRowIndex).height = 28;

    cols.forEach((col, idx) => {
      const cell = sheet.getRow(headerRowIndex).getCell(idx + 1);
      cell.value = col.header;
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = THIN_BORDER;
      sheet.getColumn(idx + 1).width = col.width;
    });

    // 3. Đổ dữ liệu các dòng
    let currentRowIdx = 6;
    let sumChuaThueHopLe = 0;
    let sumThueHopLe = 0;
    let sumChietKhauHopLe = 0;
    let sumThanhToanHopLe = 0;
    let sumChuaThueRejected = 0;
    let sumThueRejected = 0;
    let sumChietKhauRejected = 0;
    let sumThanhToanRejected = 0;
    let sumChuaThueRaw = 0;
    let sumThueRaw = 0;
    let sumChietKhauRaw = 0;
    let sumThanhToanRaw = 0;

    // Thống kê theo từng mức thuế suất (0%, 5%, 8%, 10%)
    const rateStats = {
      '0%': { count: 0, chuaThue: 0, thue: 0, thanhToan: 0, bgArgb: 'FFEDEDED', textArgb: 'FF404040' },
      '5%': { count: 0, chuaThue: 0, thue: 0, thanhToan: 0, bgArgb: 'FFDAEEF3', textArgb: 'FF005A9E' },
      '8%': { count: 0, chuaThue: 0, thue: 0, thanhToan: 0, bgArgb: 'FFE2EFDA', textArgb: 'FF276A3C' },
      '10%': { count: 0, chuaThue: 0, thue: 0, thanhToan: 0, bgArgb: 'FFFCE4D6', textArgb: 'FFC55A11' }
    };

    invoices.forEach((inv, index) => {
      const row = sheet.getRow(currentRowIdx);
      row.height = 22;

      const evalInfo = evaluateInvoiceValidity(inv);
      const isValid = evalInfo.isValid;
      const isRejectedCode = evalInfo.isRejectedCode;

      const tienChuaThue = Number(inv.tong_tien_chua_thue) || 0;
      const tienThue = Number(inv.tong_tien_thue) || 0;
      const chietKhau = Number(inv.tong_tien_chiet_khau) || 0;
      const thanhToan = Number(inv.tong_tien_thanh_toan) || 0;

      const taxRateInfo = detectInvoiceTaxRate(inv);

      sumChuaThueRaw += tienChuaThue;
      sumThueRaw += tienThue;
      sumChietKhauRaw += chietKhau;
      sumThanhToanRaw += thanhToan;

      if (isRejectedCode) {
        sumChuaThueRejected += tienChuaThue;
        sumThueRejected += tienThue;
        sumChietKhauRejected += chietKhau;
        sumThanhToanRejected += thanhToan;
      }

      if (isValid) {
        sumChuaThueHopLe += tienChuaThue;
        sumThueHopLe += tienThue;
        sumChietKhauHopLe += chietKhau;
        sumThanhToanHopLe += thanhToan;

        const bucketKey = rateStats[taxRateInfo.code] ? taxRateInfo.code : '10%';
        rateStats[bucketKey].count += 1;
        rateStats[bucketKey].chuaThue += tienChuaThue;
        rateStats[bucketKey].thue += tienThue;
        rateStats[bucketKey].thanhToan += thanhToan;
      }

      const normalizedDate = formatToVietnamDate(inv.ngay_lap);

      const rowValues = [
        index + 1,
        inv.loai_hoa_don || '',
        inv.ky_hieu_mau_so || '',
        inv.ky_hieu_hoa_don || '',
        inv.so_hoa_don || '',
        normalizedDate,
        isPurchase ? (inv.mst_nguoi_ban || '') : (inv.mst_nguoi_mua || ''),
        isPurchase ? (inv.ten_nguoi_ban || '') : (inv.ten_nguoi_mua || ''),
        isPurchase ? (inv.dia_chi_nguoi_ban || '') : (inv.dia_chi_nguoi_mua || ''),
        tienChuaThue,
        taxRateInfo.label,
        tienThue,
        chietKhau,
        thanhToan,
        inv.don_vi_tien_te || 'VND',
        inv.ty_gia || 1,
        inv.trang_thai_nhan || 'Hóa đơn mới',
        evalInfo.checkResultLabel,
        evalInfo.ghiChuKeKhai
      ];

      rowValues.forEach((val, valIdx) => {
        const cell = row.getCell(valIdx + 1);
        cell.value = val;

        if (isRejectedCode) {
          // Hóa đơn không đủ điều kiện cấp mã -> Tô chữ ĐỎ ĐẬM + nền cảnh báo đỏ nhạt
          cell.font = REJECTED_CODE_FONT;
          cell.fill = REJECTED_CODE_FILL;
        } else if (!isValid) {
          cell.font = WARNING_FONT;
          cell.fill = WARNING_FILL;
        } else if (valIdx === 10) {
          // Cột K (valIdx === 10): Bôi màu nổi bật nhãn Thuế suất (0%, 5%, 8%, 10%)
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: taxRateInfo.bgArgb }
          };
          cell.font = {
            name: 'Times New Roman',
            size: 10,
            bold: true,
            color: { argb: taxRateInfo.textArgb }
          };
        } else if (valIdx === 17) {
          // Cột R (valIdx === 17): "Đã cấp mã hóa đơn"
          cell.font = {
            name: 'Times New Roman',
            size: 10,
            bold: true,
            color: { argb: 'FF276A3C' }
          };
        } else if (valIdx === 9 || valIdx === 11 || valIdx === 13) {
          // Bôi màu nền dịu đồng bộ cho các cột Tiền chưa thuế, Tiền thuế GTGT, Tổng thanh toán
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: taxRateInfo.rowTintArgb }
          };
          cell.font = {
            name: 'Times New Roman',
            size: 10,
            bold: valIdx === 13
          };
        } else {
          cell.font = { name: 'Times New Roman', size: 10 };
        }

        cell.border = THIN_BORDER;
        cell.alignment = {
          vertical: 'middle',
          horizontal: cols[valIdx].alignment.horizontal,
          wrapText: valIdx === 7 || valIdx === 8 || valIdx === 17
        };

        if (cols[valIdx].numFmt) {
          cell.numFmt = cols[valIdx].numFmt;
        }
      });

      currentRowIdx++;
    });

    const startRow = 6;
    const endRow = currentRowIdx - 1;
    const hasData = endRow >= startRow;

    // 4.1. Dòng TỔNG CỘNG TOÀN BỘ PHÁT SINH (Công thức =SUM)
    const rawTotalRowIdx = currentRowIdx;
    const rawTotalRow = sheet.getRow(rawTotalRowIdx);
    rawTotalRow.height = 24;
    sheet.mergeCells(`A${rawTotalRowIdx}:I${rawTotalRowIdx}`);
    const rawLabelCell = rawTotalRow.getCell(1);
    rawLabelCell.value = 'TỔNG CỘNG TOÀN BỘ PHÁT SINH (CÔNG THỨC =SUM):';
    rawLabelCell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FF333333' } };
    rawLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

    const RAW_TOTAL_FILL = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF2F4F7' }
    };

    for (let c = 1; c <= 19; c++) {
      rawTotalRow.getCell(c).fill = RAW_TOTAL_FILL;
      rawTotalRow.getCell(c).border = THIN_BORDER;
    }

    // Cột J (10): Tiền chưa thuế
    const rawChuaThue = rawTotalRow.getCell(10);
    rawChuaThue.value = hasData ? { formula: `SUM(J${startRow}:J${endRow})`, result: sumChuaThueRaw } : 0;
    rawChuaThue.numFmt = '#,##0';
    rawChuaThue.font = { name: 'Times New Roman', size: 10, bold: true };

    // Cột K (11): Thuế suất
    rawTotalRow.getCell(11).value = '-';
    rawTotalRow.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };

    // Cột L (12): Tiền thuế GTGT
    const rawThue = rawTotalRow.getCell(12);
    rawThue.value = hasData ? { formula: `SUM(L${startRow}:L${endRow})`, result: sumThueRaw } : 0;
    rawThue.numFmt = '#,##0';
    rawThue.font = { name: 'Times New Roman', size: 10, bold: true };

    // Cột M (13): Chiết khấu
    const rawChietKhau = rawTotalRow.getCell(13);
    rawChietKhau.value = hasData ? { formula: `SUM(M${startRow}:M${endRow})`, result: sumChietKhauRaw } : 0;
    rawChietKhau.numFmt = '#,##0';
    rawChietKhau.font = { name: 'Times New Roman', size: 10, bold: true };

    // Cột N (14): Tổng thanh toán
    const rawThanhToan = rawTotalRow.getCell(14);
    rawThanhToan.value = hasData ? { formula: `SUM(N${startRow}:N${endRow})`, result: sumThanhToanRaw } : 0;
    rawThanhToan.numFmt = '#,##0';
    rawThanhToan.font = { name: 'Times New Roman', size: 10, bold: true };

    currentRowIdx++;

    // 4.1b. Dòng TỔNG HÓA ĐƠN KHÔNG ĐỦ ĐIỀU KIỆN CẤP MÃ BỊ LOẠI TRỪ (Công thức =SUMIF theo cột R "Kết quả kiểm tra hóa đơn")
    const rejectedTotalRowIdx = currentRowIdx;
    const rejectedTotalRow = sheet.getRow(rejectedTotalRowIdx);
    rejectedTotalRow.height = 24;
    sheet.mergeCells(`A${rejectedTotalRowIdx}:I${rejectedTotalRowIdx}`);
    const rejLabelCell = rejectedTotalRow.getCell(1);
    rejLabelCell.value = 'TỔNG HĐ "KHÔNG ĐỦ ĐIỀU KIỆN CẤP MÃ" BỊ LOẠI TRỪ (=SUMIF CỘT KẾT QUẢ KIỂM TRA HĐ):';
    rejLabelCell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FFFF0000' } };
    rejLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

    for (let c = 1; c <= 19; c++) {
      rejectedTotalRow.getCell(c).fill = REJECTED_CODE_FILL;
      rejectedTotalRow.getCell(c).border = THIN_BORDER;
    }

    const rejChuaThue = rejectedTotalRow.getCell(10);
    rejChuaThue.value = hasData ? { formula: `SUMIF($R$${startRow}:$R$${endRow},"Hóa đơn không đủ điều kiện cấp mã",J${startRow}:J${endRow})`, result: sumChuaThueRejected } : 0;
    rejChuaThue.numFmt = '#,##0';
    rejChuaThue.font = REJECTED_CODE_FONT;

    rejectedTotalRow.getCell(11).value = '-';
    rejectedTotalRow.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };
    rejectedTotalRow.getCell(11).font = REJECTED_CODE_FONT;

    const rejThue = rejectedTotalRow.getCell(12);
    rejThue.value = hasData ? { formula: `SUMIF($R$${startRow}:$R$${endRow},"Hóa đơn không đủ điều kiện cấp mã",L${startRow}:L${endRow})`, result: sumThueRejected } : 0;
    rejThue.numFmt = '#,##0';
    rejThue.font = REJECTED_CODE_FONT;

    const rejChietKhau = rejectedTotalRow.getCell(13);
    rejChietKhau.value = hasData ? { formula: `SUMIF($R$${startRow}:$R$${endRow},"Hóa đơn không đủ điều kiện cấp mã",M${startRow}:M${endRow})`, result: sumChietKhauRejected } : 0;
    rejChietKhau.numFmt = '#,##0';
    rejChietKhau.font = REJECTED_CODE_FONT;

    const rejThanhToan = rejectedTotalRow.getCell(14);
    rejThanhToan.value = hasData ? { formula: `SUMIF($R$${startRow}:$R$${endRow},"Hóa đơn không đủ điều kiện cấp mã",N${startRow}:N${endRow})`, result: sumThanhToanRejected } : 0;
    rejThanhToan.numFmt = '#,##0';
    rejThanhToan.font = REJECTED_CODE_FONT;

    rejectedTotalRow.getCell(18).value = 'Hóa đơn không đủ điều kiện cấp mã';
    rejectedTotalRow.getCell(18).font = REJECTED_CODE_FONT;
    rejectedTotalRow.getCell(19).value = 'Loại trừ khỏi chi phí/thuế';
    rejectedTotalRow.getCell(19).font = REJECTED_CODE_FONT;

    currentRowIdx++;

    // 4.2. Dòng TỔNG CỘNG HỢP LỆ KÊ KHAI (Công thức =SUMIFS kiểm tra cột R = "Đã cấp mã hóa đơn" và cột S = "Hợp lệ")
    const validTotalRowIdx = currentRowIdx;
    const validTotalRow = sheet.getRow(validTotalRowIdx);
    validTotalRow.height = 26;

    sheet.mergeCells(`A${validTotalRowIdx}:I${validTotalRowIdx}`);
    const totalLabelCell = validTotalRow.getCell(1);
    totalLabelCell.value = 'TỔNG CỘNG HỢP LỆ KÊ KHAI (=SUMIFS LỌC "ĐÃ CẤP MÃ HÓA ĐƠN" & LOẠI TRỪ HĐ HỦY):';
    totalLabelCell.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FF1F4E79' } };
    totalLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

    for (let c = 1; c <= 19; c++) {
      validTotalRow.getCell(c).fill = TOTAL_FILL;
      validTotalRow.getCell(c).border = THIN_BORDER;
    }

    const cellChuaThue = validTotalRow.getCell(10);
    cellChuaThue.value = hasData ? { formula: `SUMIFS(J${startRow}:J${endRow},$R$${startRow}:$R$${endRow},"Đã cấp mã hóa đơn",$S$${startRow}:$S$${endRow},"Hợp lệ")`, result: sumChuaThueHopLe } : 0;
    cellChuaThue.numFmt = '#,##0';
    cellChuaThue.font = { name: 'Times New Roman', size: 11, bold: true };

    validTotalRow.getCell(11).value = 'Tất cả';
    validTotalRow.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };
    validTotalRow.getCell(11).font = { name: 'Times New Roman', size: 10, bold: true };

    const cellThue = validTotalRow.getCell(12);
    cellThue.value = hasData ? { formula: `SUMIFS(L${startRow}:L${endRow},$R$${startRow}:$R$${endRow},"Đã cấp mã hóa đơn",$S$${startRow}:$S$${endRow},"Hợp lệ")`, result: sumThueHopLe } : 0;
    cellThue.numFmt = '#,##0';
    cellThue.font = { name: 'Times New Roman', size: 11, bold: true };

    const cellChietKhau = validTotalRow.getCell(13);
    cellChietKhau.value = hasData ? { formula: `SUMIFS(M${startRow}:M${endRow},$R$${startRow}:$R$${endRow},"Đã cấp mã hóa đơn",$S$${startRow}:$S$${endRow},"Hợp lệ")`, result: sumChietKhauHopLe } : 0;
    cellChietKhau.numFmt = '#,##0';
    cellChietKhau.font = { name: 'Times New Roman', size: 11, bold: true };

    const cellThanhToan = validTotalRow.getCell(14);
    cellThanhToan.value = hasData ? { formula: `SUMIFS(N${startRow}:N${endRow},$R$${startRow}:$R$${endRow},"Đã cấp mã hóa đơn",$S$${startRow}:$S$${endRow},"Hợp lệ")`, result: sumThanhToanHopLe } : 0;
    cellThanhToan.numFmt = '#,##0';
    cellThanhToan.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFC00000' } };

    validTotalRow.getCell(18).value = 'Đã cấp mã hóa đơn';
    validTotalRow.getCell(18).font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FF276A3C' } };
    validTotalRow.getCell(19).value = 'Hợp lệ';
    validTotalRow.getCell(19).font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FF276A3C' } };

    // 4.3. BẢNG PHÂN LOẠI TỔNG HỢP THEO MỨC THUẾ SUẤT (0%, 5%, 8%, 10%) BẰNG CÔNG THỨC =SUMIFS
    currentRowIdx += 2;
    const rateHeaderRow = sheet.getRow(currentRowIdx);
    rateHeaderRow.height = 24;
    sheet.mergeCells(`H${currentRowIdx}:N${currentRowIdx}`);
    const rateTitleCell = rateHeaderRow.getCell(8);
    rateTitleCell.value = '🎨 BẢNG TỔNG HỢP PHÂN LOẠI THEO MỨC THUẾ SUẤT GTGT (0% • 5% • 8% • 10%)';
    rateTitleCell.font = { name: 'Times New Roman', size: 10.5, bold: true, color: { argb: 'FF1F4E79' } };
    rateTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let c = 8; c <= 14; c++) {
      rateHeaderRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
      rateHeaderRow.getCell(c).border = THIN_BORDER;
    }
    currentRowIdx++;

    ['0%', '5%', '8%', '10%'].forEach((rateKey) => {
      const rStat = rateStats[rateKey];
      const rRow = sheet.getRow(currentRowIdx);
      rRow.height = 22;

      sheet.mergeCells(`H${currentRowIdx}:I${currentRowIdx}`);
      const labelCell = rRow.getCell(8);
      labelCell.value = `Tổng hợp Hóa đơn hợp lệ mức thuế suất ${rateKey} (${rStat.count} HĐ):`;
      labelCell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: rStat.textArgb } };
      labelCell.alignment = { horizontal: 'right', vertical: 'middle' };

      const rowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rStat.bgArgb } };
      for (let c = 8; c <= 14; c++) {
        rRow.getCell(c).fill = rowFill;
        rRow.getCell(c).border = THIN_BORDER;
      }

      const cChuaThue = rRow.getCell(10);
      cChuaThue.value = hasData
        ? { formula: `SUMIFS(J${startRow}:J${endRow},$R$${startRow}:$R$${endRow},"Đã cấp mã hóa đơn",$S$${startRow}:$S$${endRow},"Hợp lệ",$K$${startRow}:$K$${endRow},"${rateKey}")`, result: rStat.chuaThue }
        : 0;
      cChuaThue.numFmt = '#,##0';
      cChuaThue.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: rStat.textArgb } };

      const cRate = rRow.getCell(11);
      cRate.value = rateKey;
      cRate.alignment = { horizontal: 'center', vertical: 'middle' };
      cRate.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: rStat.textArgb } };

      const cThue = rRow.getCell(12);
      cThue.value = hasData
        ? { formula: `SUMIFS(L${startRow}:L${endRow},$R$${startRow}:$R$${endRow},"Đã cấp mã hóa đơn",$S$${startRow}:$S$${endRow},"Hợp lệ",$K$${startRow}:$K$${endRow},"${rateKey}")`, result: rStat.thue }
        : 0;
      cThue.numFmt = '#,##0';
      cThue.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: rStat.textArgb } };

      const cCk = rRow.getCell(13);
      cCk.value = '-';
      cCk.alignment = { horizontal: 'center', vertical: 'middle' };

      const cThanhToan = rRow.getCell(14);
      cThanhToan.value = hasData
        ? { formula: `SUMIFS(N${startRow}:N${endRow},$R$${startRow}:$R$${endRow},"Đã cấp mã hóa đơn",$S$${startRow}:$S$${endRow},"Hợp lệ",$K$${startRow}:$K$${endRow},"${rateKey}")`, result: rStat.thanhToan }
        : 0;
      cThanhToan.numFmt = '#,##0';
      cThanhToan.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: rStat.textArgb } };

      currentRowIdx++;
    });

    return {
      startRow,
      endRow,
      rawTotalRowIdx,
      rejectedTotalRowIdx,
      validTotalRowIdx,
      sumChuaThueRaw,
      sumThueRaw,
      sumChietKhauRaw,
      sumThanhToanRaw,
      sumChuaThueHopLe,
      sumThueHopLe,
      sumChietKhauHopLe,
      sumThanhToanHopLe,
      rateStats
    };
  };

  // Tạo Sheet 1: Mua Vào
  const purchaseMeta = buildSheet(
    'Mua_Vao',
    `BẢNG KÊ HÓA ĐƠN CHỨNG TỪ HÀNG HÓA DỊCH VỤ MUA VÀO (${periodDisplay})`,
    purchaseInvoices,
    true
  );

  // Tạo Sheet 2: Bán Ra
  const soldMeta = buildSheet(
    'Ban_Ra',
    `BẢNG KÊ HÓA ĐƠN CHỨNG TỪ HÀNG HÓA DỊCH VỤ BÁN RA (${periodDisplay})`,
    soldInvoices,
    false
  );

  // Tạo Sheet 3: Bảng Tổng Hợp Nghĩa Vụ Thuế & Đối Soát Chứng Từ Ngân Hàng
  const buildSummaryTaxSheet = () => {
    const sheet = workbook.addWorksheet('Tong_Hop_Thue', {
      views: [{ showGridLines: true }]
    });

    sheet.mergeCells('A1:J1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `BẢNG TỔNG HỢP NGHĨA VỤ THUẾ GTGT & ĐỐI SOÁT CHỨNG TỪ NGÂN HÀNG (${periodDisplay})`;
    titleCell.font = { name: 'Times New Roman', size: 15, bold: true, color: { argb: 'FF1F4E79' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 32;

    sheet.mergeCells('A2:J2');
    const subTitle = sheet.getCell('A2');
    subTitle.value = `DOANH NGHIỆP: ${companyName ? companyName.toUpperCase() : 'DOANH NGHIỆP'} - MÃ SỐ THUẾ: ${mst || 'Chưa cập nhật'}`;
    subTitle.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FF333333' } };
    subTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 20;

    sheet.mergeCells('A3:J3');
    const noteCell = sheet.getCell('A3');
    noteCell.value = `(Tự động tính thuế GTGT phải nộp / còn được khấu trừ, phân loại thuế suất 0% - 5% - 8% - 10% & lọc hóa đơn từ 5 triệu bắt buộc chuyển khoản)`;
    noteCell.font = { name: 'Times New Roman', size: 10, italic: true, color: { argb: 'FF7F7F7F' } };
    noteCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(3).height = 18;

    // PHẦN I: TỔNG HỢP NGHĨA VỤ THUẾ GTGT TRONG KỲ
    sheet.mergeCells('A5:J5');
    const sec1 = sheet.getCell('A5');
    sec1.value = 'I. TỔNG HỢP NGHĨA VỤ THUẾ GIÁ TRỊ GIA TĂNG (GTGT) TRONG KỲ';
    sec1.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FF1F4E79' } };
    sec1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
    sec1.alignment = { vertical: 'middle', indent: 1 };
    sheet.getRow(5).height = 24;

    const summaryHeaders = [
      { h: 'STT', w: 8, align: 'center' },
      { h: 'Nội Dung Chỉ Tiêu', w: 42, align: 'left' },
      { h: 'Ký Hiệu / Nguồn', w: 18, align: 'center' },
      { h: 'Giá Trị Chưa Thuế (VND)', w: 26, align: 'right' },
      { h: 'Tiền Thuế GTGT (VND)', w: 26, align: 'right' },
      { h: 'Ghi Chú Kế Toán', w: 32, align: 'left' }
    ];

    sheet.getRow(6).height = 26;
    summaryHeaders.forEach((col, idx) => {
      const cell = sheet.getRow(6).getCell(idx + 1);
      cell.value = col.h;
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = THIN_BORDER;
      sheet.getColumn(idx + 1).width = col.w;
    });

    // Dòng 7: Thuế GTGT Đầu Ra (Cột J là Tiền chưa thuế, Cột L là Tiền thuế GTGT bên Sheet Ban_Ra)
    const row7 = sheet.getRow(7);
    row7.height = 22;
    row7.getCell(1).value = '1';
    row7.getCell(2).value = 'Tổng Thuế GTGT Đầu Ra (Hóa Đơn Bán Ra Hợp Lệ)';
    row7.getCell(3).value = 'Sheet Ban_Ra';
    row7.getCell(4).value = { formula: `'Ban_Ra'!J${soldMeta.validTotalRowIdx}`, result: soldMeta.sumChuaThueHopLe };
    row7.getCell(5).value = { formula: `'Ban_Ra'!L${soldMeta.validTotalRowIdx}`, result: soldMeta.sumThueHopLe };
    row7.getCell(6).value = 'Căn cứ kê khai thuế GTGT bán ra';

    // Dòng 8: Thuế GTGT Đầu Vào (Cột J là Tiền chưa thuế, Cột L là Tiền thuế GTGT bên Sheet Mua_Vao)
    const row8 = sheet.getRow(8);
    row8.height = 22;
    row8.getCell(1).value = '2';
    row8.getCell(2).value = 'Tổng Thuế GTGT Đầu Vào Được Khấu Trừ (HĐ Mua Vào Hợp Lệ)';
    row8.getCell(3).value = 'Sheet Mua_Vao';
    row8.getCell(4).value = { formula: `'Mua_Vao'!J${purchaseMeta.validTotalRowIdx}`, result: purchaseMeta.sumChuaThueHopLe };
    row8.getCell(5).value = { formula: `'Mua_Vao'!L${purchaseMeta.validTotalRowIdx}`, result: purchaseMeta.sumThueHopLe };
    row8.getCell(6).value = 'Đã loại trừ HĐ hủy/thay thế & HĐ không đủ điều kiện cấp mã';

    const netTax = soldMeta.sumThueHopLe - purchaseMeta.sumThueHopLe;
    const isPayable = netTax > 0;
    const row9 = sheet.getRow(9);
    row9.height = 26;
    row9.getCell(1).value = '3';
    row9.getCell(2).value = 'CHÊNH LỆCH THUẾ GTGT TRONG KỲ (= Đầu Ra - Đầu Vào):';
    row9.getCell(2).font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FF1F4E79' } };
    row9.getCell(3).value = '= E7 - E8';
    row9.getCell(4).value = '-';
    row9.getCell(5).value = { formula: 'E7-E8', result: netTax };
    row9.getCell(5).font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: isPayable ? 'FFC00000' : 'FF375623' } };
    row9.getCell(6).value = isPayable ? 'Phát sinh thuế phải nộp' : 'Được khấu trừ chuyển kỳ sau';

    const row10 = sheet.getRow(10);
    row10.height = 30;
    sheet.mergeCells('A10:C10');
    row10.getCell(1).value = isPayable ? '👉 SỐ TIỀN THUẾ GTGT PHẢI NỘP VÀO NGÂN SÁCH:' : '👉 SỐ THUẾ GTGT CÒN ĐƯỢC KHẤU TRỪ CHUYỂN KỲ SAU:';
    row10.getCell(1).font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: isPayable ? 'FFC00000' : 'FF375623' } };
    row10.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };

    row10.getCell(4).value = '-';
    row10.getCell(5).value = { formula: isPayable ? 'E9' : '-E9', result: Math.abs(netTax) };
    row10.getCell(5).font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: isPayable ? 'FFC00000' : 'FF375623' } };
    row10.getCell(6).value = isPayable ? 'Hạn nộp: Ngày 30 của tháng đầu quý sau' : 'Chuyển chỉ tiêu [22] kỳ sau';
    row10.getCell(6).font = { name: 'Times New Roman', size: 10, italic: true };

    const HIGHLIGHT_FILL = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isPayable ? 'FFFCE4D6' : 'FFE2EFDA' }
    };

    for (let r = 7; r <= 10; r++) {
      const rRow = sheet.getRow(r);
      for (let c = 1; c <= 6; c++) {
        const cell = rRow.getCell(c);
        cell.border = THIN_BORDER;
        if (r === 9 || r === 10) cell.fill = HIGHLIGHT_FILL;
        if (c === 1 || c === 3) cell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (c === 4 || c === 5) {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
      }
    }

    // PHẦN II: DANH SÁCH HÓA ĐƠN MUA VÀO TỪ 5 TRIỆU ĐỒNG (BẮT BUỘC CHUYỂN KHOẢN NGÂN HÀNG)
    const validPurchaseList = purchaseInvoices.filter(i => evaluateInvoiceValidity(i).isValid);

    const bankInvoices = validPurchaseList
      .filter(i => (Number(i.tong_tien_thanh_toan) || 0) >= 5000000)
      .sort((a, b) => (Number(b.tong_tien_thanh_toan) || 0) - (Number(a.tong_tien_thanh_toan) || 0));

    const cashInvoices = validPurchaseList
      .filter(i => (Number(i.tong_tien_thanh_toan) || 0) < 5000000);

    sheet.mergeCells('A12:K12');
    const sec2 = sheet.getCell('A12');
    sec2.value = `II. DANH SÁCH HÓA ĐƠN MUA VÀO TỪ 5 TRIỆU ĐỒNG (BẮT BUỘC THANH TOÁN QUA NGÂN HÀNG - ${bankInvoices.length} HÓA ĐƠN)`;
    sec2.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFC00000' } };
    sec2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
    sec2.alignment = { vertical: 'middle', indent: 1 };
    sheet.getRow(12).height = 24;

    sheet.mergeCells('A13:K13');
    const sec2Note = sheet.getCell('A13');
    sec2Note.value = '⚠️ Căn cứ Luật Thuế GTGT sửa đổi (hiệu lực từ 01/07/2025): Hóa đơn từ 5.000.000đ trở lên bắt buộc phải có chứng từ thanh toán không dùng tiền mặt (Ủy nhiệm chi / Chuyển khoản) thì mới được khấu trừ thuế & tính chi phí hợp lý.';
    sec2Note.font = { name: 'Times New Roman', size: 9.5, italic: true, color: { argb: 'FFC00000' } };
    sheet.getRow(13).height = 18;

    const bankCols = [
      { h: 'STT', w: 8, align: 'center' },
      { h: 'Ký Hiệu HĐ', w: 14, align: 'center' },
      { h: 'Số Hóa Đơn', w: 14, align: 'center' },
      { h: 'Ngày Lập', w: 14, align: 'center' },
      { h: 'MST Người Bán', w: 16, align: 'center' },
      { h: 'Tên Người Bán', w: 36, align: 'left' },
      { h: 'Tiền Chưa Thuế (VND)', w: 22, align: 'right' },
      { h: 'Thuế Suất', w: 13, align: 'center' },
      { h: 'Tiền Thuế GTGT (VND)', w: 20, align: 'right' },
      { h: 'Tổng Thanh Toán (VND)', w: 24, align: 'right' },
      { h: 'Tình Trạng Chứng Từ Ngân Hàng', w: 28, align: 'center' }
    ];

    sheet.getRow(14).height = 26;
    bankCols.forEach((col, idx) => {
      const cell = sheet.getRow(14).getCell(idx + 1);
      cell.value = col.h;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF833C0C' } };
      cell.font = HEADER_FONT;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = THIN_BORDER;
      sheet.getColumn(idx + 1).width = Math.max(sheet.getColumn(idx + 1).width || 0, col.w);
    });

    let bankRowIdx = 15;
    const startBankRow = bankRowIdx;

    if (bankInvoices.length === 0) {
      sheet.mergeCells(`A${bankRowIdx}:K${bankRowIdx}`);
      const emptyBankCell = sheet.getRow(bankRowIdx).getCell(1);
      emptyBankCell.value = 'Không có hóa đơn mua vào nào từ 5.000.000đ trở lên trong kỳ này.';
      emptyBankCell.font = { name: 'Times New Roman', size: 10, italic: true };
      emptyBankCell.alignment = { horizontal: 'center', vertical: 'middle' };
      emptyBankCell.border = THIN_BORDER;
      sheet.getRow(bankRowIdx).height = 24;
      bankRowIdx++;
    } else {
      bankInvoices.forEach((inv, bIdx) => {
        const bRow = sheet.getRow(bankRowIdx);
        bRow.height = 22;
        const rateInfo = detectInvoiceTaxRate(inv);

        const valRow = [
          bIdx + 1,
          inv.ky_hieu_hoa_don || '',
          inv.so_hoa_don || '',
          formatToVietnamDate(inv.ngay_lap),
          inv.mst_nguoi_ban || '',
          inv.ten_nguoi_ban || '',
          Number(inv.tong_tien_chua_thue) || 0,
          rateInfo.label,
          Number(inv.tong_tien_thue) || 0,
          Number(inv.tong_tien_thanh_toan) || 0,
          '[ ] Đã có UNC / Chuyển khoản'
        ];

        valRow.forEach((v, cIdx) => {
          const cell = bRow.getCell(cIdx + 1);
          cell.value = v;
          cell.border = THIN_BORDER;
          cell.font = { name: 'Times New Roman', size: 10 };
          cell.alignment = { vertical: 'middle', horizontal: bankCols[cIdx].align, wrapText: cIdx === 5 };

          if (cIdx === 7) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rateInfo.bgArgb } };
            cell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: rateInfo.textArgb } };
          }
          if (cIdx === 6 || cIdx === 8 || cIdx === 9) {
            cell.numFmt = '#,##0';
            if (cIdx === 9) cell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FFC00000' } };
          }
        });

        bankRowIdx++;
      });
    }

    const endBankRow = bankRowIdx - 1;
    const hasBankData = bankInvoices.length > 0;

    const bankTotalRow = sheet.getRow(bankRowIdx);
    bankTotalRow.height = 26;
    sheet.mergeCells(`A${bankRowIdx}:F${bankRowIdx}`);
    const bankTotalLabel = bankTotalRow.getCell(1);
    bankTotalLabel.value = 'TỔNG CỘNG HÓA ĐƠN BẮT BUỘC CHUYỂN KHOẢN (≥ 5 TRIỆU - CÔNG THỨC =SUM):';
    bankTotalLabel.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FF833C0C' } };
    bankTotalLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    const BANK_TOTAL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
    for (let c = 1; c <= 11; c++) {
      bankTotalRow.getCell(c).fill = BANK_TOTAL_FILL;
      bankTotalRow.getCell(c).border = THIN_BORDER;
    }

    const bankSumChuaThue = bankInvoices.reduce((s, i) => s + (Number(i.tong_tien_chua_thue) || 0), 0);
    const bankSumThue = bankInvoices.reduce((s, i) => s + (Number(i.tong_tien_thue) || 0), 0);
    const bankSumThanhToan = bankInvoices.reduce((s, i) => s + (Number(i.tong_tien_thanh_toan) || 0), 0);

    const bCellChuaThue = bankTotalRow.getCell(7);
    bCellChuaThue.value = hasBankData ? { formula: `SUM(G${startBankRow}:G${endBankRow})`, result: bankSumChuaThue } : 0;
    bCellChuaThue.numFmt = '#,##0';
    bCellChuaThue.font = { name: 'Times New Roman', size: 10, bold: true };

    bankTotalRow.getCell(8).value = '-';
    bankTotalRow.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };

    const bCellThue = bankTotalRow.getCell(9);
    bCellThue.value = hasBankData ? { formula: `SUM(I${startBankRow}:I${endBankRow})`, result: bankSumThue } : 0;
    bCellThue.numFmt = '#,##0';
    bCellThue.font = { name: 'Times New Roman', size: 10, bold: true };

    const bCellThanhToan = bankTotalRow.getCell(10);
    bCellThanhToan.value = hasBankData ? { formula: `SUM(J${startBankRow}:J${endBankRow})`, result: bankSumThanhToan } : 0;
    bCellThanhToan.numFmt = '#,##0';
    bCellThanhToan.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFC00000' } };

    bankTotalRow.getCell(11).value = '-';
    bankTotalRow.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };

    bankRowIdx += 2;

    // PHẦN III: THỐNG KÊ HÓA ĐƠN DƯỚI 5 TRIỆU ĐỒNG
    sheet.mergeCells(`A${bankRowIdx}:K${bankRowIdx}`);
    const sec3 = sheet.getCell(`A${bankRowIdx}`);
    sec3.value = `III. THỐNG KÊ HÓA ĐƠN MUA VÀO DƯỚI 5 TRIỆU ĐỒNG (ĐƯỢC PHÉP DÙNG TIỀN MẶT - ${cashInvoices.length} HÓA ĐƠN)`;
    sec3.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FF1F4E79' } };
    sec3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
    sec3.alignment = { vertical: 'middle', indent: 1 };
    sheet.getRow(bankRowIdx).height = 24;
    bankRowIdx++;

    const cashSumChuaThue = cashInvoices.reduce((s, i) => s + (Number(i.tong_tien_chua_thue) || 0), 0);
    const cashSumThue = cashInvoices.reduce((s, i) => s + (Number(i.tong_tien_thue) || 0), 0);
    const cashSumThanhToan = cashInvoices.reduce((s, i) => s + (Number(i.tong_tien_thanh_toan) || 0), 0);

    const cashSummaryRow = sheet.getRow(bankRowIdx);
    cashSummaryRow.height = 24;
    sheet.mergeCells(`A${bankRowIdx}:F${bankRowIdx}`);
    cashSummaryRow.getCell(1).value = `Tổng cộng ${cashInvoices.length} hóa đơn mua vào dưới 5 triệu đồng:`;
    cashSummaryRow.getCell(1).font = { name: 'Times New Roman', size: 10, bold: true };
    cashSummaryRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };

    for (let c = 1; c <= 11; c++) {
      cashSummaryRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      cashSummaryRow.getCell(c).border = THIN_BORDER;
    }

    const cCell1 = cashSummaryRow.getCell(7);
    cCell1.value = cashSumChuaThue;
    cCell1.numFmt = '#,##0';
    cCell1.font = { name: 'Times New Roman', size: 10, bold: true };

    cashSummaryRow.getCell(8).value = '-';
    cashSummaryRow.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };

    const cCell2 = cashSummaryRow.getCell(9);
    cCell2.value = cashSumThue;
    cCell2.numFmt = '#,##0';
    cCell2.font = { name: 'Times New Roman', size: 10, bold: true };

    const cCell3 = cashSummaryRow.getCell(10);
    cCell3.value = cashSumThanhToan;
    cCell3.numFmt = '#,##0';
    cCell3.font = { name: 'Times New Roman', size: 10, bold: true };

    const cCell4 = cashSummaryRow.getCell(11);
    cCell4.value = 'Được thanh toán tiền mặt';
    cCell4.font = { name: 'Times New Roman', size: 9.5, italic: true };
    cCell4.alignment = { horizontal: 'center', vertical: 'middle' };
  };

  buildSummaryTaxSheet();

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  const cleanPeriod = (periodDisplay || `Quy_${quarter}_${year}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Bang_Ke_Hoa_Don_${cleanPeriod}_MST_${mst || 'DN'}.xlsx`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);

  return fileName;
}
