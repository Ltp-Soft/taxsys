const fs = require('fs');
const path = require('path');
const geminiService = require('../services/gemini.service');

const CONFIG_PATH = path.join(__dirname, '../config/tax_api_config.json');

// Đọc cấu hình từ file
const loadConfigFromFile = () => {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('[ConfigController] Error reading tax_api_config.json:', error);
    return null;
  }
};

exports.getConfig = (req, res) => {
  const config = loadConfigFromFile();
  if (!config) {
    return res.status(500).json({ success: false, message: 'Cannot load tax configuration' });
  }

  return res.json({
    success: true,
    data: config
  });
};

exports.healSchema = async (req, res) => {
  try {
    const { sample_data, current_mapping } = req.body;

    if (!sample_data) {
      return res.status(400).json({
        success: false,
        message: 'sample_data is required for schema auto-healing'
      });
    }

    const currentConfig = loadConfigFromFile();
    const mappingToHeal = current_mapping || currentConfig.field_mapping;

    console.log('[ConfigController] Running Gemini AI Schema Healing...');
    const result = await geminiService.healSchema(sample_data, mappingToHeal);

    if (result.updated_mapping && result.confidence >= 0.95) {
      // Tự động cập nhật file tax_api_config.json nếu độ tin cậy > 95%
      currentConfig.field_mapping = result.updated_mapping;
      currentConfig.updated_at = new Date().toISOString();
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(currentConfig, null, 2), 'utf8');
      console.log(`[ConfigController] Successfully auto-healed and updated tax_api_config.json with confidence ${result.confidence}`);
    }

    return res.json({
      success: true,
      data: {
        updated_mapping: result.updated_mapping || mappingToHeal,
        confidence: result.confidence || 0,
        explanation: result.explanation || 'Analyzed by Gemini AI'
      }
    });
  } catch (error) {
    console.error('[ConfigController] healSchema error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Schema healing failed: ' + error.message
    });
  }
};
