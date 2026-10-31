# HƯỚNG DẪN TRIỂN KHAI (DEPLOY) & CHIẾN LƯỢC MỒI CÂU BÁN MÁY CHẤM CÔNG

Tài liệu này hướng dẫn chi tiết cách triển khai trọn gói hệ thống **Đồng Bộ Hóa Đơn Thuế (Tax Invoice Sync)** và chiến lược biến công cụ này thành **Sản phẩm mồi (Lead Magnet)** thu hút hàng nghìn khách hàng doanh nghiệp cho website Máy Chấm Công của bạn.

---

## 1. TỔNG QUAN DỰ ÁN & CƠ CHẾ HOẠT ĐỘNG

Dự án đã được khởi tạo hoàn chỉnh theo đúng đặc tả `PROJECT_SPEC.md` với 3 module:
1. **`backend/` (Node.js + Express + Google Gemini API):**
   - Cung cấp cấu hình động `tax_api_config.json` (`GET /api/v1/tax-config`).
   - Tích hợp Gemini 2.5 Flash để tự động đọc mã Captcha (`POST /api/v1/solve-captcha`).
   - Tự động khắc phục khi cổng thuế đổi tên trường (`POST /api/v1/heal-schema`).
   - Giám sát sự thay đổi bundle JS của cổng thuế (`bundleWatcher.job.js`).
2. **`extension/` (Chrome Extension Manifest V3):**
   - Chạy trên máy của người dùng (Client-Side) để gọi trực tiếp vào `hoadondientu.gdt.gov.vn:30000`.
   - Giải quyết bài toán chống chặn IP và không làm nặng băng thông máy chủ.
   - Quét vét cạn hóa đơn theo từng tháng trong Quý (bao gồm cả HĐ điện tử và HĐ máy tính tiền).
   - Tích hợp sẵn Popup UI tiện lợi và Content Bridge giao tiếp với Web.
3. **`frontend-module/` (React + TailwindCSS + ExcelJS):**
   - Giao diện hiện đại, tối ưu trải nghiệm kế toán viên.
   - Quản lý đa mã số thuế doanh nghiệp (lưu trữ cục bộ an toàn trong LocalStorage).
   - Xuất file `.xlsx` gồm đúng 2 Sheet (`Mua_Vao`, `Ban_Ra`), tự động tô vàng cảnh báo và loại trừ hóa đơn hủy/thay thế khỏi dòng Tổng cộng hợp lệ.
   - Tích hợp Banner & Form thu thập khách hàng tiềm năng cho sản phẩm Máy Chấm Công.

---

## 2. HƯỚNG DẪN CÀI ĐẶT & DEPLOY CHROME EXTENSION

Có 3 cách phân phối Chrome Extension tùy theo mục đích:

### Cách 1: Phân phối trực tiếp qua file .ZIP (Dành cho bản Beta hoặc khách dùng thử)
1. Nén toàn bộ thư mục `extension` thành file `TaxSync_Extension.zip`.
2. Khách hàng tải về, giải nén ra một thư mục trên máy tính.
3. Trên trình duyệt Google Chrome / Cốc Cốc / Edge:
   - Truy cập: `chrome://extensions`
   - Bật công tắc **"Chế độ cho nhà phát triển" (Developer mode)** ở góc trên bên phải.
   - Nhấn nút **"Tải tiện ích đã giải nén" (Load unpacked)**.
   - Chọn thư mục `extension` vừa giải nén.
4. Tiện ích sẽ xuất hiện ngay trên thanh công cụ trình duyệt. Khi mở trang web công cụ, tiện ích sẽ tự động kết nối (Huy hiệu xanh).

### Cách 2: Đưa lên Chrome Web Store (Khuyên dùng để tăng uy tín & SEO)
1. Đăng ký tài khoản Developer trên [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) (phí 1 lần là $5).
2. Chuẩn bị file `.zip` của thư mục `extension`:
   - Kiểm tra `manifest.json` đã có phiên bản (`version: "1.0.0"`), mô tả, biểu tượng.
3. Điền thông tin cửa hàng:
   - **Tên:** Đồng Bộ Hóa Đơn Điện Tử TCT & Máy Chấm Công
   - **Mô tả chi tiết:** Hỗ trợ kế toán tải bảng kê hóa đơn mua vào, bán ra định dạng Excel 2 sheet từ trang Tổng cục Thuế.
   - **Chính sách quyền riêng tư (Privacy Policy):** Khẳng định tiện ích không lưu trữ hay gửi mật khẩu của người dùng lên bất kỳ máy chủ nào (xem mẫu ở Mục 5).
4. Nhấn **Submit for Review**. Thời gian Google duyệt thường từ 24 - 48 giờ.
5. Sau khi được duyệt, khách hàng chỉ cần nhấn 1 nút **"Thêm vào Chrome"** trực tiếp từ Cửa hàng Chrome.

---

## 3. CÁCH DEPLOY LÊN DOMAIN MÁY CHẤM CÔNG CỦA BẠN

Giả sử bạn đang có domain máy chấm công: `chamcong.vn` (hoặc bất kỳ tên miền nào).

### Phương án A: Tạo Subdomain (Khuyên dùng nhất)
- Tạo subdomain: `tax.chamcong.vn` hoặc `hoadon.chamcong.vn`.
- Trỏ DNS của subdomain về IP máy chủ lưu trữ (VPS / Cloud Server).
- Build frontend:
  ```bash
  cd frontend-module
  npm run build
  ```
  Thư mục `frontend-module/dist` sẽ chứa toàn bộ mã nguồn tĩnh (HTML/CSS/JS). Bạn chỉ cần upload lên Web Server (Nginx / Apache / Vercel / Cloudflare Pages).
- Chạy backend:
  ```bash
  cd backend
  npm install
  # Cập nhật GEMINI_API_KEY trong file .env
  npm start
  ```
  Dùng PM2 để duy trì backend chạy ngầm: `pm2 start src/app.js --name tax-backend`.

### Phương án B: Tích hợp thành một trang con trong Website hiện tại
- Đường dẫn: `chamcong.vn/tien-ich-tai-hoa-don`
- Cấu hình Nginx Reverse Proxy để điều hướng:
  ```nginx
  location /tien-ich-tai-hoa-don/ {
      alias /var/www/tax-frontend/dist/;
      try_files $uri $uri/ /tien-ich-tai-hoa-don/index.html;
  }
  location /api/v1/ {
      proxy_pass http://127.0.0.1:3001;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
  }
  ```

---

## 4. CHIẾN LƯỢC BIẾN CÔNG CỤ NÀY THÀNH "MỒI CÂU BÁN MÁY CHẤM CÔNG" (LEAD MAGNET STRATEGY)

### 4.1. Tại sao Kế toán là tệp khách hàng "Vàng" để bán máy chấm công?
- Trong hơn 80% doanh nghiệp vừa và nhỏ (SME), **Kế toán kiêm luôn quản lý nhân sự, chấm công và tính lương**.
- Kế toán là người chịu áp lực lớn nhất vào mỗi kỳ báo cáo thuế (Tháng 1, 4, 7, 10 hàng năm) vì phải tra cứu hàng nghìn tờ hóa đơn điện tử thủ công.
- Khi bạn trao cho họ một công cụ **hoàn toàn miễn phí, tải sạch hóa đơn trong 1 phút ra file Excel 2 Sheet**, bạn đã xây dựng được **lòng tin tuyệt đối (High Trust)**.

### 4.2. Các điểm chạm kích hoạt đơn hàng (Conversion Touchpoints)
1. **Hero Banner ngay đầu trang:**
   - Đặt thông điệp: *"Bạn đang mất hàng giờ chấm công thủ công bằng file Excel? Kết nối Máy Chấm Công Khuôn Mặt AI - Tự động tính lương 1 chạm. Tặng 30 ngày trải nghiệm miễn phí trọn gói."*
2. **Form Thu thập Lead khi tải xong Excel:**
   - Sau khi file Excel tải về máy thành công, một thông báo nhẹ nhàng hiện lên:
     *"Bạn có muốn đồng bộ dữ liệu bảng kê lương nhân viên vào bảng kế toán này không? Để lại số điện thoại để nhận bảng giá máy chấm công ưu đãi cho kế toán."*
3. **Quảng cáo khéo léo trong chính file Excel tải về:**
   - Ở dòng ghi chú dưới chân bảng kê Excel có thể để dòng chữ:
     *Hỗ trợ kỹ thuật & Tích hợp phần mềm chấm công: Hotline 09xx.xxx.xxx - Website chamcong.vn*
4. **Chia sẻ trên các Group Kế toán (Viral Organic Traffic):**
   - Đăng bài trên các nhóm Facebook: "Hội Kế toán Việt Nam", "Kế toán thuế", "Cộng đồng Excel Kế toán"...
   - Tiêu đề mồi: *"Tặng các bác công cụ tải toàn bộ hóa đơn thuế Quý 1/2026 ra Excel 2 sheet Mua & Bán hoàn toàn miễn phí, không giới hạn số lượng MST"*.
   - Hàng nghìn kế toán sẽ truy cập domain `chamcong.vn` mỗi ngày mà bạn **không mất một đồng tiền quảng cáo nào**!

---

## 5. MẪU CHÍNH SÁCH QUYỀN RIÊNG TƯ (PRIVACY POLICY CHO CHROME WEB STORE)

Khi đưa lên Chrome Web Store, bạn dùng nội dung này:
> **Chính sách bảo mật TaxInvoice Sync:**
> 1. Tiện ích thực thi trực tiếp các truy vấn đến cổng Hóa đơn điện tử (hoadondientu.gdt.gov.vn) từ địa chỉ IP của thiết bị người dùng.
> 2. Mã số thuế và mật khẩu đăng nhập chỉ được lưu trữ cục bộ trong bộ nhớ tạm của trình duyệt (chrome.storage.local) và tuyệt đối không bao giờ được gửi hay lưu trữ trên bất kỳ máy chủ bên ngoài nào.
> 3. Dữ liệu hóa đơn sau khi tải về được tổng hợp trực tiếp trên máy khách và xuất ra file Excel trên máy người dùng, đảm bảo tuân thủ nghiêm ngặt tính bảo mật kinh doanh của doanh nghiệp.
