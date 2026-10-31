const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const geminiService = require('./gemini.service');

const HASH_FILE = path.join(__dirname, '../../data/last_bundle_hashes.json');

class BundleWatcherJob {
  constructor() {
    this.targetUrl = 'https://hoadondientu.gdt.gov.vn';
  }

  async runDailyCheck() {
    console.log('[BundleWatcher] Starting daily bundle check against', this.targetUrl);
    try {
      // Đảm bảo thư mục lưu hash tồn tại
      const dir = path.dirname(HASH_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Giả lập hoặc fetch index.html
      const response = await fetch(this.targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(10000)
      }).catch(err => {
        console.warn('[BundleWatcher] Warning: Cannot directly reach tax portal from server network:', err.message);
        return null;
      });

      if (!response || !response.ok) {
        console.log('[BundleWatcher] Skip check: Portal unreachable or requires client-side network.');
        return { checked: false, reason: 'Portal unreachable from server network' };
      }

      const html = await response.text();
      // Tìm các thẻ script chứa chunk .js
      const scriptRegex = /src="([^"]+\.chunk\.js)"/g;
      let match;
      const scripts = [];
      while ((match = scriptRegex.exec(html)) !== null) {
        scripts.push(match[1]);
      }

      console.log(`[BundleWatcher] Found ${scripts.length} bundle script references.`);
      return { checked: true, scriptsFound: scripts.length };
    } catch (error) {
      console.error('[BundleWatcher] Error checking bundle:', error.message);
      return { checked: false, error: error.message };
    }
  }

  startScheduler(intervalHours = 24) {
    console.log(`[BundleWatcher] Scheduled to run every ${intervalHours} hours.`);
    // Run initial check after 10 seconds
    setTimeout(() => this.runDailyCheck(), 10000);
    // Recurring interval
    setInterval(() => this.runDailyCheck(), intervalHours * 60 * 60 * 1000);
  }
}

module.exports = new BundleWatcherJob();
