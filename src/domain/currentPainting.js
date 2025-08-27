// domain/currentPainting.js
// -------------------------------------------------------------
// 현재 선택된 painting 인덱스 관리 (view 상태)
// -------------------------------------------------------------

let currentPaintingIndex = -1;

/**
 * 현재 painting 인덱스를 반환합니다.
 * @returns {number}
 */
export function getCurrentPaintingIndex() {
  return currentPaintingIndex;
}

/**
 * 현재 painting 인덱스를 설정합니다.
 * @param {number} idx
 */
export function setCurrentPaintingIndex(idx) {
  currentPaintingIndex = idx;
}
