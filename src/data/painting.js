// data/painting.js

// 상태값
export let paintingsData = [];     // 외부에서 불러온 작품 메타데이터
let currentPage = 0;
let itemsPerPage = 9;              // 기본: 9개(3×3). 모바일에서는 4로 변경

// 1. 외부 서버에서 작품 데이터 fetch
export async function fetchPaintingsData() {
  const url = "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/paintings/metadata.json";
  const res = await fetch(url);
  if (!res.ok) throw new Error("작품 데이터를 불러오는 데 실패");
  paintingsData = await res.json();

  // 페이지 크기/인덱스 보정(데이터 길이 바뀐 직후 안전)
  clampCurrentPage();
  return paintingsData;
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
  clampCurrentPage();
}
export function getPage() {
  return currentPage;
}

// 6. 썸네일 이미지 URL 생성 함수
export function getPaintingThumbUrl(filename) {
  return `https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/paintings/${filename}`;
}

/* ============================
   추가: 페이지 크기 동적 변경
   - 데스크톱: 기본 9 (3×3)
   - 모바일: 필요 시 4 (4×1)
   ============================ */

/** 페이지당 항목 수 설정 (예: 모바일 4 / 데스크톱 9) */
export function setPaintingPageSize(n) {
  const parsed = Number(n);
  if (!Number.isFinite(parsed) || parsed <= 0) return; // 잘못된 값 무시
  itemsPerPage = parsed;
  clampCurrentPage(); // 크기 변경 시 현재 페이지 범위 보정
}

/** 현재 페이지당 항목 수 조회 */
export function getPaintingPageSize() {
  return itemsPerPage;
}

/* 내부 유틸: currentPage를 0 ~ (max-1) 사이로 보정 */
function clampCurrentPage() {
  const maxPages = getTotalPaintingPages();
  if (maxPages <= 0) {
    currentPage = 0;
    return;
  }
  if (currentPage > maxPages - 1) currentPage = maxPages - 1;
  if (currentPage < 0) currentPage = 0;
}