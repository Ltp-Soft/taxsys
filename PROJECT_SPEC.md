# PROJECT SPEC & SYSTEM ARCHITECTURE
> **Lưu ý:** Tài liệu chi tiết tóm tắt ứng dụng và hướng dẫn bàn giao tích hợp cho dự án Máy Chấm Công **LTP Attendance (ltp-soft.com)** đã được cập nhật đầy đủ tại file:
> 📄 [**APPLICATION_SUMMARY.md**](./APPLICATION_SUMMARY.md)

---

# TỔNG QUAN HỆ THỐNG TAXINVOICE SYNC
Hệ thống tiện ích Chrome Extension + Web Dashboard + Backend AI tự động tải và tổng hợp hóa đơn thuế của doanh nghiệp từ Cổng Thuế Tổng Cục Thuế (`hoadondientu.gdt.gov.vn`) thành file Excel 2 sheet (Mua Vào, Bán Ra) chuẩn kế toán.

## 1. Cấu Trúc Monorepo
- **`extension/`**: Chrome Extension Manifest V3 hoạt động như Client-side Proxy, lưu trữ 1 MST miễn phí trong `chrome.storage.local` chống bypass `Ctrl + F5`, tự động giải Captcha bằng Google Gemini AI cho cả Hóa đơn điện tử và Hóa đơn máy tính tiền POS. Đã đóng gói sẵn file [`TaxInvoiceSync_Extension.zip`](./TaxInvoiceSync_Extension.zip).
- **`backend/`**: Node.js/Express chạy trên port 3001, tích hợp `@google/genai` (Gemini 3.5 Flash Lite) giải Captcha chỉ mất 1.5s, API cấu hình động `/api/v1/tax-config`, tự vá cấu trúc `/api/v1/heal-schema` và robot theo dõi Cổng thuế `BundleWatcher`.
- **`frontend-module/`**: React + Vite + TailwindCSS + ExcelJS, hỗ trợ tra cứu theo Quý, theo Tháng (Tháng 1 -> 12), tùy chọn ngày; bộ lọc Smart Date chuyển đổi GMT+7 loại trừ hóa đơn sai kỳ; xuất file Excel kèm công thức `=SUM()` và `=SUMIF()` chuẩn kiểm toán.

## 2. Chiến Lược Mồi Bán (Lead Magnet cho ltp-soft.com)
- **Gói Miễn Phí:** 01 Mã Số Thuế vĩnh viễn không giới hạn số lượng hóa đơn.
- **Khóa Tự Động:** Từ MST thứ 2 trở đi, hệ thống khóa và pop-up đề xuất nâng cấp bản Pro hoặc đăng ký giải pháp Chấm Công Thông Minh **LTP Attendance (ltp-soft.com)** để mở khóa không giới hạn.

## 3. Xem Chi Tiết Giao Thức & Hướng Dẫn Tích Hợp
Vui lòng xem toàn văn tài liệu bàn giao kỹ thuật tại:
👉 [**APPLICATION_SUMMARY.md**](./APPLICATION_SUMMARY.md)
