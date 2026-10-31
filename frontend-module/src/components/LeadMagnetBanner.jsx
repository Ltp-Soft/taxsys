import React, { useState } from 'react';
import { Clock, PhoneCall, Check, ArrowRight, Sparkles } from 'lucide-react';

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
      {/* Banner Tiếp Thị Phễu Mồi Mini - Tinh gọn, không choán chỗ làm việc */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-blue-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 text-amber-300">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Hệ Sinh Thái Chấm Công 4.0 (LTP Attendance)</span>
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                Tặng Bản Quyền VIP
              </span>
            </div>
            <p className="text-xs text-blue-200 mt-0.5">
              Chấm công GPS & QR động không cần máy vân tay. Khách hàng chấm công được tặng miễn phí bản quyền Tool Thuế trọn đời.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Tư Vấn Miễn Phí</span>
          </button>
          <a
            href="https://ltp-soft.com"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-200 hover:text-white font-medium flex items-center gap-1"
          >
            <span>ltp-soft.com</span>
            <ArrowRight className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Modal Đăng Ký Tư Vấn */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-slate-800 border border-slate-100 animate-scaleUp">
            {submitted ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Check className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">Đăng Ký Thành Công!</h3>
                <p className="text-xs text-slate-600 mb-5">
                  Chuyên viên giải pháp phần mềm chấm công LTP Soft sẽ liên hệ hỗ trợ cho bạn trong vòng 15 phút.
                </p>
                <button
                  onClick={() => { setShowModal(false); setSubmitted(false); }}
                  className="px-5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 transition"
                >
                  Đóng
                </button>
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" /> Nhận Tư Vấn Chấm Công & Tặng Bản Quyền Tool Thuế
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Trải nghiệm giải pháp chấm công không cần máy chấm công với ưu đãi tặng phần mềm thuế vĩnh viễn.
                </p>

                <form onSubmit={handleSubmitLead} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Số điện thoại / Zalo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="VD: 0912 345 678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full text-xs px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tên Doanh Nghiệp (Hoặc số lượng nhân sự)
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Công ty TNHH ABC (30 nhân sự)"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full text-xs px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                    >
                      Bỏ qua
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition"
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
