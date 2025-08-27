// domain/wall.js

// 내부 상태
let currentWall = "front"
const wallNames = ["front", "right", "back", "left"]

/**
 * 현재 선택된 벽 이름을 반환
 * @returns {"front"|"back"|"left"|"right"}
 */
export function getCurrentWall() {
  return currentWall
}

/**
 * 현재 벽을 설정 (외부에서 직접 설정할 경우)
 * @param {"front"|"back"|"left"|"right"} wall
 */
export function setCurrentWall(wall) {
  if (wallNames.includes(wall)) {
    currentWall = wall
  } else {
    console.warn(`Invalid wall name: ${wall}`)
  }
}

/**
 * 벽을 좌우로 회전합니다.
 * @param {"left"|"right"} direction
 */
export function rotateWall(direction) {
  const idx = wallNames.indexOf(currentWall)
  if (direction === "left") {
    currentWall = wallNames[(idx - 1 + wallNames.length) % wallNames.length]
  } else if (direction === "right") {
    currentWall = wallNames[(idx + 1) % wallNames.length]
  } else {
    console.warn(`Invalid direction: ${direction}`)
  }
}
