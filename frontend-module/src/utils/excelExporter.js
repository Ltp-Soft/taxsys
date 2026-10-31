import ExcelJS from 'exceljs';

/**
 * Xuất file Excel 2 Sheet (Mua_Vao, Ban_Ra) chuẩn định dạng kế toán Việt Nam
 * @param {Object} options
 * @param {Array} options.purchaseInvoices - Mảng hóa đơn Mua Vào
 * @param {Array} options.soldInvoices - Mảng hóa đơn Bán Ra
 * @param {string} options.mst - Mã số thuế người dùng
 * @param {string|number} options.quarter - Quý (1, 2, 3, 4 hoặc Tùy chọn)
 * @param {string|number} options.year - Năm
 * @param {string} options.companyName - Tên công ty
 */
// Helper chuẩn hóa ngày giờ sang Múi giờ Việt Nam (Asia/Ho_Chi_Minh GMT+7)
function formatToVietnamDate(dateVal) {
  if (!dateVal) return '';
  const str = String(dateVal).trim();

  // Nếu là dạng ISO từ Cổng thuế (VD: 2024-09-30T17:00:00.000+00:00 hoặc 2024-09-30T17:00:00Z)
  if (str.includes('T') || str.includes('Z') || (str.includes('-') && str.length >= 10)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      return formatter.format(d); // Trả về dạng dd/mm/yyyy chuẩn giờ VN
    }
  }

  // Nếu đã là dạng DD/MM/YYYY thì lấy nguyên
  if (str.includes('/')) {
    const [dPart] = str.split(' ');
    return dPart;
  }

  return str;
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

  // Xác định nhãn kỳ kê khai
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

  // Định nghĩa màu sắc thương hiệu kế toán
  const HEADER_FILL = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E79' } // Dark blue
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
    fgColor: { argb: 'FFFFF2CC' } // Light Yellow warning
  };

  const WARNING_FONT = {
    name: 'Times New Roman',
    size: 10,
    italic: true,
    color: { argb: 'FFC00000' } // Red alert text
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
    fgColor: { argb: 'FFE2EFDA' } // Light green total
  };

  // Cấu hình các cột tiêu chuẩn theo PROJECT_SPEC.md
  const getColumnsConfig = (isPurchase) => [
    { header: 'STT', key: 'stt', width: 8, alignment: { horizontal: 'center' } },
    { header: 'Loại HĐ', key: 'loai_hoa_don', width: 16, alignment: { horizontal: 'center' } },
    { header: 'Ký hiệu mẫu', key: 'ky_hieu_mau_so', width: 14, alignment: { horizontal: 'center' } },
    { header: 'Ký hiệu HĐ', key: 'ky_hieu_hoa_don', width: 14, alignment: { horizontal: 'center' } },
    { header: 'Số hóa đơn', key: 'so_hoa_don', width: 14, alignment: { horizontal: 'center' } },
    { header: 'Ngày lập', key: 'ngay_lap', width: 14, alignment: { horizontal: 'center' } },
    { header: isPurchase ? 'MST Người bán' : 'MST Người mua', key: 'mst_doi_tac', width: 16, alignment: { horizontal: 'center' } },
    { header: isPurchase ? 'Tên Người bán' : 'Tên Người mua', key: 'ten_doi_tac', width: 36, alignment: { horizontal: 'left' } },
    { header: 'Địa chỉ', key: 'dia_chi', width: 40, alignment: { horizontal: 'left' } },
    { header: 'Tiền chưa thuế', key: 'tong_tien_chua_thue', width: 18, alignment: { horizontal: 'right' }, numFmt: '#,##0' },
    { header: 'Tiền thuế GTGT', key: 'tong_tien_thue', width: 16, alignment: { horizontal: 'right' }, numFmt: '#,##0' },
    { header: 'Chiết khấu', key: 'tong_tien_chiet_khau', width: 16, alignment: { horizontal: 'right' }, numFmt: '#,##0' },
    { header: 'Tổng thanh toán', key: 'tong_tien_thanh_toan', width: 20, alignment: { horizontal: 'right' }, numFmt: '#,##0' },
    { header: 'Loại tiền', key: 'don_vi_tien_te', width: 10, alignment: { horizontal: 'center' } },
    { header: 'Tỷ giá', key: 'ty_gia', width: 10, alignment: { horizontal: 'right' }, numFmt: '#,##0.00' },
    { header: 'Trạng thái HĐ', key: 'trang_thai_nhan', width: 22, alignment: { horizontal: 'left' } },
    { header: 'Ghi chú kê khai', key: 'ghi_chu', width: 26, alignment: { horizontal: 'left' } }
  ];

  // Helper build từng Sheet
  const buildSheet = (sheetName, titleText, invoices, isPurchase) => {
    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ showGridLines: true }]
    });

    // 1. Tiêu đề công ty & bảng kê
    sheet.mergeCells('A1:Q1');
    const titleRow = sheet.getCell('A1');
    titleRow.value = titleText.toUpperCase();
    titleRow.font = { name: 'Times New Roman', size: 16, bold: true, color: { argb: 'FF1F4E79' } };
    titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 32;

    sheet.mergeCells('A2:Q2');
    const subTitle = sheet.getCell('A2');
    subTitle.value = `Mã số thuế: ${mst} | Kỳ kê khai: Quý ${quarter}/${year} | Ngày xuất file: ${new Date().toLocaleDateString('vi-VN')}`;
    subTitle.font = { name: 'Times New Roman', size: 11, italic: true };
    subTitle.alignment = { horizontal: 'center' };
    sheet.getRow(2).height = 20;

    sheet.mergeCells('A3:Q3');
    const noteCell = sheet.getCell('A3');
    noteCell.value = '(* Hóa đơn bị hủy hoặc bị thay thế được tô nền vàng và loại trừ khỏi dòng TỔNG CỘNG hợp lệ)';
    noteCell.font = { name: 'Times New Roman', size: 10, italic: true, color: { argb: 'FF7F7F7F' } };
    noteCell.alignment = { horizontal: 'center' };
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
    let sumChuaThueRaw = 0;
    let sumThueRaw = 0;
    let sumChietKhauRaw = 0;
    let sumThanhToanRaw = 0;

    invoices.forEach((inv, index) => {
      const row = sheet.getRow(currentRowIdx);
      row.height = 22;

      const isValid = inv.is_valid_for_tax !== false && inv.trang_thai_hoa_don !== '4' && inv.trang_thai_hoa_don !== '6';
      
      const tienChuaThue = Number(inv.tong_tien_chua_thue) || 0;
      const tienThue = Number(inv.tong_tien_thue) || 0;
      const chietKhau = Number(inv.tong_tien_chiet_khau) || 0;
      const thanhToan = Number(inv.tong_tien_thanh_toan) || 0;

      // Cộng dồn kết quả tính toán sẵn để hiển thị ngay khi mở file
      sumChuaThueRaw += tienChuaThue;
      sumThueRaw += tienThue;
      sumChietKhauRaw += chietKhau;
      sumThanhToanRaw += thanhToan;

      if (isValid) {
        sumChuaThueHopLe += tienChuaThue;
        sumThueHopLe += tienThue;
        sumChietKhauHopLe += chietKhau;
        sumThanhToanHopLe += thanhToan;
      }

      // Chuẩn hóa ngày lập theo giờ Việt Nam
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
        tienThue,
        chietKhau,
        thanhToan,
        inv.don_vi_tien_te || 'VND',
        inv.ty_gia || 1,
        inv.trang_thai_nhan || '',
        isValid ? 'Hợp lệ' : 'Đã hủy/thay thế (Không kê khai)'
      ];

      rowValues.forEach((val, valIdx) => {
        const cell = row.getCell(valIdx + 1);
        cell.value = val;
        cell.font = isValid 
          ? { name: 'Times New Roman', size: 10 } 
          : WARNING_FONT;

        if (!isValid) {
          cell.fill = WARNING_FILL;
        }

        cell.border = THIN_BORDER;
        cell.alignment = {
          vertical: 'middle',
          horizontal: cols[valIdx].alignment.horizontal,
          wrapText: valIdx === 7 || valIdx === 8 // wrap tên và địa chỉ
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

    // 4.1. Dòng TỔNG CỘNG TOÀN BỘ PHÁT SINH (Có công thức =SUM(...) để kế toán kiểm tra)
    const rawTotalRow = sheet.getRow(currentRowIdx);
    rawTotalRow.height = 24;
    sheet.mergeCells(`A${currentRowIdx}:I${currentRowIdx}`);
    const rawLabelCell = rawTotalRow.getCell(1);
    rawLabelCell.value = 'TỔNG CỘNG TOÀN BỘ PHÁT SINH (CÔNG THỨC =SUM):';
    rawLabelCell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FF333333' } };
    rawLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

    const RAW_TOTAL_FILL = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF2F4F7' }
    };

    for (let c = 1; c <= 9; c++) {
      rawTotalRow.getCell(c).fill = RAW_TOTAL_FILL;
      rawTotalRow.getCell(c).border = THIN_BORDER;
    }

    // Gán công thức =SUM() vào từng cột tiền
    const rawChuaThue = rawTotalRow.getCell(10);
    rawChuaThue.value = hasData ? { formula: `SUM(J${startRow}:J${endRow})`, result: sumChuaThueRaw } : 0;
    rawChuaThue.numFmt = '#,##0';
    rawChuaThue.font = { name: 'Times New Roman', size: 10, bold: true };
    rawChuaThue.fill = RAW_TOTAL_FILL;
    rawChuaThue.border = THIN_BORDER;

    const rawThue = rawTotalRow.getCell(11);
    rawThue.value = hasData ? { formula: `SUM(K${startRow}:K${endRow})`, result: sumThueRaw } : 0;
    rawThue.numFmt = '#,##0';
    rawThue.font = { name: 'Times New Roman', size: 10, bold: true };
    rawThue.fill = RAW_TOTAL_FILL;
    rawThue.border = THIN_BORDER;

    const rawChietKhau = rawTotalRow.getCell(12);
    rawChietKhau.value = hasData ? { formula: `SUM(L${startRow}:L${endRow})`, result: sumChietKhauRaw } : 0;
    rawChietKhau.numFmt = '#,##0';
    rawChietKhau.font = { name: 'Times New Roman', size: 10, bold: true };
    rawChietKhau.fill = RAW_TOTAL_FILL;
    rawChietKhau.border = THIN_BORDER;

    const rawThanhToan = rawTotalRow.getCell(13);
    rawThanhToan.value = hasData ? { formula: `SUM(M${startRow}:M${endRow})`, result: sumThanhToanRaw } : 0;
    rawThanhToan.numFmt = '#,##0';
    rawThanhToan.font = { name: 'Times New Roman', size: 10, bold: true };
    rawThanhToan.fill = RAW_TOTAL_FILL;
    rawThanhToan.border = THIN_BORDER;

    for (let c = 14; c <= 17; c++) {
      const emptyCell = rawTotalRow.getCell(c);
      emptyCell.fill = RAW_TOTAL_FILL;
      emptyCell.border = THIN_BORDER;
    }

    currentRowIdx++;

    // 4.2. Dòng TỔNG CỘNG HỢP LỆ (Có công thức =SUMIF(...) tự động loại bỏ hóa đơn hủy)
    const validTotalRow = sheet.getRow(currentRowIdx);
    validTotalRow.height = 26;

    sheet.mergeCells(`A${currentRowIdx}:I${currentRowIdx}`);
    const totalLabelCell = validTotalRow.getCell(1);
    totalLabelCell.value = 'TỔNG CỘNG HỢP LỆ KÊ KHAI (CÔNG THỨC =SUMIF LOẠI TRỪ HÓA ĐƠN HỦY):';
    totalLabelCell.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FF1F4E79' } };
    totalLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

    for (let c = 1; c <= 9; c++) {
      validTotalRow.getCell(c).fill = TOTAL_FILL;
      validTotalRow.getCell(c).border = THIN_BORDER;
    }

    // Gán công thức =SUMIF($Q$6:$Q$..., "Hợp lệ", J$6:J$...)
    const cellChuaThue = validTotalRow.getCell(10);
    cellChuaThue.value = hasData ? { formula: `SUMIF($Q$${startRow}:$Q$${endRow},"Hợp lệ",J${startRow}:J${endRow})`, result: sumChuaThueHopLe } : 0;
    cellChuaThue.numFmt = '#,##0';
    cellChuaThue.font = { name: 'Times New Roman', size: 11, bold: true };
    cellChuaThue.fill = TOTAL_FILL;
    cellChuaThue.border = THIN_BORDER;

    const cellThue = validTotalRow.getCell(11);
    cellThue.value = hasData ? { formula: `SUMIF($Q$${startRow}:$Q$${endRow},"Hợp lệ",K${startRow}:K${endRow})`, result: sumThueHopLe } : 0;
    cellThue.numFmt = '#,##0';
    cellThue.font = { name: 'Times New Roman', size: 11, bold: true };
    cellThue.fill = TOTAL_FILL;
    cellThue.border = THIN_BORDER;

    const cellChietKhau = validTotalRow.getCell(12);
    cellChietKhau.value = hasData ? { formula: `SUMIF($Q$${startRow}:$Q$${endRow},"Hợp lệ",L${startRow}:L${endRow})`, result: sumChietKhauHopLe } : 0;
    cellChietKhau.numFmt = '#,##0';
    cellChietKhau.font = { name: 'Times New Roman', size: 11, bold: true };
    cellChietKhau.fill = TOTAL_FILL;
    cellChietKhau.border = THIN_BORDER;

    const cellThanhToan = validTotalRow.getCell(13);
    cellThanhToan.value = hasData ? { formula: `SUMIF($Q$${startRow}:$Q$${endRow},"Hợp lệ",M${startRow}:M${endRow})`, result: sumThanhToanHopLe } : 0;
    cellThanhToan.numFmt = '#,##0';
    cellThanhToan.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFC00000' } };
    cellThanhToan.fill = TOTAL_FILL;
    cellThanhToan.border = THIN_BORDER;

    for (let c = 14; c <= 17; c++) {
      const emptyCell = validTotalRow.getCell(c);
      emptyCell.fill = TOTAL_FILL;
      emptyCell.border = THIN_BORDER;
    }
  };

  // Tạo 2 Sheet
  buildSheet(
    'Mua_Vao',
    `BẢNG KÊ HÓA ĐƠN CHỨNG TỪ HÀNG HÓA DỊCH VỤ MUA VÀO (${periodDisplay})`,
    purchaseInvoices,
    true
  );

  buildSheet(
    'Ban_Ra',
    `BẢNG KÊ HÓA ĐƠN CHỨNG TỪ HÀNG HÓA DỊCH VỤ BÁN RA (${periodDisplay})`,
    soldInvoices,
    false
  );

  // Tạo buffer và kích hoạt download trình duyệt
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
