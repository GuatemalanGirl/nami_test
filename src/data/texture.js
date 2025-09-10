// data/texture.js

let textureSetsData = [] // [{ set, thumb, floor, ceiling, walls }]
let currentTexturePage = 0
let texturesPerPage = 9 // 페이지당 9개 (3×3)  ← 기존 유지하되, 모바일에서 4로 변경 가능하도록 let으로 전환

// metadata_textures.json에서 texture set 정보를 불러옴
export async function fetchTextureSets() {
  const url = "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/metadata_textures.json";
  const res = await fetch(url);
  if (!res.ok) throw new Error("텍스처 정보를 불러오는데 실패");
  textureSetsData = await res.json();

  // 페이지 크기/페이지 인덱스가 유효 범위를 벗어나지 않도록 보정
  clampCurrentPage();
  return textureSetsData;
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
  clampCurrentPage();
}

// 현재 페이지의 텍스처셋 반환
export function getTextureSetsByPage(page = currentTexturePage) {
  const start = page * texturesPerPage;
  return textureSetsData.slice(start, start + texturesPerPage);
}

// 전체 페이지 수 반환
export function getTotalTexturePages() {
  // 데이터가 없을 때 0이 아닌 1로 처리하면 UI에서 음수 인덱스 방지에 도움이 될 수 있음
  return Math.ceil(textureSetsData.length / texturesPerPage);
}

/* ============================
   추가: 페이지 크기 동적 변경
   - 데스크톱: 기본 9 (3×3)
   - 모바일: 필요 시 4 (4×1)
   ============================ */

/**
 * 페이지당 아이템 수를 동적으로 변경
 * @param {number} n - 페이지당 텍스처 수 (예: 데스크톱=9, 모바일=4)
 */
export function setTexturePageSize(n) {
  const parsed = Number(n);
  if (!Number.isFinite(parsed) || parsed <= 0) return; // 잘못된 값 무시
  texturesPerPage = parsed;

  // 페이지 크기가 바뀌면 현재 페이지가 범위를 벗어날 수 있으므로 보정
  clampCurrentPage();
}

/** 현재 페이지당 아이템 수 조회 */
export function getTexturePageSize() {
  return texturesPerPage;
}

/* 내부 유틸: currentTexturePage를 0 ~ (max-1) 사이로 보정 */
function clampCurrentPage() {
  const maxPages = getTotalTexturePages();
  if (maxPages <= 0) {
    currentTexturePage = 0;
    return;
  }
  if (currentTexturePage > maxPages - 1) {
    currentTexturePage = maxPages - 1;
  }
  if (currentTexturePage < 0) {
    currentTexturePage = 0;
  }
}