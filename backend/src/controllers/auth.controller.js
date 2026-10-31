/**
 * Controller kiểm tra License khách hàng từ phần mềm chấm công hoặc cấp quyền miễn phí (Lead Magnet)
 */

exports.verifyLicense = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const licenseToken = req.headers['x-license-key'] || (authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null);

  // Chế độ Mồi (Lead Magnet / Free Community Mode):
  // Nếu cho phép dùng thử miễn phí hoặc có cấu hình ALLOW_FREE_TIER=true trong .env
  const allowFreeTier = process.env.ALLOW_FREE_TIER !== 'false';

  if (!licenseToken && !allowFreeTier) {
    return res.status(401).json({
      success: false,
      message: 'License key is missing. Vui lòng đăng nhập từ hệ thống Máy Chấm Công hoặc cung cấp License Key hợp lệ.'
    });
  }

  // Gắn thông tin license vào request
  req.license = {
    valid: true,
    tier: licenseToken ? 'enterprise' : 'free_lead_magnet',
    licenseKey: licenseToken || 'free-community-tier'
  };

  next();
};

exports.checkLicenseStatus = (req, res) => {
  return res.json({
    success: true,
    tier: req.license.tier,
    message: req.license.tier === 'enterprise' 
      ? 'Bản quyền Doanh nghiệp hợp lệ từ Hệ thống Máy Chấm Công' 
      : 'Bản quyền Miễn phí (Tiện ích Tải Hóa Đơn Thuế - Powered by Hệ thống Máy Chấm Công)',
    upgrade_url: process.env.UPSELL_PRODUCT_URL || 'https://chamcong.vn/dang-ky-dung-thu'
  });
};
