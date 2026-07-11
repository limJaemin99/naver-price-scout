/*
 * 네이버 쇼핑 검색 API — 로컬 개발/백업용 프록시 서버
 * ------------------------------------------------------------------
 * 네이버 오픈 API는 브라우저의 직접 호출(CORS)을 막기 때문에,
 * 이 작은 서버가 "브라우저 → 이 서버 → 네이버 API" 로 중계합니다.
 *
 *   실행:  node server.js   (또는  npm start)
 *   접속:  http://localhost:3000
 *
 * Cloudflare Pages Function(functions/api/search.js)과 동일한 인터페이스
 * (/api/search?query=&display=&start=&sort=)를 유지하므로, 같은 public/index.html 이
 * 로컬·배포 양쪽에서 그대로 작동합니다. (Node 내장 모듈만 사용 — npm install 불필요)
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// ── 정적 파일 서빙 (public/ 하위, 경로 탈출 차단) ─────────────────
function serveStatic(pathname, res) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.replace(/^\/+/, ''));
  const filePath = path.join(PUBLIC_DIR, rel);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found: ' + rel + '\n(public/ 폴더에 index.html 이 있는지 확인하세요.)');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

// ── 네이버 쇼핑 검색 API 프록시 ──────────────────────────────────
function proxySearch(url, req, res) {
  const query = url.searchParams.get('query') || '';
  const display = url.searchParams.get('display') || '10';
  const start = url.searchParams.get('start') || '1';
  const sort = url.searchParams.get('sort') || 'sim';
  const clientId = req.headers['x-naver-client-id'];
  const clientSecret = req.headers['x-naver-client-secret'];

  if (!clientId || !clientSecret) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ errorCode: 'PROXY_400', errorMessage: 'Client ID/Secret 헤더가 없습니다.' }));
    return;
  }
  if (!query) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ errorCode: 'PROXY_400', errorMessage: '검색어(query)가 비어 있습니다.' }));
    return;
  }

  const apiPath = '/v1/search/shop.json'
    + '?query=' + encodeURIComponent(query)
    + '&display=' + encodeURIComponent(display)
    + '&start=' + encodeURIComponent(start)
    + '&sort=' + encodeURIComponent(sort);

  const options = {
    hostname: 'openapi.naver.com',
    path: apiPath,
    method: 'GET',
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
  };

  const apiReq = https.request(options, (apiRes) => {
    let body = '';
    apiRes.setEncoding('utf8');
    apiRes.on('data', (chunk) => (body += chunk));
    apiRes.on('end', () => {
      console.log(`[${new Date().toLocaleTimeString('ko-KR')}] "${query}" (sort=${sort}) → HTTP ${apiRes.statusCode}`);
      res.writeHead(apiRes.statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(body);
    });
  });
  apiReq.on('error', (e) => {
    console.error('프록시 오류:', e.message);
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ errorCode: 'PROXY_502', errorMessage: e.message }));
  });
  apiReq.end();
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/search') {
    proxySearch(url, req, res);
    return;
  }
  serveStatic(url.pathname, res);
});

server.listen(PORT, () => {
  console.log('\n  ┌───────────────────────────────────────────────┐');
  console.log('  │   네이버 최저가 검색 도구 — 로컬 서버 실행 중   │');
  console.log('  └───────────────────────────────────────────────┘');
  console.log(`\n  브라우저에서 열기 →  http://localhost:${PORT}\n`);
  console.log('  종료하려면 이 창에서 Ctrl + C\n');
});
