import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FileSpreadsheet, Search, Filter, AlertCircle, CheckCircle, ArrowDownLeft, ArrowUpRight, ShieldAlert, Info, Download } from 'lucide-react';
import { exportInvoicesToExcel } from '../utils/excelExporter';

export default function InvoicePreview({ invoiceData, syncMeta }) {
  const [activeTab, setActiveTab] = useState('purchase'); // 'purchase' | 'sold'
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'valid' | 'invalid'
  const [isExporting, setIsExporting] = useState(false);
  const containerRef = useRef(null);

  const purchaseList = invoiceData?.purchase || [];
  const soldList = invoiceData?.sold || [];
  const totalCount = purchaseList.length + soldList.length;

  // Tự động cuộn xuống khi có dữ liệu mới
  useEffect(() => {
    if (invoiceData && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [invoiceData]);

  // Tính toán tóm tắt
  const stats = useMemo(() => {
    const calc = (list) => {
      const valid = list.filter(i => i.is_valid_for_tax);
      const invalid = list.filter(i => !i.is_valid_for_tax);
      const totalAmount = valid.reduce((sum, i) => sum + (Number(i.tong_tien_thanh_toan) || 0), 0);
      const totalTax = valid.reduce((sum, i) => sum + (Number(i.tong_tien_thue) || 0), 0);
      return { total: list.length, validCount: valid.length, invalidCount: invalid.length, totalAmount, totalTax };
    };

    return {
      purchase: calc(purchaseList),
      sold: calc(soldList)
    };
  }, [purchaseList, soldList]);

  // Lọc danh sách hiện tại
  const currentList = activeTab === 'purchase' ? purchaseList : soldList;

  const filteredList = useMemo(() => {
    return currentList.filter(item => {
      if (statusFilter === 'valid' && !item.is_valid_for_tax) return false;
      if (statusFilter === 'invalid' && item.is_valid_for_tax) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const partnerName = (activeTab === 'purchase' ? item.ten_nguoi_ban : item.ten_nguoi_mua) || '';
        const partnerMst = (activeTab === 'purchase' ? item.mst_nguoi_ban : item.mst_nguoi_mua) || '';
        const invoiceNum = String(item.so_hoa_don || '');

        return partnerName.toLowerCase().includes(term) ||
               partnerMst.includes(term) ||
               invoiceNum.includes(term);
      }
      return true;
    });
  }, [currentList, statusFilter, searchTerm, activeTab]);

  const displayPeriod = syncMeta?.periodLabel || (syncMeta?.month ? `Tháng ${syncMeta.month}/${syncMeta.year}` : (syncMeta?.quarter ? `Quý ${syncMeta.quarter}/${syncMeta.year}` : `Năm ${syncMeta?.year}`));

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const fileName = await exportInvoicesToExcel({
        purchaseInvoices: purchaseList,
        soldInvoices: soldList,
        mst: syncMeta?.mst || 'DOANH_NGHIEP',
        quarter: syncMeta?.quarter || '4',
        month: syncMeta?.month || null,
        year: syncMeta?.year || '2025',
        companyName: syncMeta?.companyName || '',
        customPeriodLabel: displayPeriod
      });
      alert(`Đã tải xuống thành công file: ${fileName}`);
    } catch (err) {
      console.error('Export Excel failed:', err);
      alert('Không thể tạo file Excel: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Nếu chưa chạy sync lần nào thì không hiện
  if (!invoiceData) {
    return null;
  }

  return (
    <div ref={containerRef} className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 sm:p-7 shadow-2xl mb-8 transition-all">
      {/* Header & Export button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800 pb-5 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-black text-white">
              Kết Quả Đồng Bộ Hóa Đơn ({displayPeriod} - MST {syncMeta?.mst})
            </h2>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold px-3 py-1 rounded-full">
              Tìm thấy {totalCount} hóa đơn
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dữ liệu tổng hợp trực tiếp từ Cổng Thuế Tổng Cục Thuế. Xuất file Excel 2 Sheet Mua Vào & Bán Ra kèm công thức =SUM() và =SUMIF() chuẩn kiểm toán.
          </p>
        </div>

        <button
          onClick={handleExportExcel}
          disabled={isExporting}
          className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/30 px-6 py-3 rounded-2xl text-xs font-black transition"
        >
          <Download className="w-4 h-4" />
          {isExporting ? 'Đang tạo Excel...' : 'Tải File Excel (.xlsx) 2 Sheet (Kèm Công Thức)'}
        </button>
      </div>

      {/* Thông báo bộ lọc thông minh Smart Date */}
      {syncMeta?.summary?.out_of_period_count > 0 && (
        <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-2xl p-4 mb-5 flex items-center gap-3 text-xs text-emerald-300">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>Bảo Vệ Số Liệu Smart Date:</strong> Đã chuyển đổi múi giờ chuẩn Việt Nam (GMT+7) và tự động loại bỏ <strong>{syncMeta.summary.out_of_period_count}</strong> hóa đơn sai kỳ (ví dụ hóa đơn 30/09 trong Quý 4) để bảng kê kế toán không bị kê khai trùng.
          </span>
        </div>
      )}

      {/* Trường hợp không có hóa đơn nào trong Quý */}
      {totalCount === 0 ? (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-6 text-center mb-6">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Info className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-amber-900 mb-1">
            Không tìm thấy hóa đơn nào trong Quý {syncMeta?.quarter}/{syncMeta?.year}
          </h3>
          <p className="text-xs text-amber-700 max-w-lg mx-auto mb-4 leading-relaxed">
            Doanh nghiệp MST <strong>{syncMeta?.mst}</strong> không phát sinh hóa đơn Mua Vào hoặc Bán Ra nào trong khoảng thời gian này trên trang Tổng Cục Thuế.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleExportExcel}
              className="text-xs font-bold text-emerald-700 bg-white border border-emerald-300 hover:bg-emerald-50 px-4 py-2 rounded-lg transition"
            >
              📄 Vẫn Xuất File Excel Mẫu (Trống)
            </button>
            <span className="text-xs text-slate-500">
              hoặc chọn Quý khác (ví dụ Quý 1, Quý 2) trên bảng điều khiển và bấm Quét lại.
            </span>
          </div>
        </div>
      ) : (
        <>
          {/* Thẻ thống kê tài chính */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-blue-700">HĐ Mua Vào Hợp Lệ</span>
                <ArrowDownLeft className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-lg font-black text-white font-mono">
                {stats.purchase.validCount} / {stats.purchase.total} HĐ
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Tiền TT: {stats.purchase.totalAmount.toLocaleString('vi-VN')} đ
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-emerald-700">HĐ Bán Ra Hợp Lệ</span>
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-lg font-black text-white font-mono">
                {stats.sold.validCount} / {stats.sold.total} HĐ
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Tiền TT: {stats.sold.totalAmount.toLocaleString('vi-VN')} đ
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-indigo-700">Thuế GTGT Mua Vào</span>
                <CheckCircle className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-lg font-black text-white font-mono">
                {stats.purchase.totalTax.toLocaleString('vi-VN')} đ
              </div>
              <p className="text-xs text-slate-500 mt-1">Được khấu trừ hợp lệ</p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-amber-700">Cảnh Báo HĐ Bị Loại Trừ</span>
                <ShieldAlert className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-lg font-black text-amber-400 font-mono">
                {stats.purchase.invalidCount + stats.sold.invalidCount} HĐ
              </div>
              <p className="text-xs text-amber-700 mt-1">Hóa đơn đã hủy hoặc thay thế</p>
            </div>
          </div>

          {/* Tabs & Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div className="flex border border-slate-800 rounded-2xl p-1 bg-slate-950 w-fit">
              <button
                onClick={() => setActiveTab('purchase')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${
                  activeTab === 'purchase'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sheet 1: Hóa Đơn Mua Vào ({purchaseList.length})
              </button>
              <button
                onClick={() => setActiveTab('sold')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${
                  activeTab === 'sold'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sheet 2: Hóa Đơn Bán Ra ({soldList.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo MST, Tên, Số HĐ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="text-xs pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 w-56 px-4 py-2"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500 px-3 py-2"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="valid">Chỉ HĐ Hợp lệ</option>
                <option value="invalid">Chỉ HĐ Đã Hủy / Thay Thế</option>
              </select>
            </div>
          </div>

          {/* Bảng dữ liệu chi tiết */}
          <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950/60 shadow-inner">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-300 font-black uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <th className="p-2.5 text-center w-12">STT</th>
                  <th className="p-2.5 text-center">Loại HĐ</th>
                  <th className="p-2.5 text-center">Mẫu số / Ký hiệu</th>
                  <th className="p-2.5 text-center">Số HĐ</th>
                  <th className="p-2.5 text-center">Ngày lập</th>
                  <th className="p-2.5">{activeTab === 'purchase' ? 'Người Bán' : 'Người Mua'}</th>
                  <th className="p-2.5 text-right">Tiền Chưa Thuế</th>
                  <th className="p-2.5 text-right">Thuế GTGT</th>
                  <th className="p-2.5 text-right">Tổng Thanh Toán</th>
                  <th className="p-2.5 text-center">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="text-center py-8 text-slate-400">
                      Không tìm thấy hóa đơn nào phù hợp với bộ lọc tìm kiếm.
                    </td>
                  </tr>
                ) : (
                  filteredList.map((item, idx) => {
                    const isValid = item.is_valid_for_tax;
                    return (
                      <tr
                        key={item.id || idx}
                        className={`hover:bg-slate-50 transition ${
                          !isValid ? 'bg-amber-50/70 text-amber-950' : ''
                        }`}
                      >
                        <td className="p-2.5 text-center text-slate-500">{idx + 1}</td>
                        <td className="p-2.5 text-center">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700">
                            {item.loai_hoa_don}
                          </span>
                        </td>
                        <td className="p-2.5 text-center font-mono">
                          {item.ky_hieu_mau_so} - {item.ky_hieu_hoa_don}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-blue-600">
                          {item.so_hoa_don}
                        </td>
                        <td className="p-2.5 text-center text-slate-600">{item.ngay_lap}</td>
                        <td className="p-2.5">
                          <div className="font-semibold text-slate-800">
                            {activeTab === 'purchase' ? item.ten_nguoi_ban : item.ten_nguoi_mua}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            MST: {activeTab === 'purchase' ? item.mst_nguoi_ban : item.mst_nguoi_mua}
                          </div>
                        </td>
                        <td className="p-2.5 text-right font-medium">
                          {Number(item.tong_tien_chua_thue || 0).toLocaleString('vi-VN')} đ
                        </td>
                        <td className="p-2.5 text-right font-medium">
                          {Number(item.tong_tien_thue || 0).toLocaleString('vi-VN')} đ
                        </td>
                        <td className="p-2.5 text-right font-bold text-slate-900">
                          {Number(item.tong_tien_thanh_toan || 0).toLocaleString('vi-VN')} đ
                        </td>
                        <td className="p-2.5 text-center">
                          {isValid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                              <CheckCircle className="w-3 h-3" /> {item.trang_thai_nhan}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-100/70 px-2 py-0.5 rounded-full" title="Không tính vào tổng cộng kê khai thuế">
                              <AlertCircle className="w-3 h-3" /> {item.trang_thai_nhan} (Đã hủy)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
