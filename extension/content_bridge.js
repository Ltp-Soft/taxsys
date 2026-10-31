/**
 * Cầu nối giao tiếp 2 chiều giữa Web Dashboard và Chrome Extension
 */

// Báo hiệu cho trang Web biết Extension đã sẵn sàng
function notifyExtensionReady() {
  window.postMessage({
    type: 'TAX_EXTENSION_READY',
    version: '1.0.0',
    timestamp: Date.now()
  }, '*');
}

// Bắn sự kiện sẵn sàng
notifyExtensionReady();
document.addEventListener('DOMContentLoaded', notifyExtensionReady);

// Lắng nghe lệnh từ Web Dashboard gửi qua window.postMessage
window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || typeof event.data !== 'object') {
    return;
  }

  const { type, payload, requestId } = event.data;

  if (type === 'TAX_EXTENSION_START_SYNC') {
    console.log('[ContentBridge] Received START_SYNC from Web Dashboard. Forwarding to background...');

    chrome.runtime.sendMessage({
      type: 'START_SYNC',
      payload: payload
    }, (response) => {
      // Bắn kết quả trả về cho Web Dashboard
      window.postMessage({
        type: 'TAX_EXTENSION_SYNC_RESULT',
        requestId: requestId,
        response: response
      }, '*');
    });
  }

  if (type === 'TAX_EXTENSION_PING') {
    chrome.runtime.sendMessage({ type: 'PING' }, (res) => {
      window.postMessage({
        type: 'TAX_EXTENSION_PONG',
        requestId: requestId,
        response: res
      }, '*');
    });
  }
});

// Lắng nghe tiến độ từ background service worker để đẩy về Web Dashboard
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'TAX_SYNC_PROGRESS') {
    window.postMessage({
      type: 'TAX_EXTENSION_PROGRESS',
      data: message.data
    }, '*');
  }
});
