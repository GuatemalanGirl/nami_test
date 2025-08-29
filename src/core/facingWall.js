// core/facingWall.js

import * as THREE from 'three'

const WALL_NAMES = ['front', 'right', 'back', 'left']
const NAMESET = new Set(WALL_NAMES)

function ascendToNamedAncestor(obj) {
  let cur = obj
  while (cur) {
    if (NAMESET.has(cur.name)) return cur.name
    cur = cur.parent
  }
  return null
}

/**
 * 카메라가 바라보는 방향으로 레이캐스트해서 먼저 맞는 벽 이름을 반환.
 * 실패 시 카메라 방향 벡터로 근사(front/back/right/left).
 */
export function getFacingWallName(camera, scene) {
  const raycaster = new THREE.Raycaster()
  const dir = new THREE.Vector3()
  camera.getWorldDirection(dir).normalize()

  raycaster.set(camera.position.clone(), dir)

  const walls = WALL_NAMES
    .map(n => scene.getObjectByName(n))
    .filter(Boolean)

  // 자식까지 탐색
  const hits = raycaster.intersectObjects(walls, true)
  if (hits.length > 0) {
    const named = ascendToNamedAncestor(hits[0].object)
    if (named) return named
  }

  // 레이 미스: 방향 벡터 근사
  // (좌표계는 기존 클램프 로직과 동일 가정: -Z가 front, +Z가 back, +X가 right, -X가 left)
  if (Math.abs(dir.z) >= Math.abs(dir.x)) {
    return dir.z < 0 ? 'front' : 'back'
  } else {
    return dir.x > 0 ? 'right' : 'left'
  }
}