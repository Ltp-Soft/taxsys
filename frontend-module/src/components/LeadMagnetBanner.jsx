import React, { useState } from 'react';
import { Clock, ShieldCheck, Sparkles, PhoneCall, Check, ExternalLink, ArrowRight, Zap, QrCode } from 'lucide-react';

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
      {/* Banner Tiếp Thị Phễu Mồi (Dark Slate Glassmorphism đồng bộ LTP Soft) */}
      <div className="relative overflow-hidden bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-slate-800/80 shadow-2xl">
        {/* Glow ambient decoration */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs text-blue-400 font-semibold shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Chương Trình Đồng Hành Cùng Doanh Nghiệp & Kế Toán 2026</span>
            </div>

            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-snug">
              Tải & Tổng Hợp Hóa Đơn Thuế AI{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400">
                (Tặng Miễn Phí 100%)
              </span>
            </h2>

            <p className="text-sm text-slate-300 leading-relaxed font-normal">
              Giải phóng 90% thời gian tra cứu từng tờ hóa đơn điện tử. Tự động gom toàn bộ hóa đơn Mua Vào & Bán Ra trong Quý thành file Excel 2 Sheet chuẩn mực kế toán kiểm toán.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-300">
              <span className="flex items-center gap-1.5 font-medium">
                <Check className="w-4 h-4 text-emerald-400" /> Không sót HĐ máy tính tiền
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Check className="w-4 h-4 text-emerald-400" /> Tự động loại trừ hóa đơn hủy
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Check className="w-4 h-4 text-emerald-400" /> Bảo mật 100% Client-Side
              </span>
            </div>
          </div>

          {/* Khối Mồi Bán Sản Phẩm LTP Attendance */}
          <div className="bg-slate-950/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800/90 flex flex-col justify-between max-w-sm w-full shadow-xl">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                  LTP ATTENDANCE 4.0
                </span>
              </div>
              <p className="text-sm font-bold text-white mb-1.5">
                Chấm Công Không Cần Máy Chấm Công
              </p>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Quét QR Động & GPS chống gian lận, chấm công Offline 100% không cần 4G, tự động tính bảng công và lương tức thì.
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setShowModal(true)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 transition shadow-lg shadow-amber-500/20"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                Đăng Ký Tư Vấn & Dùng Thử 60 Ngày
              </button>
              <a
                href="https://ltp-soft.com"
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold text-slate-400 hover:text-cyan-400 transition"
              >
                <span>Xem giải pháp tại ltp-soft.com</span>
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Đăng Ký Tư Vấn */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-7 text-slate-100 animate-scaleUp">
            {submitted ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Check className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-black text-white mb-1">Đăng Ký Thành Công!</h3>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                  Chuyên viên giải pháp phần mềm quản trị và chấm công LTP Soft sẽ liên hệ hỗ trợ và kích hoạt dùng thử 60 ngày miễn phí cho bạn.
                </p>
                <button
                  onClick={() => { setShowModal(false); setSubmitted(false); }}
                  className="px-6 py-2.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-200 transition"
                >
                  Đóng
                </button>
              </div>
            ) : (
              <div>
                <h3 className="text-base font-black text-white mb-1 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-400" /> Nhận Tư Vấn Chấm Công Thông Minh
                </h3>
                <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                  Tặng kèm miễn phí bản quyền PRO Tool Thuế trọn đời khi triển khai giải pháp Chấm Công Doanh Nghiệp LTP Soft.
                </p>

                <form onSubmit={handleSubmitLead} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Số điện thoại / Zalo <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="VD: 0912 345 678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full text-xs px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Tên Doanh Nghiệp / Quy mô nhân sự
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Công ty TNHH ABC (30 nhân sự)"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full text-xs px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white transition"
                    >
                      Bỏ qua
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl shadow-lg shadow-blue-600/30 transition"
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
