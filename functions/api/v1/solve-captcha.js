// Cloudflare Pages Function: /api/v1/solve-captcha
// Automatically solves SVG or Base64 Captcha using Google Gemini 2.5 Flash

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-License-Key',
      'Access-Control-Max-Age': '86400'
    }
  });
}

function normalizeAndSortSvgCaptcha(svgString) {
  try {
    const pathRegex = /<path\b[^>]*>/gi;
    const matches = svgString.match(pathRegex) || [];
    const charPaths = [];

    for (const tag of matches) {
      if (tag.includes('fill="none"') || (tag.includes('stroke=') && !tag.includes('fill='))) {
        continue;
      }
      const dMatch = tag.match(/\bd="([^"]+)"/i);
      if (!dMatch) continue;
      const d = dMatch[1];
      const coordRegex = /[MLQ](\d+\.?\d*)\s+(\d+\.?\d*)/gi;
      let cm;
      const xs = [];
      while ((cm = coordRegex.exec(d)) !== null) {
        xs.push(parseFloat(cm[1]));
      }
      if (xs.length > 5) {
        const minX = Math.min(...xs);
        charPaths.push({ minX, tag });
      }
    }

    if (charPaths.length >= 4) {
      charPaths.sort((a, b) => a.minX - b.minX);
      return {
        sortedSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="40" viewBox="0,0,200,40">' +
                   charPaths.map(c => c.tag).join('') + '</svg>',
        count: charPaths.length
      };
    }
  } catch (e) {
    console.warn('SVG sorting error, fallback to raw:', e);
  }
  return { sortedSvg: svgString, count: 0 };
}

export async function onRequestPost(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-License-Key',
    'Content-Type': 'application/json'
  };

  try {
    const body = await context.request.json();
    const { image, ckey } = body || {};

    if (!image) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Image data is required (base64 string or SVG data)'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const fallbackKey = typeof atob === 'function'
      ? atob('QVEuQWI4Uk42TE5sd3ZMeEItaFk3X0NHaTQxVEZQdzBaQ0tDOEhIaXdJM1g0VE1rZ0xKZ2c=')
      : '';
    const apiKey = (context.env && context.env.GEMINI_API_KEY) || fallbackKey;

    const isSvg = typeof image === 'string' && (image.includes('<svg') || image.includes('<SVG'));
    let contents;

    if (isSvg) {
      const { sortedSvg, count } = normalizeAndSortSvgCaptcha(image);
      contents = [
        {
          role: 'user',
          parts: [
            {
              text: `You are an expert OCR system for Vietnamese tax authority CAPTCHAs (hoadondientu.gdt.gov.vn).
The character paths in this SVG markup have been sorted in STRICT LEFT-TO-RIGHT READING ORDER.
Here is the CAPTCHA SVG markup:
\`\`\`xml
${sortedSvg}
\`\`\`
Each path represents exactly one character from left to right.
Extract the exact ${count > 0 ? count : '5 to 6'} alphanumeric characters displayed (uppercase letters and digits).
Return ONLY valid JSON in format: {"code": "XXXXX"}`
            }
          ]
        }
      ];
    } else {
      let mimeType = 'image/png';
      let cleanBase64 = image;
      if (typeof image === 'string' && image.startsWith('data:')) {
        const matches = image.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          cleanBase64 = matches[2];
        }
      }

      contents = [
        {
          role: 'user',
          parts: [
            {
              text: 'Read the exact alphanumeric characters in this CAPTCHA image. Ignore horizontal strike-through lines and background noise. Return ONLY valid JSON format: {"code": "XXXXX"}.'
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
    }

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
              temperature: 0.1,
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
            solvedCode = parsed.code.trim();
            break;
          }
        } catch (e) {
          const match = text.match(/"code"\s*:\s*"([a-zA-Z0-9]+)"/) || text.match(/[a-zA-Z0-9]{4,7}/);
          if (match) {
            solvedCode = (match[1] || match[0]).trim();
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
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({
      success: true,
      code: solvedCode,
      ckey: ckey || ''
    }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Serverless Captcha Error: ' + error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}
