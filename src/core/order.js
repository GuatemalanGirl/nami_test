// core/order.js

/**
 * 작품 배열(paintings)을 화면의 적절한 렌더링 순서대로 정렬하는 유틸리티 모듈입니다.
 * 
 * 이 모듈의 주요 목적:
 * - Three.js에서 그림/서문/아트월 등 메쉬들이 겹칠 경우, renderOrder를 설정해 올바르게 보이도록 조정
 * - 작품을 드래그하거나 생성할 때 빈번히 호출될 수 있으므로,
 *   디바운스(debounce) 처리를 통해 과도한 연산을 방지
 */
import { ROOM_DEPTH, ROOM_WIDTH } from "./constants.js"
import { getPaintings } from "../domain/painting.js"

let sortDebounce = null

/**
 * 정렬 함수를 디바운스로 감싸 안전하게 호출합니다.
 * @param {number} delay - 호출 지연 시간(ms), 기본값 50ms
 */
export function safeUpdatePaintingOrder(delay = 50) {
  clearTimeout(sortDebounce)
  sortDebounce = setTimeout(updatePaintingOrderByPosition, delay)
}

/**
 * paintings 배열을 정렬하여 renderOrder를 설정함.
 * 1. 벽 순서: front → left → back → right
 * 2. 같은 벽 내에서는 좌우 순서 정렬
 */
export function updatePaintingOrderByPosition() {
  const wallOrder = ["front", "left", "back", "right"] // 반대로 돌아서 left, right 순서 변경
  const wallSortingFns = {
    front: (a, b) => a.position.x - b.position.x,
    back:  (a, b) => b.position.x - a.position.x,
    left:  (a, b) => b.position.z - a.position.z,
    right: (a, b) => a.position.z - b.position.z,
  }

  const paintings = getPaintings()
  if (!paintings || !Array.isArray(paintings)) return

  paintings.sort((a, b) => {
    const aWall = detectWall(a)
    const bWall = detectWall(b)
    const aIdx = wallOrder.indexOf(aWall)
    const bIdx = wallOrder.indexOf(bWall)

    if (aIdx !== bIdx) return aIdx - bIdx
    return wallSortingFns[aWall]?.(a, b) || 0 // 같은 벽에 있으면 좌우 순서대로 정렬
  })

  // 정렬된 순서대로 renderOrder 재부여
  paintings.forEach((mesh, i) => {
    mesh.renderOrder = i
  })
}

/**
 * 주어진 mesh의 위치를 기반으로 어떤 벽에 붙어 있는지 감지
 */
export function detectWall(mesh) {
  const z = mesh.position.z
  const x = mesh.position.x
  const eps = 0.2 // 오차 허용

  if (Math.abs(z - ROOM_DEPTH / 2) < eps) return "front"
  if (Math.abs(z + ROOM_DEPTH / 2) < eps) return "back"
  if (Math.abs(x - ROOM_WIDTH / 2) < eps) return "left"
  if (Math.abs(x + ROOM_WIDTH / 2) < eps) return "right"
  return "unknown"
}