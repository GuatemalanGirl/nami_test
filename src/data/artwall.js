// data/artwall.js
let artwallsData = []; // 메타데이터 [{filename, title, …}]
let currentArtwallsPage = 0; // 현재 페이지
const artwallsItemsPerPage = 9; // 페이지당 아이템 수

/** 아트월 메타데이터 fetch */
export async function fetchArtwallsData() {
  const res = await fetch(
    "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/artwalls/metadata_artwalls.json"
  );
  artwallsData = await res.json();
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
  return `https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/artwalls/${filename}`;
}
