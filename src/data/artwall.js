// data/artwall.js

let artwallsData = []; // 메타데이터 [{filename, title, …}]
let currentArtwallsPage = 0; // 현재 페이지
const artwallsItemsPerPage = 9; // 페이지당 아이템 수

// ─────────────────────────────────────────────────────────
// 기본(Primary) 메타데이터 URL: GitHub Raw
// 옵션(Alt) 메타데이터 URL: 환경에 따라 지정 (same-origin 등)
// 이미지 베이스도 선택적으로 오버라이드 가능
// ─────────────────────────────────────────────────────────
const PRIMARY_META_URL =
  'https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/artwalls/metadata_artwalls.json';

let __ALT_META_URL = null;   // setArtwallsMetaAlt(...) 로 주입
let __IMG_BASE =
  'https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/artwalls/';

/** (선택) 옵션 메타데이터 URL 지정 */
export function setArtwallsMetaAlt(url) {
  __ALT_META_URL = url || null;
}

/** (선택) 썸네일 베이스 URL 오버라이드 */
export function setArtwallImageBase(base) {
  if (!base) return;
  __IMG_BASE = base.endsWith('/') ? base : base + '/';
}

/** 내부 유틸 */
function encodeIfNeeded(name) {
  try { return encodeURI(name); } catch { return name; }
}

/** 아트월 메타데이터 fetch (기본 → 옵션) */
export async function fetchArtwallsData() {
  const candidates = [PRIMARY_META_URL];
  if (__ALT_META_URL) candidates.push(__ALT_META_URL);

  let lastErr;
  for (const url of candidates) {
    try {
      console.debug('[artwalls] fetching:', url);
      const res = await fetch(url, { mode: 'cors', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!res.ok) throw new Error(`HTTP ${res.status} (${res.statusText}) from ${new URL(url).host}`);
      const json = await res.json();
      if (!Array.isArray(json)) throw new Error('Invalid metadata format (expecting array)');
      artwallsData = json;
      console.info('[artwalls] loaded from:', url);
      return artwallsData;
    } catch (e) {
      lastErr = e;
      console.warn('[artwalls] failed:', url, '-', e?.message || e);
    }
  }
  const msg = `artwalls metadata request failed (network/CORS): ${lastErr?.message || lastErr}`;
  console.error(msg);
  throw new Error(msg);
}

/** 전체 아트월 데이터 반환 */
export function getArtwallsData() {
  return artwallsData;
}

/** 현재 페이지 번호 반환 */
export function getArtwallPage() {
  return currentArtwallsPage;
}

/** 페이지 설정 */
export function setArtwallPage(page) {
  currentArtwallsPage = page;
}

/** 현재 페이지의 아트월 데이터 반환 */
export function getArtwallsByPage(page = currentArtwallsPage) {
  const start = page * artwallsItemsPerPage;
  return artwallsData.slice(start, start + artwallsItemsPerPage);
}

/** 전체 페이지 수 반환 */
export function getTotalArtwallPages() {
  return Math.ceil(artwallsData.length / artwallsItemsPerPage);
}

/** 썸네일 이미지 URL 반환 */
export function getArtwallThumbUrl(filename) {
  return __IMG_BASE + encodeIfNeeded(filename);
}
