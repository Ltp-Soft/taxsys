const geminiService = require('../services/gemini.service');

exports.solveCaptcha = async (req, res) => {
  try {
    const { image, ckey } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Image data is required (base64 string or SVG data)'
      });
    }

    console.log(`[CaptchaController] Solving captcha for ckey: ${ckey || 'N/A'}`);
    const code = await geminiService.solveCaptcha(image);

    console.log(`[CaptchaController] Successfully resolved captcha: ${code}`);
    return res.json({
      success: true,
      code: code,
      ckey: ckey
    });
  } catch (error) {
    console.error('[CaptchaController] Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to solve captcha with AI: ' + error.message
    });
  }
};
