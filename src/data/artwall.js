// data/artwall.js
let artwallsData = []; // 메타데이터 [{filename, title, …}]
let currentArtwallsPage = 0; // 현재 페이지
const artwallsItemsPerPage = 9; // 페이지당 아이템 수

// ─────────────────────────────────────────────────────────────
// [개선] 외부/내부 경로를 바꿔 끼울 수 있도록 베이스 URL 분리
// 기본값: GitHub Raw. 필요하면 setArtwallBase()로 교체하세요.
let _artwallBase = "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/artwalls/";

/** [개선] 아트월 베이스 경로 설정 (같은 오리진/CDN 등으로 교체 가능) */
export function setArtwallBase(url) {
  if (!url) return;
  _artwallBase = url.endsWith("/") ? url : url + "/";
}

/** 아트월 메타데이터 fetch */
export async function fetchArtwallsData() {
  // [개선] 캐시 버스트 + CORS 모드 명시 + 에러 메시지 강화
  const metaUrl = _artwallBase + "metadata_artwalls.json?v=" + Date.now();

  let res;
  try {
    res = await fetch(metaUrl, { cache: "no-store", mode: "cors" });
  } catch (e) {
    // 네트워크/혼합콘텐츠/도메인 차단 등
    throw new Error(`artwalls metadata request failed (network/CORS): ${e?.message || e}`);
  }

  if (!res.ok) {
    // 404 경로/대소문자 오류, 403 레이트 리밋, 0 mixed content 등
    throw new Error(`artwalls metadata HTTP ${res.status} ${res.statusText}`);
  }

  try {
    const json = await res.json();
    if (!Array.isArray(json)) {
      throw new Error("metadata is not an array");
    }
    artwallsData = json;
    return artwallsData;
  } catch (e) {
    // 404 HTML 페이지 등을 JSON으로 파싱하려 할 때 실패하는 케이스 방지
    throw new Error(`artwalls metadata parse failed: ${e?.message || e}`);
  }
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
  // [개선] 공백/한글/특수문자 대응을 위해 인코딩
  return _artwallBase + encodeURIComponent(filename);
}
