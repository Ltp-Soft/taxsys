import React, { useState } from 'react';
import { Clock, ShieldCheck, Sparkles, PhoneCall, Check, ExternalLink, ArrowRight } from 'lucide-react';

export default function LeadMagnetBanner() {
  const [showModal, setShowModal] = useState(false);
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmitLead = (e) => {
    e.preventDefault();
    if (!phone) return;
    setSubmitted(true);
    console.log('[LTP Lead Capture] New lead submitted:', { phone, companyName });
  };

  return (
    <>
      {/* Banner Tiếp Thị Phễu Mồi (Lead Magnet Hero Card) */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-950 text-white rounded-2xl shadow-xl p-6 border border-blue-500/20">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Dành riêng cho Kế toán Doanh nghiệp & Kế toán Dịch vụ</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight mb-2">
              Tiện Ích Tải & Tổng Hợp Hóa Đơn Thuế Tự Động (Miễn Phí 100%)
            </h1>
            <p className="text-sm text-blue-200/90 leading-relaxed">
              Giải phóng 90% thời gian tra cứu từng tờ hóa đơn điện tử. Tự động gom toàn bộ hóa đơn Mua Vào & Bán Ra trong Quý thành file Excel 2 Sheet chuẩn mực kế toán.
            </p>

            <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-blue-300">
              <span className="flex items-center gap-1">
                <Check className="w-4 h-4 text-emerald-400" /> Không bỏ sót hóa đơn máy tính tiền
              </span>
              <span className="flex items-center gap-1">
                <Check className="w-4 h-4 text-emerald-400" /> Tự động loại trừ hóa đơn hủy
              </span>
              <span className="flex items-center gap-1">
                <Check className="w-4 h-4 text-emerald-400" /> Bảo mật 100% trên trình duyệt máy khách
              </span>
            </div>
          </div>

          {/* Khối Mồi Bán Sản Phẩm LTP Attendance */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/15 flex flex-col justify-between max-w-sm w-full">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Clock className="w-5 h-5 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Hệ Sinh Thái LTP Attendance 4.0
                </span>
              </div>
              <p className="text-sm font-bold text-white mb-1">
                Chấm Công Không Cần Máy Chấm Công
              </p>
              <p className="text-xs text-slate-300 mb-4">
                Quét QR Động & GPS chống gian lận, chấm công Offline 100% không cần mạng, tự động tính bảng công và lương tức thì.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 transition shadow-md shadow-amber-500/20"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                Đăng Ký Nhận Tư Vấn Miễn Phí
              </button>
              <a
                href="https://ltp-soft.com"
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-1 py-1.5 text-[11px] font-semibold text-blue-200 hover:text-white transition"
              >
                <span>Khám phá nền tảng tại ltp-soft.com</span>
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Đăng Ký Tư Vấn Máy Chấm Công & Chấm Công LTP */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-800 animate-scaleUp">
            {submitted ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Check className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Đăng Ký Thành Công!</h3>
                <p className="text-xs text-slate-600 mb-5">
                  Chuyên viên giải pháp phần mềm quản trị và chấm công LTP Soft sẽ liên hệ tư vấn miễn phí cho bạn trong vòng 15 phút.
                </p>
                <button
                  onClick={() => { setShowModal(false); setSubmitted(false); }}
                  className="px-5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition"
                >
                  Đóng
                </button>
              </div>
            ) : (
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" /> Nhận Tư Vấn Giải Pháp Chấm Công LTP Soft
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Ưu đãi tặng miễn phí gói bản quyền PRO Tool Thuế trọn đời khi đăng ký sử dụng Chấm Công Thông Minh.
                </p>

                <form onSubmit={handleSubmitLead} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Số điện thoại / Zalo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="VD: 0912 345 678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tên Doanh Nghiệp (Hoặc Số lượng nhân sự)
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Công ty ABC (Quy mô 30 nhân sự)"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                    >
                      Bỏ qua
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition"
                    >
                      Nhận Ưu Đãi Ngay
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
