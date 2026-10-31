// Quản lý Extension Popup
const form = document.getElementById('syncForm');
const mstInput = document.getElementById('mst');
const passInput = document.getElementById('password');
const quarterSelect = document.getElementById('quarter');
const yearInput = document.getElementById('year');
const backendUrlInput = document.getElementById('backendUrl');
const btnSubmit = document.getElementById('btnSubmit');
const togglePassBtn = document.getElementById('togglePass');
const progressArea = document.getElementById('progressArea');
const progressText = document.getElementById('progressText');
const progressPercent = document.getElementById('progressPercent');
const progressBar = document.getElementById('progressBar');
const btnOpenWeb = document.getElementById('btnOpenWeb');

// Toggle hiển thị mật khẩu
togglePassBtn.addEventListener('click', () => {
  const isPass = passInput.type === 'password';
  passInput.type = isPass ? 'text' : 'password';
  togglePassBtn.textContent = isPass ? '🙈' : '👁️';
});

// Mở trang Web Dashboard
btnOpenWeb.addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:5173' });
});

// Tải thông tin đã lưu từ chrome.storage.local
chrome.storage.local.get(['saved_mst', 'saved_pass', 'saved_backend_url'], (res) => {
  if (res.saved_mst) mstInput.value = res.saved_mst;
  if (res.saved_pass) passInput.value = res.saved_pass;
  if (res.saved_backend_url) backendUrlInput.value = res.saved_backend_url;
});

// Lắng nghe cập nhật tiến trình
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'TAX_SYNC_PROGRESS') {
    const data = message.data;
    progressArea.classList.remove('hidden');
    progressText.textContent = data.step || 'Đang xử lý...';
    const pct = data.percent || 0;
    progressPercent.textContent = `${pct}%`;
    progressBar.style.width = `${pct}%`;

    if (data.stage === 'COMPLETED') {
      btnSubmit.disabled = false;
      btnSubmit.textContent = '✅ Đã tải xong! Mở Web để xuất Excel';
      setTimeout(() => {
        chrome.tabs.create({ url: 'http://localhost:5173' });
      }, 1000);
    } else if (data.stage === 'ERROR') {
      btnSubmit.disabled = false;
      btnSubmit.textContent = '❌ Lỗi - Thử lại';
      alert(`Đã xảy ra lỗi: ${data.error}`);
    }
  }
});

// Bắt đầu đồng bộ
form.addEventListener('submit', (e) => {
  e.preventDefault();

  const mst = mstInput.value.trim();
  const password = passInput.value.trim();
  const quarter = quarterSelect.value;
  const year = yearInput.value.trim();
  const backendUrl = backendUrlInput.value.trim();

  if (!mst || !password) {
    alert('Vui lòng nhập đầy đủ Mã số thuế và Mật khẩu.');
    return;
  }

  // Lưu cục bộ an toàn
  chrome.storage.local.set({
    saved_mst: mst,
    saved_pass: password,
    saved_backend_url: backendUrl
  });

  btnSubmit.disabled = true;
  btnSubmit.textContent = '⏳ Đang đồng bộ...';
  progressArea.classList.remove('hidden');
  progressText.textContent = 'Đang khởi động tiến trình...';
  progressPercent.textContent = '0%';
  progressBar.style.width = '0%';

  chrome.runtime.sendMessage({
    type: 'START_SYNC',
    payload: {
      username: mst,
      password: password,
      quarter: quarter,
      year: year,
      backend_url: backendUrl
    }
  }, (response) => {
    if (!response || !response.success) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = '🚀 Tải Hóa Đơn & Đồng Bộ';
      alert(`Lỗi: ${response?.error || 'Không thể kết nối đến Extension Service Worker'}`);
    }
  });
});
