// data/painting.js

// 상태값
export let paintingsData = [];     // 외부에서 불러온 작품 메타데이터
let currentPage = 0;
const itemsPerPage = 9;

// ─────────────────────────────────────────────────────────
// 기본(Primary) 메타데이터 URL: GitHub Raw
// 옵션(Alt) 메타데이터 URL: 환경에 따라 지정 (same-origin 등)
// 이미지/썸네일 베이스 URL도 선택적으로 오버라이드 가능
// ─────────────────────────────────────────────────────────
const PRIMARY_META_URL =
  'https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/paintings/metadata.json';

let __ALT_META_URL = null;   // setPaintingsMetaAlt(...) 로 주입
let __IMG_BASE = 'https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/paintings/'; // 기본 이미지 베이스

/** (선택) 옵션 메타데이터 URL 지정: 기본 실패 시 이 URL을 재시도 */
export function setPaintingsMetaAlt(url) {
  __ALT_META_URL = url || null;
}

/** (선택) 썸네일/원본 이미지 베이스 URL 오버라이드 */
export function setPaintingsImageBase(base) {
  if (!base) return;
  __IMG_BASE = base.endsWith('/') ? base : base + '/';
}

/** 내부 유틸: 파일명 안전 인코딩 */
function encodeIfNeeded(name) {
  try { return encodeURI(name); } catch { return name; }
}

/** 썸네일/이미지 URL 생성 함수 */
export function getPaintingThumbUrl(filename) {
  return __IMG_BASE + encodeIfNeeded(filename);
}

/** 공통 fetch 옵션 */
function commonFetchOpts() {
  return {
    mode: 'cors',
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  };
}

// 1. 외부 서버에서 작품 데이터 fetch (기본 → 옵션 순서)
export async function fetchPaintingsData() {
  const candidates = [PRIMARY_META_URL];
  if (__ALT_META_URL) candidates.push(__ALT_META_URL);

  let lastErr;
  for (const url of candidates) {
    try {
      console.debug('[paintings] fetching:', url);
      const res = await fetch(url, commonFetchOpts());
      if (!res.ok) throw new Error(`HTTP ${res.status} (${res.statusText}) from ${new URL(url).host}`);

      const json = await res.json();
      if (!Array.isArray(json)) throw new Error('Invalid metadata format (expecting array)');

      paintingsData = json;
      console.info('[paintings] loaded from:', url);
      return paintingsData;
    } catch (e) {
      lastErr = e;
      console.warn('[paintings] failed:', url, '-', e?.message || e);
      // 다음 후보로 폴백
    }
  }

  const msg = `paintings metadata request failed (network/CORS): ${lastErr?.message || lastErr}`;
  console.error(msg);
  throw new Error(msg);
}

// 2. 현재 전체 작품 데이터 반환
export function getPaintingsData() {
  return paintingsData;
}

// 3. 현재 페이지에 해당하는 작품들 반환
export function getPaintingsByPage(page = currentPage) {
  const start = page * itemsPerPage;
  return paintingsData.slice(start, start + itemsPerPage);
}

// 4. 페이지 수 반환
export function getTotalPaintingPages() {
  return Math.ceil(paintingsData.length / itemsPerPage);
}

// 5. 현재 페이지 상태 관리 함수
export function setPage(page) {
  currentPage = page;
}
export function getPage() {
  return currentPage;
}

// 6. 썸네일 이미지 URL 생성 함수
export function getPaintingThumbUrl(filename) {
  // [개선] 공백/한글/특수문자 대응 인코딩 + 베이스 URL 사용
  return _paintingsBase + encodeURIComponent(filename);
}
