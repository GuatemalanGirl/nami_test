// data/exhibition.js
/**
 * 전시 정보의 로우(raw) 저장/불러오기 전용 모듈
 */

const STORAGE_KEY = "exhibitInfo";

/** localStorage에서 원본 JSON 읽기 */
export function loadRawExhibitionInfo() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : null;
}

/** 로우 JSON을 localStorage에 저장 */
export function saveRawExhibitionInfo(info) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
}

/** 로우 JSON 삭제 */
export function clearRawExhibitionInfo() {
  localStorage.removeItem(STORAGE_KEY);
}
