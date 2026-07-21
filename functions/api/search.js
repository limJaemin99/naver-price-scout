/*
 * Cloudflare Pages Function — 네이버 쇼핑 검색 API 프록시
 * ------------------------------------------------------------------
 * 경로: /api/search  (파일 위치 functions/api/search.js 로 자동 매핑)
 *
 * 브라우저는 CORS 때문에 openapi.naver.com 을 직접 호출할 수 없으므로,
 * 이 함수가 "브라우저 → Cloudflare Edge → 네이버 API" 로 그대로 중계(relay)합니다.
 *
 * - API 키는 저장/로깅하지 않습니다. 요청 헤더로 받은 값을 그대로 네이버에 전달만 합니다.
 * - 로컬 개발용 server.js 와 동일한 인터페이스( /api/search?query=&display=&start=&sort= )를
 *   유지하므로, 같은 index.html 이 로컬·배포 양쪽에서 그대로 작동합니다.
 */

const NAVER_ENDPOINT = 'https://openapi.naver.com/v1/search/shop.json';

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const query = url.searchParams.get('query') || '';
  const display = url.searchParams.get('display') || '10';
  const start = url.searchParams.get('start') || '1';
  const sort = url.searchParams.get('sort') || 'sim';
  const exclude = url.searchParams.get('exclude') || ''; // used:rental[:cbshop] 등

  const clientId = context.request.headers.get('x-naver-client-id');
  const clientSecret = context.request.headers.get('x-naver-client-secret');

  if (!clientId || !clientSecret) {
    return json({ errorCode: 'PROXY_400', errorMessage: 'Client ID/Secret 헤더가 없습니다.' }, 400);
  }
  if (!query) {
    return json({ errorCode: 'PROXY_400', errorMessage: '검색어(query)가 비어 있습니다.' }, 400);
  }

  const apiUrl = NAVER_ENDPOINT
    + '?query=' + encodeURIComponent(query)
    + '&display=' + encodeURIComponent(display)
    + '&start=' + encodeURIComponent(start)
    + '&sort=' + encodeURIComponent(sort)
    + (exclude ? '&exclude=' + encodeURIComponent(exclude) : '');

  try {
    const apiRes = await fetch(apiUrl, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });
    // 네이버 응답 본문/상태코드를 그대로 전달 (429 등도 브라우저가 판단하도록)
    const body = await apiRes.text();
    return new Response(body, {
      status: apiRes.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (e) {
    return json({ errorCode: 'PROXY_502', errorMessage: String(e && e.message || e) }, 502);
  }
}
