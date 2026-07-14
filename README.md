# 🛒 naver-price-scout — 네이버 쇼핑 최저가 일괄 조회 도구

품목 리스트 엑셀을 업로드하면, **네이버 쇼핑 검색 API**로 각 상품의 최저가를 일괄 조회하여
**확정 / 확인필요(사유 포함) / 검색결과없음**으로 자동 분류하고, 결과를 엑셀 2종으로 내려주는
**단일 HTML 웹앱 + Cloudflare Pages Functions 프록시** 프로젝트입니다.

> **절대 원칙:** 확실하지 않은 정보는 반드시 "확인필요"로 표시하고 사유를 기록합니다.
> 과잉 확신(잘못된 확정)이 미탐지보다 훨씬 나쁩니다 — 이 결과로 최종 보고서를 만들기 때문입니다.

---

## 아키텍처

```
[브라우저: public/index.html 단일 파일 앱]
  ├─ 엑셀 업로드/파싱 (ExcelJS, CDN)
  ├─ 검색어 생성 + 미리보기/수정
  ├─ 순차 API 호출 (fetch → /api/search)
  ├─ 판정 파이프라인 (확정/확인필요/검색결과없음)
  └─ 결과 엑셀 2종 생성/다운로드 (ExcelJS)

[프록시: /api/search]  ── 브라우저 → openapi.naver.com 중계 (CORS 우회)
  ├─ 배포:  functions/api/search.js   (Cloudflare Pages Function)
  └─ 로컬:  server.js                 (node, 내장 모듈만 사용)
```

- **API 키는 서버에 저장하지 않습니다.** 브라우저 `localStorage`에만 보관하고, 요청 헤더
  `X-Naver-Client-Id` / `X-Naver-Client-Secret`으로 프록시에 전달하면 프록시는 그대로 릴레이만 합니다.
- 프록시 인터페이스(`GET /api/search?query=&display=&start=&sort=`)가 로컬·배포 양쪽에서 동일하므로,
  **같은 `index.html`이 두 환경에서 그대로 작동**합니다.

---

## 로컬 실행

사전 준비물: [Node.js](https://nodejs.org) 18 이상. (외부 패키지 설치 불필요 — Node 내장 모듈만 사용)

```bash
node server.js
# 또는
npm start
```

실행 후 브라우저에서 **http://localhost:3000** 접속.

> ⚠️ `index.html`을 파일로 직접 열면(`file://`) 네이버 API가 CORS로 차단됩니다.
> 반드시 `server.js`를 실행한 뒤 `http://localhost:3000`으로 접속하세요.

---

## 배포 (Cloudflare Pages)

1. Cloudflare 대시보드 → **Workers & Pages → Create → Pages → Connect to Git**
2. 이 저장소(`naver-price-scout`) 연결
3. 빌드 설정:
   - **Framework preset:** None
   - **Build command:** *(비움)*
   - **Build output directory:** `public`
4. 배포 완료 후, `functions/api/search.js`가 자동으로 `/api/search` 엔드포인트로 동작합니다.

빌드 도구·프레임워크 없이 정적 파일 + Functions만 사용하므로 별도 설정이 필요 없습니다.

---

## 네이버 검색 API 키 발급

1. [developers.naver.com](https://developers.naver.com) → **Application → 애플리케이션 등록**
2. 사용 API에서 **검색**을 선택
3. 발급된 **Client ID / Client Secret**을 앱의 "키 설정" 단계에 입력
   (키는 브라우저 `localStorage`에만 저장되며 외부로 전송되지 않습니다)

- 무료, **일일 호출 한도 25,000건**
- 아무 네이버 계정으로나 발급 가능 (스마트스토어 커머스API와는 완전히 별개 시스템)

---

## 개발 진행 현황

| Phase | 내용 | 상태 |
|---|---|---|
| 1 | 리포 골격 + `server.js` 이식 + Cloudflare Function 프록시 | ✅ 완료 (PR #1) |
| 2 | 엑셀 업로드/파싱 + 브랜드 필터 + 검색어 생성 + 미리보기 | ✅ 완료 (PR #2) |
| 3 | 순차 호출 엔진 (딜레이·429 백오프·스냅샷 저장/재개) | 🚧 진행 중 |
| 4 | 판정 파이프라인 + 단위 테스트 | ⬜ |
| 5 | 결과 엑셀 ①원본형 · ②보고서형 생성 | ⬜ |
| 6 | 실전 테스트 → 임계값 튜닝 → README 완성 | ⬜ |

### Phase 2 메모 (실측 검증됨)
- 실데이터 `원본` 시트 파싱 성공 — 브라우저 ExcelJS 1.2초, **클리오 고유 품명 538개** 확인.
- 검색어 생성: 관리코드 괄호(`(미주전용)`·`(25OYSS)`·`(홈쇼핑전용)` 등) 제거, 콜라보·에디션(`(토이스토리콜라보)`·`[럭셔리에디션]` 등) 유지 — 규칙은 `CONFIG.STRIP_PAREN_*` 상수로 관리.
- 괄호 판정 교차감사(독립 3인 패널): 기존 제거 규칙 오탐 0 확인 + 관리코드 8종(`(일본온라인)`·`(디지털)`·`(미운영)`·`(24SS)`·`(VER.1)`·`(ver2)`·`(해외N)`·`(YY년N절)`) 추가 제거. `(D1)`·`(…팝업)`은 의미 불명확해 유지 후 Phase 6 재검토.
- **Phase 6 튜닝 계획**: `202706월이후` 시트에는 사람이 손으로 정리한 `분류`(카테고리)·`세부`(대표명) 열이 이미 존재. 이를 **정답지(oracle)** 로 삼아 검색어·대표명·카테고리 자동 분류 결과를 대조 검증한다. (이번 Phase에서는 건드리지 않음)

### Phase 3 메모 (순차 호출 엔진)
- 실행 단위 = Step 3 최종 검색어(인라인 수정 반영)의 **고유 검색어 큐**. `CONFIG.CALL_DELAY_MS`(150ms) 간격 순차 호출.
- 오류 처리: HTTP 429 / 네트워크 오류 → 지수 백오프(`CONFIG.RETRY_BACKOFF_MS` 1s→2s→4s, 3회) 후 실패(사유 구분 기록). 401/403 → 전체 중단(키 재확인 안내).
- **저장 구조**: 응답 40건은 판정 필드만 증류(`title`(태그제거)/`lprice`/`mallName`/`link`/`productType`/`brand`/`category1~4`)해 **IndexedDB**(`nps` DB, `results`·`jobs` 스토어)에 캐시. `localStorage`엔 진행 메타(지문·완료수·마지막인덱스·타임스탬프)만.
- **이어하기**: 파일 지문 = 고유 검색어 목록 해시(`PL.hashQueries`). 새로고침 시 메타→작업 복원으로 **파일 재업로드 없이** 이어하기. 캐시된 건은 재호출하지 않음 → Phase 4 임계값 튜닝 시 **API 재호출 없이 재판정** 가능(할당량 절약).
- UI: 진행률 바 + 성공/결과없음/실패/재시도 카운트 + 실시간 로그(최근 20) + 일시정지/재개/중단. 중단해도 캐시 보존. 소량 "샘플만 실행" 지원.
- 판정 로직은 이 Phase에 없음(Phase 4). 결과는 "수신"까지만.
- 견고성(독립 3인 코드리뷰로 발견·수정): 러너 전체 try/finally로 예외 시에도 잠금 해제, 본문 스트리밍 중단도 재시도 처리, 일시 실패(429/네트워크)는 완료로 굳히지 않고 재실행 시 재시도, 캐시를 파일 지문별로 격리(다른 파일의 오래된 결과 재사용 방지), IndexedDB 미가용 환경 안내.

---

## 라이선스

MIT
