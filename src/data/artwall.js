// data/artwall.js

let artwallsData = []; // 메타데이터 [{filename, title, …}]
let currentArtwallsPage = 0; // 현재 페이지
// const → let 으로 변경: 반응형에 맞춰 동적으로 9↔4 전환
let artwallsItemsPerPage = 9; // 기본: 9개(3×3). 모바일에서는 4로 변경

/** 아트월 메타데이터 fetch */
export async function fetchArtwallsData() {
  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/artwalls/metadata_artwalls.json"
    );
    if (!res.ok) throw new Error("아트월 데이터를 불러오는 데 실패");
    artwallsData = await res.json();
  } catch (e) {
    console.error(e);
    artwallsData = []; // 안전 기본값
  } finally {
    // 페이지 크기/인덱스 보정(데이터 길이 바뀐 직후 안전)
    clampCurrentArtwallsPage();
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
  clampCurrentArtwallsPage();
}

/** 현재 페이지의 아트월 데이터 반환 */
export function getArtwallsByPage(page = currentArtwallsPage) {
  const start = page * artwallsItemsPerPage;
  return artwallsData.slice(start, start + artwallsItemsPerPage);
}

/** 전체 페이지 수 반환 */
export function getTotalArtwallPages() {
  if (!Array.isArray(artwallsData) || artwallsData.length === 0) return 1; // 최소 1
  return Math.ceil(artwallsData.length / artwallsItemsPerPage);
}

/** 썸네일 이미지 URL 반환 */
export function getArtwallThumbUrl(filenameOrItem) {
  // 문자열(filename) 또는 객체({ thumb | filename }) 모두 지원 (하위호환)
  const filename = typeof filenameOrItem === "string"
    ? filenameOrItem
    : (filenameOrItem?.thumb || filenameOrItem?.filename || "");
  return `https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/artwalls/${filename}`;
}

/* ============================
   추가: 페이지 크기 동적 변경
   - 데스크톱: 기본 9 (3×3)
   - 모바일: 필요 시 4 (4×1)
   ============================ */

/** 페이지당 항목 수 설정 (예: 모바일 4 / 데스크톱 9) */
export function setArtwallPageSize(n) {
  const parsed = Number(n);
  if (!Number.isFinite(parsed) || parsed <= 0) return; // 잘못된 값 무시
  artwallsItemsPerPage = parsed;
  clampCurrentArtwallsPage(); // 크기 변경 시 현재 페이지 범위 보정
}

/** 현재 페이지당 항목 수 조회 */
export function getArtwallPageSize() {
  return artwallsItemsPerPage;
}

/* 내부 유틸: currentArtwallsPage를 0 ~ (max-1) 사이로 보정 */
function clampCurrentArtwallsPage() {
  const maxPages = getTotalArtwallPages();
  if (maxPages <= 0) {
    currentArtwallsPage = 0;
    return;
  }
  if (currentArtwallsPage > maxPages - 1) currentArtwallsPage = maxPages - 1;
  if (currentArtwallsPage < 0) currentArtwallsPage = 0;
}