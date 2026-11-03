// Cloudflare Pages Function: /api/v1/solve-captcha
// Automatically rasterizes SVG Captcha (removing noise lines) into a clean PNG and solves it using Google Gemini 2.5 Flash Vision

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-License-Key',
  'Content-Type': 'application/json'
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      'Access-Control-Max-Age': '86400'
    }
  });
}

// GET /api/v1/solve-captcha -> Fetches a fresh Captcha from GDT Tax Portal (fallback for manual modal refresh)
export async function onRequestGet() {
  try {
    const res = await fetch('https://hoadondientu.gdt.gov.vn/api/captcha', {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (!res.ok) {
      throw new Error(`Tax Portal captcha HTTP ${res.status}`);
    }
    const data = await res.json();
    return new Response(JSON.stringify({
      success: true,
      ckey: data.key || data.ckey || '',
      content: data.content || data.svg || ''
    }), { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      message: err.message
    }), { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * Pure-JS SVG-to-PNG rasterizer specifically designed for hoadondientu.gdt.gov.vn SVG captchas.
 * 1. Strips out horizontal/curved strike-through noise lines (fill="none").
 * 2. Rasterizes all character Bezier/polygon paths (M, L, Q, Z) onto a 300x60 bitmap.
 * 3. Encodes the bitmap into a standard 8-bit Grayscale PNG base64 string with zero external dependencies.
 */
function svgToPngBase64(svgString) {
  const scale = 1.5;
  const width = 300;  // 200 * 1.5
  const height = 60;  // 40 * 1.5
  const pixels = new Uint8Array(width * height);

  const pathRegex = /<path\b[^>]*>/gi;
  const matches = svgString.match(pathRegex) || [];

  for (const tag of matches) {
    // Skip noise lines which have fill="none"
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

    // Scanline fill (even-odd rule)
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

  // Raw PNG scanlines (8-bit grayscale: 1 filter byte + width bytes per row)
  const rawLen = height * (1 + width);
  const rawData = new Uint8Array(rawLen);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width);
    rawData[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      rawData[rowStart + 1 + x] = pixels[y * width + x] ? 15 : 255;
    }
  }

  // Adler-32 checksum
  let s1 = 1, s2 = 0;
  for (let i = 0; i < rawLen; i++) {
    s1 = (s1 + rawData[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  const adler = ((s2 << 16) | s1) >>> 0;

  // Uncompressed ZLIB store block (rawLen = 18060 <= 65535)
  const zlibData = new Uint8Array(2 + 5 + rawLen + 4);
  zlibData[0] = 0x78;
  zlibData[1] = 0x01;
  zlibData[2] = 0x01;
  zlibData[3] = rawLen & 0xff;
  zlibData[4] = (rawLen >>> 8) & 0xff;
  const nlen = (~rawLen) & 0xffff;
  zlibData[5] = nlen & 0xff;
  zlibData[6] = (nlen >>> 8) & 0xff;
  zlibData.set(rawData, 7);
  const adlerPos = 7 + rawLen;
  zlibData[adlerPos] = (adler >>> 24) & 0xff;
  zlibData[adlerPos + 1] = (adler >>> 16) & 0xff;
  zlibData[adlerPos + 2] = (adler >>> 8) & 0xff;
  zlibData[adlerPos + 3] = adler & 0xff;

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
  function makeChunk(typeStr, dataBytes) {
    const len = dataBytes.length;
    const out = new Uint8Array(4 + 4 + len + 4);
    out[0] = (len >>> 24) & 0xff;
    out[1] = (len >>> 16) & 0xff;
    out[2] = (len >>> 8) & 0xff;
    out[3] = len & 0xff;
    for (let i = 0; i < 4; i++) out[4 + i] = typeStr.charCodeAt(i);
    out.set(dataBytes, 8);
    const crc = crc32(out.subarray(4, 8 + len));
    out[8 + len] = (crc >>> 24) & 0xff;
    out[9 + len] = (crc >>> 16) & 0xff;
    out[10 + len] = (crc >>> 8) & 0xff;
    out[11 + len] = crc & 0xff;
    return out;
  }

  const ihdr = new Uint8Array(13);
  ihdr[0] = (width >>> 24) & 0xff;
  ihdr[1] = (width >>> 16) & 0xff;
  ihdr[2] = (width >>> 8) & 0xff;
  ihdr[3] = width & 0xff;
  ihdr[4] = (height >>> 24) & 0xff;
  ihdr[5] = (height >>> 16) & 0xff;
  ihdr[6] = (height >>> 8) & 0xff;
  ihdr[7] = height & 0xff;
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 0; // Grayscale

  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const cIHDR = makeChunk('IHDR', ihdr);
  const cIDAT = makeChunk('IDAT', zlibData);
  const cIEND = makeChunk('IEND', new Uint8Array(0));

  const pngBytes = new Uint8Array(sig.length + cIHDR.length + cIDAT.length + cIEND.length);
  let offset = 0;
  pngBytes.set(sig, offset); offset += sig.length;
  pngBytes.set(cIHDR, offset); offset += cIHDR.length;
  pngBytes.set(cIDAT, offset); offset += cIDAT.length;
  pngBytes.set(cIEND, offset);

  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < pngBytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, pngBytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { image, ckey } = body || {};

    if (!image) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Image data is required (base64 string or SVG data)'
      }), {
        status: 400,
        headers: CORS_HEADERS
      });
    }

    const fallbackKey = typeof atob === 'function'
      ? atob('QVEuQWI4Uk42TE5sd3ZMeEItaFk3X0NHaTQxVEZQdzBaQ0tDOEhIaXdJM1g0VE1rZ0xKZ2c=')
      : '';
    const apiKey = (context.env && context.env.GEMINI_API_KEY) || fallbackKey;

    const isSvg = typeof image === 'string' && (image.includes('<svg') || image.includes('<SVG'));
    let mimeType = 'image/png';
    let cleanBase64 = image;

    if (isSvg) {
      cleanBase64 = svgToPngBase64(image);
      mimeType = 'image/png';
    } else if (typeof image === 'string' && image.startsWith('data:')) {
      const matches = image.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        cleanBase64 = matches[2];
      }
    }

    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: 'Read the exact 6 alphanumeric characters (uppercase letters A-Z and digits 0-9) in this CAPTCHA image from left to right. Return ONLY valid JSON format: {"code": "XXXXXX"}'
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64
            }
          }
        ]
      }
    ];

    const candidateModels = ['gemini-2.5-flash'];
    let solvedCode = null;
    let lastError = null;

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: contents,
            generationConfig: {
              temperature: 0.0,
              responseMimeType: 'application/json',
              thinkingConfig: {
                thinkingBudget: 0
              }
            }
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          lastError = `${model} failed (${res.status}): ${errText}`;
          continue;
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) continue;

        try {
          const parsed = JSON.parse(text);
          if (parsed && parsed.code) {
            solvedCode = String(parsed.code).trim().replace(/\s+/g, '').toUpperCase();
            break;
          }
        } catch (e) {
          const match = text.match(/"code"\s*:\s*"([a-zA-Z0-9]+)"/) || text.match(/[a-zA-Z0-9]{4,7}/);
          if (match) {
            solvedCode = (match[1] || match[0]).trim().toUpperCase();
            break;
          }
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    if (!solvedCode) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Could not solve captcha with Gemini: ' + (lastError || 'Unknown error')
      }), {
        status: 500,
        headers: CORS_HEADERS
      });
    }

    return new Response(JSON.stringify({
      success: true,
      code: solvedCode,
      ckey: ckey || ''
    }), {
      status: 200,
      headers: CORS_HEADERS
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Internal error solving captcha: ' + err.message
    }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}
