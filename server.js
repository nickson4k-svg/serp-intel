/**
 * VibeRadar — Local Development & CORS Proxy Server
 * Pure Node.js (zero dependencies)
 * 
 * Why this is needed:
 * The upstream https://freeserp.ai server currently sends duplicate CORS headers:
 *   access-control-allow-origin: *
 *   access-control-allow-origin: *
 * which browsers combine into "*, *" and reject as a CORS violation ("Failed to fetch").
 * This lightweight local server serves static files AND transparently proxies /api.php
 * with a single, valid Access-Control-Allow-Origin header.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // Set CORS headers for all local endpoints
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // 1. Proxy API requests to FreeSerp, stripping duplicate CORS headers
  if (pathname === '/api.php' || pathname === '/api') {
    // Proxy to /api.php — confirmed working (200 JSON) via server-side probe.
    // The CORS duplicate header issue on the browser is fixed by stripping it here.
    const targetUrl = `https://freeserp.ai/api.php${parsedUrl.search}`;
    
    https.get(targetUrl, (upstreamRes) => {
      // Forward status code
      res.statusCode = upstreamRes.statusCode;

      // Copy headers, ensuring clean single CORS header
      for (const [key, value] of Object.entries(upstreamRes.headers)) {
        const lower = key.toLowerCase();
        if (lower === 'access-control-allow-origin') {
          // Send single valid asterisk
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
    return;
  }

  // 2. Serve static files
  let safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';

  const fullPath = path.join(BASE_DIR, safePath);

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<h1>404 Не знайдено</h1><p>Файл <code>${pathname}</code> не існує.</p>`);
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(fullPath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  ⚡ VibeRadar Local Server успішно запущено!`);
  console.log(`  🌐 Відкрийте у браузері: http://localhost:${PORT}`);
  console.log(`  🧪 Сторінка тестів:      http://localhost:${PORT}/tests.html`);
  console.log(`======================================================\n`);
});
