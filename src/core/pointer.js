// core/pointer.js

import * as THREE from 'three';

/**
 * 2D pointer 벡터 생성
 * @returns {THREE.Vector2}
 */
export function createPointer() {
  return new THREE.Vector2()
}
/**
 * 마우스 이벤트 기준으로 pointer 좌표를 업데이트
 * - NDC 기준: [-1, 1] 범위로 정규화
 *
 * @param {PointerEvent} event
 * @param {THREE.Vector2} pointer - 업데이트할 pointer 객체
 * @param {THREE.WebGLRenderer} renderer - 렌더러 (canvas 참조용)
 */
export function updatePointer(event, pointer, renderer) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}