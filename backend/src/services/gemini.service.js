const { GoogleGenAI } = require('@google/genai');
const zlib = require('zlib');

const FALLBACK_GEMINI_KEY = Buffer.from('QVEuQWI4Uk42TE5sd3ZMeEItaFk3X0NHaTQxVEZQdzBaQ0tDOEhIaXdJM1g0VE1rZ0xKZ2c=', 'base64').toString('utf-8');

function svgToPngBase64(svgString) {
  const scale = 1.5;
  const width = 300;
  const height = 60;
  const pixels = new Uint8Array(width * height);

  const pathRegex = /<path\b[^>]*>/gi;
  const matches = svgString.match(pathRegex) || [];

  for (const tag of matches) {
    if (tag.includes('fill="none"') || (tag.includes('stroke=') && !tag.includes('fill='))) {
      continue;
    }
    const dMatch = tag.match(/\bd="([^"]+)"/i);
    if (!dMatch) continue;
    const d = dMatch[1];

    const polygons = [];
    let currentPoly = [];
    let cx = 0, cy = 0;
    const cmdRegex = /([MLQZ])\s*([^MLQZ]*)/gi;
    let m;
    while ((m = cmdRegex.exec(d)) !== null) {
      const type = m[1].toUpperCase();
      const args = m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if (type === 'M' && args.length >= 2) {
        if (currentPoly.length > 0) polygons.push(currentPoly);
        cx = args[0] * scale;
        cy = args[1] * scale;
        currentPoly = [[cx, cy]];
      } else if (type === 'L' && args.length >= 2) {
        cx = args[0] * scale;
        cy = args[1] * scale;
        currentPoly.push([cx, cy]);
      } else if (type === 'Q' && args.length >= 4) {
        const qx = args[0] * scale, qy = args[1] * scale;
        const ex = args[2] * scale, ey = args[3] * scale;
        for (let t = 0.25; t <= 1.0; t += 0.25) {
          const it = 1 - t;
          const px = it * it * cx + 2 * it * t * qx + t * t * ex;
          const py = it * it * cy + 2 * it * t * qy + t * t * ey;
          currentPoly.push([px, py]);
        }
        cx = ex; cy = ey;
      } else if (type === 'Z') {
        if (currentPoly.length > 0) {
          polygons.push(currentPoly);
          currentPoly = [];
        }
      }
    }
    if (currentPoly.length > 0) polygons.push(currentPoly);

    for (let y = 0; y < height; y++) {
      const scanY = y + 0.5;
      const intersections = [];
      for (const poly of polygons) {
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const [x1, y1] = poly[i];
          const [x2, y2] = poly[j];
          if ((y1 <= scanY && y2 > scanY) || (y2 <= scanY && y1 > scanY)) {
            const x = x1 + ((scanY - y1) / (y2 - y1)) * (x2 - x1);
            intersections.push(x);
          }
        }
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i + 1 < intersections.length; i += 2) {
        const startX = Math.max(0, Math.floor(intersections[i]));
        const endX = Math.min(width - 1, Math.ceil(intersections[i + 1]));
        for (let x = startX; x <= endX; x++) {
          pixels[y * width + x] = 1;
        }
      }
    }
  }

  const rawData = Buffer.alloc(height * (1 + width));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width);
    rawData[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      rawData[rowStart + 1 + x] = pixels[y * width + x] ? 15 : 255;
    }
  }
  const compressed = zlib.deflateSync(rawData);

  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[n] = c;
  }
  function crc32(buf) {
    let c = -1;
    for (let i = 0; i < buf.length; i++) {
      c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
    }
    return (c ^ -1) >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeAndData = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData), 0);
    return Buffer.concat([len, typeAndData, crc]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]).toString('base64');
}

class GeminiService {
  constructor() {
    try { require('dotenv').config(); } catch (e) {}
    this.apiKey = process.env.GEMINI_API_KEY || FALLBACK_GEMINI_KEY;
    this.modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    if (this.apiKey) {
      this.ai = new GoogleGenAI({ apiKey: this.apiKey });
    } else {
      this.ai = null;
    }
  }

  getAI() {
    if (!this.ai) {
      try { require('dotenv').config(); } catch (e) {}
      this.apiKey = process.env.GEMINI_API_KEY || FALLBACK_GEMINI_KEY;
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
      const isSvg = typeof imageData === 'string' && (imageData.includes('<svg') || imageData.includes('<SVG'));
      let mimeType = 'image/png';
      let cleanBase64 = imageData;

      if (isSvg) {
        cleanBase64 = svgToPngBase64(imageData);
        mimeType = 'image/png';
      } else if (typeof imageData === 'string' && imageData.startsWith('data:')) {
        const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          cleanBase64 = matches[2];
        }
      }

      const promptText = 'Read the exact 6 alphanumeric characters (uppercase letters A-Z and digits 0-9) in this CAPTCHA image from left to right. Return ONLY valid JSON format: {"code": "XXXXXX"}.';

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

      const candidateModels = [this.modelName || 'gemini-2.5-flash', 'gemini-2.5-flash'];
      let response = null;
      let lastErr = null;

      for (const m of candidateModels) {
        try {
          response = await ai.models.generateContent({
            model: m,
            contents: contents,
            config: {
              temperature: 0.1,
              responseMimeType: 'application/json',
              thinkingConfig: {
                thinkingBudget: 0
              }
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
      model: this.modelName || 'gemini-2.5-flash',
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
