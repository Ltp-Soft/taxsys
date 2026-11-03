export async function onRequestGet() {
  return new Response(JSON.stringify({
    status: 'OK',
    service: 'Tax Invoice Sync Cloudflare Serverless Function',
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
