require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authController = require('./controllers/auth.controller');
const captchaController = require('./controllers/captcha.controller');
const configController = require('./controllers/config.controller');
const bundleWatcher = require('./services/bundleWatcher.job');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors({
  origin: '*', // Hỗ trợ Chrome Extension (chrome-extension://*) và Web domain chấm công
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-License-Key']
}));

// Tăng giới hạn payload JSON để nhận chuỗi base64 captcha / SVG
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Tax Invoice Sync Backend',
    timestamp: new Date().toISOString(),
    ai_configured: Boolean(process.env.GEMINI_API_KEY)
  });
});

// API Routes
app.get('/api/v1/tax-config', configController.getConfig);
app.get('/api/v1/license-check', authController.verifyLicense, authController.checkLicenseStatus);
app.post('/api/v1/solve-captcha', authController.verifyLicense, captchaController.solveCaptcha);
app.post('/api/v1/heal-schema', authController.verifyLicense, configController.healSchema);

// Error handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Tax Invoice Sync Backend running on port ${PORT}`);
  console.log(`📡 Tax Config API: http://localhost:${PORT}/api/v1/tax-config`);
  console.log(`🤖 Gemini AI Status: ${process.env.GEMINI_API_KEY ? 'Active (API Key loaded)' : 'API Key not provided yet'}`);
  console.log(`====================================================`);

  // Bắt đầu background bundle watcher
  bundleWatcher.startScheduler(24);
});

module.exports = app;
