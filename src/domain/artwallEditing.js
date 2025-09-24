// domain/artwallEditing.js
// -------------------------------------------------------------
// [ARTWALL] 편집 상태 관리 및 편집 진입/종료 로직 전용 도메인 모듈
// -------------------------------------------------------------

import { showOutline, removeOutline } from '../ui/outline.js';
import { showArtwallButtons } from '../ui/artwallEditButtons.js';
import { markArtwallAsEditing, clearEditingArtwalls, getArtwalls } from './artwall.js';
import { hidePaintingEditButtons } from '../ui/paintingEditButtons.js';

/**
 * 현재 편집(선택) 중인 아트월 Mesh
 */
let editingArtwall = null;

/**
 * --- 편집 시작 함수 ---
 * @param {THREE.Mesh} mesh - 편집 진입할 아트월 mesh
 * @param {THREE.Scene} scene - three.js scene 객체
 * @param {HTMLElement} editingButtonsDiv - 버튼 표시할 div 요소
 */
export function startEditingArtwall(mesh, scene, editingButtonsDiv) {
  editingArtwall = mesh;
  markArtwallAsEditing(mesh);
  showOutline(mesh, scene); // 테두리 효과 함수 (공통)
  showArtwallButtons(mesh, scene, editingButtonsDiv, getArtwalls, endEditingArtwall); // 삭제버튼 등 UI 표시
}

/**
 * --- 편집 종료 함수 ---
 * @param {THREE.Scene} scene - three.js scene 객체
 * @param {HTMLElement} editingButtonsDiv - 버튼 숨길 div 요소
 */
export function endEditingArtwall(scene) {
  if (!editingArtwall) return;

  clearEditingArtwalls();
  removeOutline(scene); // 테두리 제거 (공통)
  hidePaintingEditButtons();
  editingArtwall = null;
}

/**
 * 현재 편집 중인 아트월 반환
 * @returns {THREE.Mesh|null}
 */
export function getEditingArtwall() {
  return editingArtwall;
}
