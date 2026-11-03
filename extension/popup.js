// Quản lý Extension Popup
const form = document.getElementById('syncForm');
const mstInput = document.getElementById('mst');
const passInput = document.getElementById('password');
const quarterSelect = document.getElementById('quarter');
const yearInput = document.getElementById('year');
const btnSubmit = document.getElementById('btnSubmit');
const togglePassBtn = document.getElementById('togglePass');
const btnOpenWeb = document.getElementById('btnOpenWeb');

// Mặc định luôn trỏ về domain chính thức
const DEFAULT_WEB_URL = 'https://tax.ltp-soft.com';

// Toggle hiển thị mật khẩu
togglePassBtn.addEventListener('click', () => {
  const isPass = passInput.type === 'password';
  passInput.type = isPass ? 'text' : 'password';
  togglePassBtn.textContent = isPass ? '🙈' : '👁️';
});

// Mở trang Web Dashboard
btnOpenWeb.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: DEFAULT_WEB_URL });
});

// Tải thông tin đã lưu từ chrome.storage.local
chrome.storage.local.get(['saved_mst', 'saved_pass'], (res) => {
  if (res.saved_mst) mstInput.value = res.saved_mst;
  if (res.saved_pass) passInput.value = res.saved_pass;
});

// Bắt đầu đồng bộ: Lưu tạm MST & Password vào bộ nhớ Extension rồi tự động mở Web Dashboard tax.ltp-soft.com
form.addEventListener('submit', (e) => {
  e.preventDefault();

  const mst = mstInput.value.trim();
  const password = passInput.value.trim();
  const quarter = quarterSelect.value;
  const year = yearInput.value.trim();

  if (!mst || !password) {
    alert('Vui lòng nhập đầy đủ Mã số thuế và Mật khẩu.');
    return;
  }

  // Lưu cục bộ an toàn
  chrome.storage.local.set({
    saved_mst: mst,
    saved_pass: password,
    selected_quarter: quarter,
    selected_year: year
  }, () => {
    // Mở thẳng trang Web Dashboard đầy đủ để người dùng thao tác trực quan
    chrome.tabs.create({ url: DEFAULT_WEB_URL });
  });
});
