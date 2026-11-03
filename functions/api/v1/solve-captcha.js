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
      contents = [
        {
          role: 'user',
          parts: [
            {
              text: `You are an expert OCR system for Vietnamese tax authority CAPTCHAs (hoadondientu.gdt.gov.vn).
Here is the CAPTCHA SVG markup:
\`\`\`xml
${image}
\`\`\`
Extract the exact 5 to 6 alphanumeric characters displayed in the CAPTCHA. Ignore strike-through curves, noise lines, and background interference.
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

    const candidateModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
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
              responseMimeType: 'application/json'
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
