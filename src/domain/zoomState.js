// domain/zoomState.js

let isCameraMoving = false       // 카메라 이동 중 여부
let isZoomedIn = false           // 현재 줌인 상태 여부
let zoomedPainting = null        // 현재 줌인된 그림 (THREE.Mesh)
let zoomLevel = 0                // 줌 단계 (0: 초기, 1: 1차 줌, 2: 2차 줌)

// 카메라 이동 상태
export function setCameraMovingState(isMoving) {
  isCameraMoving = isMoving
}
export function getCameraMovingState() {
  return isCameraMoving
}

// 줌인 상태
export function setZoomedInState(isZoomed) {
  isZoomedIn = isZoomed
}
export function getZoomedInState() {
  return isZoomedIn
}

// 줌인된 그림 객체
export function setZoomedPainting(paintingMesh) {
  zoomedPainting = paintingMesh
}
export function getZoomedPainting() {
  return zoomedPainting
}

// 줌 단계 (1차/2차)
export function setZoomLevel(level) {
  zoomLevel = level
}
export function getZoomLevel() {
  return zoomLevel
}

// 상태 초기화 (선택)
export function resetZoomState() {
  isCameraMoving = false
  isZoomedIn = false
  zoomedPainting = null
  zoomLevel = 0
}
