const { GoogleGenAI } = require('@google/genai');

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    if (this.apiKey) {
      this.ai = new GoogleGenAI({ apiKey: this.apiKey });
    } else {
      this.ai = null;
    }
  }

  getAI() {
    if (!this.ai && process.env.GEMINI_API_KEY) {
      this.apiKey = process.env.GEMINI_API_KEY;
      this.ai = new GoogleGenAI({ apiKey: this.apiKey });
    }
    return this.ai;
  }

  /**
   * Giải mã Captcha từ ảnh SVG hoặc Base64 PNG/JPG
   * @param {string} imageData - Chuỗi base64 hoặc SVG string hoặc data URI
   * @returns {Promise<string>} Mã captcha (5-6 ký tự)
   */
  async solveCaptcha(imageData) {
    const ai = this.getAI();
    if (!ai) {
      throw new Error('GEMINI_API_KEY is not configured on Backend. Please set GEMINI_API_KEY in .env');
    }

    try {
      let mimeType = 'image/png';
      let cleanBase64 = imageData;

      // Handle data URL prefix
      if (typeof imageData === 'string' && imageData.startsWith('data:')) {
        const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          cleanBase64 = matches[2];
        }
      } else if (typeof imageData === 'string' && imageData.trim().startsWith('<svg')) {
        mimeType = 'image/svg+xml';
        cleanBase64 = Buffer.from(imageData).toString('base64');
      }

      const promptText = 'Read the exact alphanumeric characters in this CAPTCHA image. Ignore horizontal strike-through lines and background noise. Return ONLY the raw string in JSON format: {"code": "XXXXX"}.';

      const contents = [
        {
          role: 'user',
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType: mimeType,
                data: cleanBase64
              }
            }
          ]
        }
      ];

      const candidateModels = [this.modelName, 'gemini-3.8-flash', 'gemini-3.5-flash'];
      let response = null;
      let lastErr = null;

      for (const m of candidateModels) {
        try {
          response = await ai.models.generateContent({
            model: m,
            contents: contents,
            config: {
              temperature: 0.1,
              responseMimeType: 'application/json'
            }
          });
          if (response && response.text) break;
        } catch (err) {
          lastErr = err;
          console.warn(`[GeminiService] Model ${m} failed, trying next fallback:`, err.message);
        }
      }

      if (!response || !response.text) {
        throw lastErr || new Error('All Gemini models failed to resolve captcha');
      }

      const responseText = response.text?.trim() || '';
      try {
        const parsed = JSON.parse(responseText);
        if (parsed.code) {
          return String(parsed.code).trim().replace(/\s+/g, '');
        }
      } catch (err) {
        // Fallback: extract regex if not pure JSON
        const match = responseText.match(/"code"\s*:\s*"([a-zA-Z0-9]+)"/i) || responseText.match(/([a-zA-Z0-9]{4,8})/);
        if (match) return match[1];
      }

      throw new Error(`Failed to parse captcha text from Gemini output: ${responseText}`);
    } catch (error) {
      console.error('[GeminiService] Error solving captcha:', error.message);
      throw error;
    }
  }

  /**
   * Tự động ánh xạ lại field mapping khi phát hiện thay đổi schema (Schema Drift Self-Healing)
   * @param {Object} sampleData - Phần tử datas[0] đã ẩn danh (sanitized)
   * @param {Object} currentMapping - Bản đồ field_mapping hiện tại
   * @returns {Promise<Object>} { updatedMapping: Object, confidence: number, explanation: string }
   */
  async healSchema(sampleData, currentMapping) {
    const ai = this.getAI();
    if (!ai) {
      throw new Error('GEMINI_API_KEY is not configured on Backend.');
    }

    const systemPrompt = `You are an expert AI system specialized in Vietnamese e-invoice data schemas (Tổng cục Thuế - hoadondientu.gdt.gov.vn).
The client detected that some key fields in the invoice payload are undefined when mapped using the existing mapping.
Here is a sanitized JSON sample of a real invoice returned by the tax authority API:
${JSON.stringify(sampleData, null, 2)}

Here is the CURRENT target field mapping we need to populate:
${JSON.stringify(currentMapping, null, 2)}

Target fields needed:
- id: invoice unique id
- ky_hieu_mau_so: invoice form symbol (e.g. 1, 2, C23...)
- ky_hieu_hoa_don: invoice series/serial (e.g. C24TAA, 1C24...)
- so_hoa_don: invoice number (e.g. 1, 12345)
- ngay_lap: invoice creation date/timestamp
- mst_nguoi_ban: seller tax code
- ten_nguoi_ban: seller name
- dia_chi_nguoi_ban: seller address
- mst_nguoi_mua: buyer tax code
- ten_nguoi_mua: buyer name
- dia_chi_nguoi_mua: buyer address
- tong_tien_chua_thue: total amount before tax
- tong_tien_thue: total VAT / tax amount
- tong_tien_chiet_khau: trade discount
- tong_tien_thanh_toan: grand total payment amount
- don_vi_tien_te: currency (e.g. VND)
- ty_gia: exchange rate
- trang_thai_hoa_don: invoice status code (e.g. 1, 2, 3, 4, 5, 6)
- ket_qua_kiem_tra: tax authority check/processing status

Analyze the JSON keys in the sample data (often abbreviations of Vietnamese words like khmshdon, khhdon, shdon, tdlap, nbmst, nbten, nbdchi, nmmst, nmten, nmdchi, tgtcthue, tgtthue, ttcktmai, tgtttbso, dvtte, tgia, tthai, ttxly).
Find the corresponding field name in the sample data for each target field.
Return ONLY a valid JSON object with:
{
  "updated_mapping": { ... },
  "confidence": 0.98,
  "explanation": "Brief description of changes made"
}`;

    const response = await ai.models.generateContent({
      model: this.modelName || 'gemini-3.5-flash-lite',
      contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    return parsed;
  }

  /**
   * Đối chiếu thay đổi JavaScript bundle từ trang hoadondientu.gdt.gov.vn
   */
  async analyzeBundleChanges(jsSnippet, currentConfig) {
    const ai = this.getAI();
    if (!ai) return null;

    const prompt = `Analyze this JavaScript bundle snippet from the Vietnamese General Department of Taxation website.
We want to verify if any API endpoints, query parameter names, or invoice payload fields have changed compared to our current config:
Current Config:
${JSON.stringify(currentConfig, null, 2)}

JS Snippet:
${jsSnippet}

Return JSON with:
{
  "has_breaking_changes": boolean,
  "detected_endpoints": [ ... ],
  "suggested_config_patches": { ... },
  "notes": "..."
}`;

    const response = await ai.models.generateContent({
      model: this.modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    });

    return JSON.parse(response.text?.trim() || '{}');
  }
}

module.exports = new GeminiService();
