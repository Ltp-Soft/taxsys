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

    return {
      startRow,
      endRow,
      rawTotalRowIdx: currentRowIdx - 1,
      validTotalRowIdx: currentRowIdx,
      sumChuaThueRaw,
      sumThueRaw,
      sumChietKhauRaw,
      sumThanhToanRaw,
      sumChuaThueHopLe,
      sumThueHopLe,
      sumChietKhauHopLe,
      sumThanhToanHopLe
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

    // 1. Tiêu đề chính
    sheet.mergeCells('A1:I1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `BẢNG TỔNG HỢP NGHĨA VỤ THUẾ GTGT & ĐỐI SOÁT CHỨNG TỪ NGÂN HÀNG (${periodDisplay})`;
    titleCell.font = { name: 'Times New Roman', size: 15, bold: true, color: { argb: 'FF1F4E79' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 32;

    sheet.mergeCells('A2:I2');
    const subTitle = sheet.getCell('A2');
    subTitle.value = `DOANH NGHIỆP: ${companyName ? companyName.toUpperCase() : 'DOANH NGHIỆP'} - MÃ SỐ THUẾ: ${mst || 'Chưa cập nhật'}`;
    subTitle.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FF333333' } };
    subTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 20;

    sheet.mergeCells('A3:I3');
    const noteCell = sheet.getCell('A3');
    noteCell.value = `(Tự động tính thuế GTGT phải nộp / còn được khấu trừ & Phân loại hóa đơn từ 20 triệu bắt buộc thanh toán qua Ngân hàng)`;
    noteCell.font = { name: 'Times New Roman', size: 10, italic: true, color: { argb: 'FF7F7F7F' } };
    noteCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(3).height = 18;

    // PHẦN I: TỔNG HỢP NGHĨA VỤ THUẾ GTGT TRONG KỲ
    sheet.mergeCells('A5:I5');
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

    // Dòng 7: Thuế GTGT Đầu Ra (Bán ra)
    const row7 = sheet.getRow(7);
    row7.height = 22;
    row7.getCell(1).value = '1';
    row7.getCell(2).value = 'Tổng Thuế GTGT Đầu Ra (Hóa Đơn Bán Ra Hợp Lệ)';
    row7.getCell(3).value = 'Sheet Ban_Ra';
    row7.getCell(4).value = { formula: `'Ban_Ra'!J${soldMeta.validTotalRowIdx}`, result: soldMeta.sumChuaThueHopLe };
    row7.getCell(5).value = { formula: `'Ban_Ra'!K${soldMeta.validTotalRowIdx}`, result: soldMeta.sumThueHopLe };
    row7.getCell(6).value = 'Căn cứ kê khai thuế GTGT bán ra';

    // Dòng 8: Thuế GTGT Đầu Vào (Mua vào)
    const row8 = sheet.getRow(8);
    row8.height = 22;
    row8.getCell(1).value = '2';
    row8.getCell(2).value = 'Tổng Thuế GTGT Đầu Vào Được Khấu Trừ (HĐ Mua Vào Hợp Lệ)';
    row8.getCell(3).value = 'Sheet Mua_Vao';
    row8.getCell(4).value = { formula: `'Mua_Vao'!J${purchaseMeta.validTotalRowIdx}`, result: purchaseMeta.sumChuaThueHopLe };
    row8.getCell(5).value = { formula: `'Mua_Vao'!K${purchaseMeta.validTotalRowIdx}`, result: purchaseMeta.sumThueHopLe };
    row8.getCell(6).value = 'Đã loại trừ hóa đơn hủy/thay thế';

    // Dòng 9: Chênh lệch thuế GTGT trong kỳ (= Đầu ra - Đầu vào)
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

    // Dòng 10: KẾT LUẬN NGHĨA VỤ THUẾ CỤ THỂ
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

    // PHẦN II: BẢNG ĐỐI SOÁT HÓA ĐƠN MUA VÀO TỪ 20 TRIỆU ĐỒNG (BẮT BUỘC CHUYỂN KHOẢN NGÂN HÀNG)
    const validPurchaseList = purchaseInvoices.filter(i => 
      i.is_valid_for_tax !== false && 
      i.trang_thai_hoa_don !== '4' && 
      i.trang_thai_hoa_don !== '6'
    );

    // Hóa đơn >= 20 triệu: Sắp xếp theo giá trị thanh toán giảm dần
    const bankInvoices = validPurchaseList
      .filter(i => (Number(i.tong_tien_thanh_toan) || 0) >= 20000000)
      .sort((a, b) => (Number(b.tong_tien_thanh_toan) || 0) - (Number(a.tong_tien_thanh_toan) || 0));

    // Hóa đơn < 20 triệu
    const cashInvoices = validPurchaseList
      .filter(i => (Number(i.tong_tien_thanh_toan) || 0) < 20000000);

    sheet.mergeCells('A12:I12');
    const sec2 = sheet.getCell('A12');
    sec2.value = `II. DANH SÁCH HÓA ĐƠN MUA VÀO TỪ 20 TRIỆU ĐỒNG (BẮT BUỘC THANH TOÁN QUA NGÂN HÀNG - ${bankInvoices.length} HÓA ĐƠN)`;
    sec2.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFC00000' } };
    sec2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
    sec2.alignment = { vertical: 'middle', indent: 1 };
    sheet.getRow(12).height = 24;

    sheet.mergeCells('A13:I13');
    const sec2Note = sheet.getCell('A13');
    sec2Note.value = '⚠️ Căn cứ Luật Thuế GTGT: Hóa đơn từ 20.000.000đ trở lên bắt buộc phải có chứng từ thanh toán không dùng tiền mặt (Ủy nhiệm chi / Chuyển khoản) thì mới được khấu trừ thuế & tính chi phí hợp lý.';
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
      sheet.mergeCells(`A${bankRowIdx}:J${bankRowIdx}`);
      const emptyBankCell = sheet.getRow(bankRowIdx).getCell(1);
      emptyBankCell.value = 'Không có hóa đơn mua vào nào từ 20.000.000đ trở lên trong kỳ này.';
      emptyBankCell.font = { name: 'Times New Roman', size: 10, italic: true };
      emptyBankCell.alignment = { horizontal: 'center', vertical: 'middle' };
      emptyBankCell.border = THIN_BORDER;
      sheet.getRow(bankRowIdx).height = 24;
      bankRowIdx++;
    } else {
      bankInvoices.forEach((inv, bIdx) => {
        const bRow = sheet.getRow(bankRowIdx);
        bRow.height = 22;

        const valRow = [
          bIdx + 1,
          inv.ky_hieu_hoa_don || '',
          inv.so_hoa_don || '',
          formatToVietnamDate(inv.ngay_lap),
          inv.mst_nguoi_ban || '',
          inv.ten_nguoi_ban || '',
          Number(inv.tong_tien_chua_thue) || 0,
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
          if (cIdx >= 6 && cIdx <= 8) {
            cell.numFmt = '#,##0';
            if (cIdx === 8) cell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FFC00000' } };
          }
        });

        bankRowIdx++;
      });
    }

    const endBankRow = bankRowIdx - 1;
    const hasBankData = bankInvoices.length > 0;

    // Dòng tổng cộng hóa đơn >= 20 triệu (Có công thức =SUM)
    const bankTotalRow = sheet.getRow(bankRowIdx);
    bankTotalRow.height = 26;
    sheet.mergeCells(`A${bankRowIdx}:F${bankRowIdx}`);
    const bankTotalLabel = bankTotalRow.getCell(1);
    bankTotalLabel.value = 'TỔNG CỘNG HÓA ĐƠN BẮT BUỘC CHUYỂN KHOẢN (CÔNG THỨC =SUM):';
    bankTotalLabel.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FF833C0C' } };
    bankTotalLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    const BANK_TOTAL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
    for (let c = 1; c <= 6; c++) {
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
    bCellChuaThue.fill = BANK_TOTAL_FILL;
    bCellChuaThue.border = THIN_BORDER;

    const bCellThue = bankTotalRow.getCell(8);
    bCellThue.value = hasBankData ? { formula: `SUM(H${startBankRow}:H${endBankRow})`, result: bankSumThue } : 0;
    bCellThue.numFmt = '#,##0';
    bCellThue.font = { name: 'Times New Roman', size: 10, bold: true };
    bCellThue.fill = BANK_TOTAL_FILL;
    bCellThue.border = THIN_BORDER;

    const bCellThanhToan = bankTotalRow.getCell(9);
    bCellThanhToan.value = hasBankData ? { formula: `SUM(I${startBankRow}:I${endBankRow})`, result: bankSumThanhToan } : 0;
    bCellThanhToan.numFmt = '#,##0';
    bCellThanhToan.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFC00000' } };
    bCellThanhToan.fill = BANK_TOTAL_FILL;
    bCellThanhToan.border = THIN_BORDER;

    const bCellEmpty = bankTotalRow.getCell(10);
    bCellEmpty.value = '-';
    bCellEmpty.alignment = { horizontal: 'center' };
    bCellEmpty.fill = BANK_TOTAL_FILL;
    bCellEmpty.border = THIN_BORDER;

    bankRowIdx += 2;

    // PHẦN III: THỐNG KÊ HÓA ĐƠN DƯỚI 20 TRIỆU ĐỒNG (TIỀN MẶT / CHUYỂN KHOẢN)
    sheet.mergeCells(`A${bankRowIdx}:I${bankRowIdx}`);
    const sec3 = sheet.getCell(`A${bankRowIdx}`);
    sec3.value = `III. THỐNG KÊ HÓA ĐƠN MUA VÀO DƯỚI 20 TRIỆU ĐỒNG (ĐƯỢC PHÉP DÙNG TIỀN MẶT - ${cashInvoices.length} HÓA ĐƠN)`;
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
    cashSummaryRow.getCell(1).value = `Tổng cộng ${cashInvoices.length} hóa đơn mua vào dưới 20 triệu đồng:`;
    cashSummaryRow.getCell(1).font = { name: 'Times New Roman', size: 10, bold: true };
    cashSummaryRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };

    for (let c = 1; c <= 6; c++) {
      cashSummaryRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      cashSummaryRow.getCell(c).border = THIN_BORDER;
    }

    const cCell1 = cashSummaryRow.getCell(7);
    cCell1.value = cashSumChuaThue;
    cCell1.numFmt = '#,##0';
    cCell1.font = { name: 'Times New Roman', size: 10, bold: true };
    cCell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    cCell1.border = THIN_BORDER;

    const cCell2 = cashSummaryRow.getCell(8);
    cCell2.value = cashSumThue;
    cCell2.numFmt = '#,##0';
    cCell2.font = { name: 'Times New Roman', size: 10, bold: true };
    cCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    cCell2.border = THIN_BORDER;

    const cCell3 = cashSummaryRow.getCell(9);
    cCell3.value = cashSumThanhToan;
    cCell3.numFmt = '#,##0';
    cCell3.font = { name: 'Times New Roman', size: 10, bold: true };
    cCell3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    cCell3.border = THIN_BORDER;

    const cCell4 = cashSummaryRow.getCell(10);
    cCell4.value = 'Được thanh toán tiền mặt';
    cCell4.font = { name: 'Times New Roman', size: 9.5, italic: true };
    cCell4.alignment = { horizontal: 'center' };
    cCell4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    cCell4.border = THIN_BORDER;
  };

  // Tạo Sheet 3: Bảng Tổng Hợp Nghĩa Vụ Thuế & Đối Soát Ngân Hàng
  buildSummaryTaxSheet();

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
