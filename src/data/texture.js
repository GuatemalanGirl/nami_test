// data/texture.js

let textureSetsData = [] // [{ set, thumb, floor, ceiling, walls }]
let currentTexturePage = 0
const texturesPerPage = 9 // 페이지당 9개 (3×3)

// metadata_textures.json에서 texture set 정보를 불러옴
export async function fetchTextureSets() {
  const url = "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/metadata_textures.json";
  const res = await fetch(url);
  if (!res.ok) throw new Error("텍스처 정보를 불러오는데 실패");
  textureSetsData = await res.json();
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
