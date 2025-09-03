// data/painting.js

// 상태값
export let paintingsData = [];     // 외부에서 불러온 작품 메타데이터
let currentPage = 0;
const itemsPerPage = 9;

// ─────────────────────────────────────────────────────────────
// [개선] 외부/내부 경로를 교체할 수 있도록 베이스 URL 분리
// 기본값: GitHub Raw. 필요 시 setPaintingBase()로 같은 오리진/CDN으로 교체.
let _paintingsBase = "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/paintings/";

/** [개선] 페인팅 데이터 베이스 경로 설정 */
export function setPaintingBase(url) {
  if (!url) return;
  _paintingsBase = url.endsWith("/") ? url : url + "/";
}

// 1. 외부 서버에서 작품 데이터 fetch
export async function fetchPaintingsData() {
  // [개선] 캐시 버스트 + CORS 모드 명시 + 에러 메시지 강화
  const metaUrl = _paintingsBase + "metadata.json?v=" + Date.now();

  let res;
  try {
    res = await fetch(metaUrl, { cache: "no-store", mode: "cors" });
  } catch (e) {
    throw new Error(`paintings metadata request failed (network/CORS): ${e?.message || e}`);
  }

  if (!res.ok) {
    throw new Error(`paintings metadata HTTP ${res.status} ${res.statusText}`);
  }

  try {
    const json = await res.json();
    if (!Array.isArray(json)) {
      throw new Error("metadata is not an array");
    }
    paintingsData = json;
    return paintingsData;
  } catch (e) {
    throw new Error(`paintings metadata parse failed: ${e?.message || e}`);
  }
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
