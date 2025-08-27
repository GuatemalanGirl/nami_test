// ui/globalInputBlocker.js

/**
 * globalInputBlocker
 * 
 * - 특정 UI 상태(리사이즈, 스토리 편집, 컬러 피커 등)에서
 *   불필요하거나 원치 않는 입력(클릭/포인터 이벤트)을 차단
 */

import { getIsResizingPainting } from './paintingResizeButtons.js';
import { getIsStoryEditing } from './paintingStoryEditor.js';
import { getIsColorPicking } from './frameColorPicker.js';
import { getPaintingMode } from '../domain/paintingMode.js';

/**
 * 클릭/포인터 이벤트 차단 로직.
 * 
 * @param {Event} e - DOM 이벤트 객체
 */

// 공통 차단 유틸: cancelable일 때만 preventDefault 호출
function stopEvent(e) {
  e.stopPropagation();
  if (e.cancelable) e.preventDefault();
}

export function globalInputBlocker(e) {
  // 1. 그림 리사이즈 모드일 때: 리사이즈 UI만 허용, 나머지 클릭 전부 차단
  if (getIsResizingPainting()) {
    // 리사이즈 관련 버튼/핸들만 허용
    if (
      e.target.closest('[data-scale]') ||     // 프리셋 크기 버튼
      e.target.closest('#resizeOkBtn') ||     // 확인 버튼
      e.target.closest('#resizeCancelBtn') || // 취소 버튼
      e.target.closest('.resize-handle')      // 크기조절 핸들
    ) {
      return; // 허용
    }

    // 핸들 드래그 위해 pointer 이벤트는 통과
    if (e.type.startsWith('pointer')) {
      return;
    }

    stopEvent(e);
    return;
  }

  // 2. 스토리(설명) 에디터 오픈 상태: 오버레이 내부만 클릭 허용
  else if (getIsStoryEditing()) {
    const overlay = document.getElementById("paintingStoryEditorOverlay");
    if (!overlay || !overlay.contains(e.target)) {
      stopEvent(e);
    }
    return;
  }

  // 3. 프레임 컬러피커 오픈 상태: 팔레트 내부만 클릭 허용
  else if (getIsColorPicking()) {
    const palette = document.getElementById("frameColorPalette");
    if (!palette || !palette.contains(e.target)) {
      stopEvent(e);
    }
    return;
  }

  // 4. 작품선택모드에서 infoModal이 열려 있을 때: infoModal 내부만 클릭 허용
  else if (
    getPaintingMode() &&
    document.getElementById("infoModal")?.style.display === "block"
  ) {
    const modal = document.getElementById("infoModal");
    if (!modal.contains(e.target)) {
      stopEvent(e);
    }
    return;
  }

  // 5. 전시서문 텍스트 에디터 오버레이: 오버레이 내부만 클릭 허용
  const introOverlay = document.getElementById("introTextEditorOverlay");
  if (introOverlay && introOverlay.style.display !== "none") {
    if (!introOverlay.contains(e.target)) {
      stopEvent(e);
    }
  }
}

/**
 * 주요 입력 이벤트에 대해 globalInputBlocker를 캡처 단계에서 등록
 * (실제 프로젝트에선 DOMContentLoaded 이후 한 번만 호출하면 됨)
 */
export function registerGlobalInputBlocker() {
  // 캡처링 단계에서 클릭/포인터 등 전역 차단
  ["mousedown", "mouseup", "click", "pointerdown", "pointerup"].forEach(
    (type) => {
      document.addEventListener(type, globalInputBlocker, true);
    }
  );
  // 스크롤 관련(터치/휠) 이벤트에서 preventDefault 사용 가능하게 passive: false로 등록
  ["touchstart", "touchmove", "wheel"].forEach((type) => {
    document.addEventListener(type, globalInputBlocker, { capture: true, passive: false });
  });
}
