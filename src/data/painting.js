// data/painting.js

// 상태값
export let paintingsData = [];     // 외부에서 불러온 작품 메타데이터
let currentPage = 0;
const itemsPerPage = 9;

// 1. 외부 서버에서 작품 데이터 fetch
export async function fetchPaintingsData() {
  const url = "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/paintings/metadata.json";
  const res = await fetch(url);
  if (!res.ok) throw new Error("작품 데이터를 불러오는 데 실패");
  paintingsData = await res.json();
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
}
export function getPage() {
  return currentPage;
}

// 6. 썸네일 이미지 URL 생성 함수
export function getPaintingThumbUrl(filename) {
  return `https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/paintings/${filename}`;
}