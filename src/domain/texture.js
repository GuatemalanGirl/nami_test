// domain/texture.js

let selectedTextureSet = null // 미리보기용
let confirmedTextureSet = null // 마지막 확정값

// === 선택/적용/복구 상태 관리 ===

/** 현재 선택된 texture set 반환 (미리보기용) */
export function getSelectedTextureSet() {
  return selectedTextureSet;
}

/** texture set 선택 (미리보기용) */
export function setSelectedTextureSet(set) {
  selectedTextureSet = set;
}

/** 마지막으로 확정 적용된 texture set 반환 */
export function getConfirmedTextureSet() {
  return confirmedTextureSet;
}

/** texture set 확정 적용 + localStorage 저장 */
export function setConfirmedTextureSet(set) {
  confirmedTextureSet = set;
  selectedTextureSet = set;
  localStorage.setItem("selectedTextureSet", set);
}

/** 
 * 롤백: 마지막 확정값으로 미리보기 복구 
 * - applyPreviewTextureSet을 호출해 씬에 적용
 * - selectedTextureSet도 확정값으로 동기화
 */
export function restoreTextureSet(scene, applyPreviewTextureSet) {
  if (!confirmedTextureSet || !scene) return;
  applyPreviewTextureSet(confirmedTextureSet);
  selectedTextureSet = confirmedTextureSet;
}
