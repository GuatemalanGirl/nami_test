// core/pointer.js

import * as THREE from 'three';

/**
 * 2D pointer 벡터 생성
 * @returns {THREE.Vector2}
 */
export function createPointer() {
  return new THREE.Vector2();
}

/**
 * 이벤트 기반으로 pointer 좌표를 업데이트 (NDC [-1,1])
 *
 * @param {MouseEvent|PointerEvent|TouchEvent|Touch} event
 * @param {THREE.Vector2} pointer - 업데이트할 pointer 객체
 * @param {THREE.WebGLRenderer|HTMLElement} rendererOrElement - 렌더러(권장) 또는 기준 엘리먼트
 */
export function updatePointer(event, pointer, rendererOrElement) {
  // 기준 엘리먼트 결정: renderer.domElement → 전달된 엘리먼트 → event.target
  const el =
    (rendererOrElement && ('domElement' in rendererOrElement) ? rendererOrElement.domElement : rendererOrElement) ||
    (event && event.target instanceof Element ? event.target : document.documentElement);

  const rect = el.getBoundingClientRect();

  // clientX/Y 추출 (Mouse/Pointer/TouchEvent/Touch 모두 대응)
  let clientX = 0, clientY = 0;
  if (event && 'clientX' in event && 'clientY' in event) {
    ({ clientX, clientY } = event); // MouseEvent, PointerEvent, Touch(단일) 지원
  } else if (event && 'changedTouches' in event && event.changedTouches.length) {
    clientX = event.changedTouches[0].clientX;
    clientY = event.changedTouches[0].clientY;
  } else if (event && 'touches' in event && event.touches.length) {
    clientX = event.touches[0].clientX;
    clientY = event.touches[0].clientY;
  }

  // NDC로 정규화
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}