// interaction/paintingNavigation.js

import { ZOOM_DISTANCE } from '../core/constants.js'
import { zoomTo } from './zoomControls.js'
import { setZoomedPainting, setZoomLevel, getCameraMovingState } from '../domain/zoomState.js'
import { getCurrentPaintingIndex, setCurrentPaintingIndex } from '../domain/currentPainting.js'

/**
 * 작품 좌측(이전)으로 네비게이션
 * @param {Array<THREE.Mesh>} paintings - 현재 벽면에 배치된 그림 배열
 * @param {THREE.Camera} camera - 카메라 객체
 * @param {OrbitControls} controls - 카메라 컨트롤
 */
export function navigateLeft(paintings, camera, controls) {
  if (paintings.length === 0) return
  if (getCameraMovingState()) return

  // 인덱스 관리: getter/setter로 일관성 있게 사용
  let idx = getCurrentPaintingIndex();
  // 왼쪽(이전)으로: +1
  idx = (idx + 1) % paintings.length;
  setCurrentPaintingIndex(idx);

  const mesh = paintings[idx];
  zoomTo(mesh, ZOOM_DISTANCE, camera, controls); // 첫 번째 줌 거리로 초기화
  setZoomedPainting(mesh); // 줌인된 그림 업데이트
  setZoomLevel(1); // 줌 레벨 초기화
}

/**
 * 작품 우측(다음)으로 네비게이션
 * @param {Array<THREE.Mesh>} paintings - 현재 벽면에 배치된 그림 배열
 * @param {THREE.Camera} camera - 카메라 객체
 * @param {OrbitControls} controls - 카메라 컨트롤
 */
export function navigateRight(paintings, camera, controls) {
  if (paintings.length === 0) return
  if (getCameraMovingState()) return

  // 인덱스 관리: getter/setter로 일관성 있게 사용
  let idx = getCurrentPaintingIndex();
  // 오른쪽(다음)으로: -1
  idx = (idx - 1 + paintings.length) % paintings.length;
  setCurrentPaintingIndex(idx);

  const mesh = paintings[idx];
  zoomTo(mesh, ZOOM_DISTANCE, camera, controls); // 첫 번째 줌 거리로 초기화
  setZoomedPainting(mesh); // 줌인된 그림 업데이트
  setZoomLevel(1); // 줌 레벨 초기화
}
