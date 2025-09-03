// data/texture.js

let textureSetsData = [] // [{ set, thumb, floor, ceiling, walls }]
let currentTexturePage = 0
const texturesPerPage = 9 // 페이지당 9개 (3×3)

// ─────────────────────────────────────────────────────────
// 기본(Primary) 메타데이터 URL: GitHub Raw
// 옵션(Alt) 메타데이터 URL: 환경에 따라 지정 (same-origin 등)
// 썸네일/리소스 베이스도 선택적으로 오버라이드 가능
// ─────────────────────────────────────────────────────────
const PRIMARY_META_URL =
  'https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/metadata_textures.json';

let __ALT_META_URL = null;   // setTexturesMetaAlt(...) 로 주입
let __IMG_BASE =
  'https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/';

/** (선택) 옵션 메타데이터 URL 지정 */
export function setTexturesMetaAlt(url) {
  __ALT_META_URL = url || null;
}

/** (선택) 썸네일/리소스 베이스 URL 오버라이드 */
export function setTexturesImageBase(base) {
  if (!base) return;
  __IMG_BASE = base.endsWith('/') ? base : base + '/';
}

/** 내부 유틸 */
function encodeIfNeeded(name) {
  try { return encodeURI(name); } catch { return name; }
}

// metadata_textures.json에서 texture set 정보를 불러옴 (기본 → 옵션)
export async function fetchTextureSets() {
  const candidates = [PRIMARY_META_URL];
  if (__ALT_META_URL) candidates.push(__ALT_META_URL);

  let lastErr;
  for (const url of candidates) {
    try {
      console.debug('[textures] fetching:', url);
      const res = await fetch(url, { mode: 'cors', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!res.ok) throw new Error(`HTTP ${res.status} (${res.statusText}) from ${new URL(url).host}`);
      const json = await res.json();
      if (!Array.isArray(json)) throw new Error('Invalid metadata format (expecting array)');
      textureSetsData = json;
      console.info('[textures] loaded from:', url);
      return textureSetsData;
    } catch (e) {
      lastErr = e;
      console.warn('[textures] failed:', url, '-', e?.message || e);
    }
  }
  const msg = `texture sets metadata request failed (network/CORS): ${lastErr?.message || lastErr}`;
  console.error(msg);
  throw new Error(msg);
}

export function getTextureSets() {
  return textureSetsData;
}

export function getTextureSetByName(name) {
  return textureSetsData.find((t) => t.set === name);
}

// 현재 페이지 반환
export function getTexturePage() {
  return currentTexturePage;
}

// 페이지 설정
export function setTexturePage(page) {
  currentTexturePage = page;
}

// 현재 페이지의 텍스처셋 반환
export function getTextureSetsByPage(page = currentTexturePage) {
  const start = page * texturesPerPage;
  return textureSetsData.slice(start, start + texturesPerPage);
}

// 전체 페이지 수 반환
export function getTotalTexturePages() {
  return Math.ceil(textureSetsData.length / texturesPerPage);
}

/** 썸네일/리소스 URL (필요 시 외부에서 직접 사용) */
export function getTextureAssetUrl(filename) {
  return __IMG_BASE + encodeIfNeeded(filename);
}
