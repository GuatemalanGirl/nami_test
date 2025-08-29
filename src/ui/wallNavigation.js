// ui/wallNavigation.js

import { getCurrentWall, rotateWall } from "../domain/wall.js"
import { updateWallView } from "../core/view.js"

/**
 * 모든 `.current-wall-label` 요소의 텍스트를 현재 벽 이름으로 갱신
 */
export function updateAllWallLabels() {
  const current = getCurrentWall()

  // 표시용 이름 매핑 테이블 (UI에서 보이는 이름을 여기서 조정)
  const wallNameMap = {
    front: "벽면 1",
    left: "벽면 4",
    right: "벽면 2",
    back: "벽면 3",
  }

  const labelText = wallNameMap[current] || current

  document
    .querySelectorAll(".current-wall-label")
    .forEach((label) => (label.textContent = labelText))
}

/**
 * 좌/우 버튼 클릭 시 벽을 회전시키고 카메라 시점을 갱신
 * @param {THREE.Camera} camera 
 * @param {OrbitControls} controls 
 */
export function addWallNavListeners(camera, controls) {
  document.querySelectorAll(".wall-left-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      rotateWall("left")
      updateWallView(camera, controls)
    })
  )

  document.querySelectorAll(".wall-right-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      rotateWall("right")
      updateWallView(camera, controls)
    })
  )
}

/**
 * 코드에서 직접 호출하는 벽면 전환 래퍼
 *  - 엣지-드래그 유틸이 이 함수를 호출하게 됨
 */
export function goToLeftWall(camera, controls) {
  rotateWall("left")
  updateWallView(camera, controls)
  updateAllWallLabels()
}

export function goToRightWall(camera, controls) {
  rotateWall("right")
  updateWallView(camera, controls)
  updateAllWallLabels()
}