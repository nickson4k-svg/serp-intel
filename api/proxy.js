const https = require('https');

module.exports = (req, res) => {
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const targetUrl = `https://freeserp.ai/api.php${query}`;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  https.get(targetUrl, (upstreamRes) => {
    res.statusCode = upstreamRes.statusCode;

    for (const [key, value] of Object.entries(upstreamRes.headers)) {
      if (key.toLowerCase() === 'access-control-allow-origin') {
        continue;
      }
      res.setHeader(key, value);
    }
    res.setHeader('Access-Control-Allow-Origin', '*');

    upstreamRes.pipe(res);
  }).on('error', (err) => {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'proxy_error', detail: err.message }));
  });
};
