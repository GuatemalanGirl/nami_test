// domain/paintingEditing.js

import { showPaintingEditButtons, hidePaintingEditButtons } from '../ui/paintingEditButtons.js'
import { showOutline, removeOutline } from '../ui/outline.js'
import { getIsResizingPainting, setIsResizingPainting } from '../ui/paintingResizeButtons.js'
import { closeIntroOverlayEditor } from '../ui/introOverlayEditor.js'

// --- 작품 편집 관련 상태 ---
let editingPainting = null      // 현재 편집중인 mesh 저장
let isEditingPainting = false   // 편집 모드 진입 여부
let dragging = false            // 드래그 중 여부

// --- 편집 시작 함수 ---
export function startEditingPainting(mesh, scene, camera, controls, quill) {
  editingPainting = mesh
  isEditingPainting = true
  showPaintingEditButtons(mesh, scene, camera, controls, quill)   // 그림 클릭 시 버튼 표시
  showOutline(mesh, scene)        // 테두리 효과 추가
}

// --- 편집 종료 함수 ---
export function endEditingPainting(scene) {
  if (editingPainting) {
    removeOutline(scene) // 테두리 효과 제거
  }

  if (getIsResizingPainting() && editingPainting) {
    // 크기조절 도중 확인을 안 누르고 종료할 때는
    // scale을 원래 값(저장된 값)으로 복원
    const orig = editingPainting.userData.originalScale
    const scaleValue = editingPainting.userData.scaleValue || 1
    editingPainting.scale.set(orig.x * scaleValue, orig.y * scaleValue, orig.z)
    // outline도 복구
    showOutline(editingPainting, scene)
    setIsResizingPainting(false)
  }

  editingPainting = null
  isEditingPainting = false
  dragging = false // 명시적 초기화
  hidePaintingEditButtons()    // 편집종료 시 버튼 숨김

  // === Quill 오버레이도 항상 닫기! ===
  closeIntroOverlayEditor()
}

// --- 현재 편집 중인 mesh 반환 (필요시 외부에서 활용) ---
export function getEditingPainting() {
  return editingPainting
}

// --- 현재 편집 모드 진입 여부 반환 (선택적 getter) ---
export function getIsEditingPainting() {
  return isEditingPainting
}

// --- 드래깅 여부 getter/setter (필요시 사용) ---
export function setDragging(val) {
  dragging = val
}
export function getDragging() {
  return dragging
}
