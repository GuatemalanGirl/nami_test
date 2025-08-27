// ui/outline.js

import * as THREE from 'three'

let outlineLine = null // 선택된 작품 테우리 효과를 위한 변수

// scene 역추적 유틸: scene 인자가 없거나 끊어졌을 때 상위 트리에서 THREE.Scene 찾기
function resolveScene(from, scene) {
  if (scene && typeof scene.add === 'function') return scene
  let p = from
  while (p) {
    if (p.isScene) return p
    p = p.parent
  }
  return null
}

export function showOutline(mesh, scene) {
  removeOutline(scene ?? mesh) // 기존 outline 제거(중복방지)

  // 대상/지오메트리 체크
  if (!mesh || !mesh.geometry) {
    console.warn('showOutline: invalid target mesh or geometry')
    return
  }

  // mesh geometry보다 약간 크게
  const scale = 1.06
  const geo = mesh.geometry.clone()
  geo.scale(scale, scale, scale)

  const edges = new THREE.EdgesGeometry(geo)
  const outlineMat = new THREE.LineBasicMaterial({
    color: 0x3399ff, // 파란색
    linewidth: 2, // 크롬에서는 1만 지원됨(두께 바꾸고 싶으면 scale로!)
  })

  outlineLine = new THREE.LineSegments(edges, outlineMat)
  outlineLine.scale.copy(mesh.scale)
  outlineLine.position.copy(mesh.position)
  outlineLine.quaternion.copy(mesh.quaternion)
  outlineLine.renderOrder = 999 // 항상 위에 그리기
  outlineLine.name = 'SelectionOutline' // [추가] 디버깅용 네이밍

  // 임시 clone 지오메트리는 edges 생성 후 즉시 해제(메모리 관리)
  geo.dispose()

  // scene 인자가 없거나 부모가 끊긴 경우에도 안전하게 Scene을 찾아 추가
  const resolvedScene = resolveScene(mesh, scene)
  if (!resolvedScene) {
    console.warn('showOutline: cannot resolve THREE.Scene')
    // 생성한 outline 정리
    outlineLine.geometry?.dispose?.()
    if (Array.isArray(outlineLine.material)) {
      outlineLine.material.forEach(m => m?.dispose?.())
    } else {
      outlineLine.material?.dispose?.()
    }
    outlineLine = null
    return
  }

  //  캡션이면 아웃라인 생성 금지
  if (mesh?.userData?.type === 'caption' || mesh?.userData?.blocksEditing) return;

  resolvedScene.add(outlineLine)
  }

export function removeOutline(scene) {
  if (!outlineLine) return

  // [개선] 부모가 있으면 부모에서 제거, 없으면 scene 역추적으로 제거
  const parent = outlineLine.parent
  if (parent && typeof parent.remove === 'function') {
    parent.remove(outlineLine)
  } else {
    const resolvedScene = resolveScene(outlineLine, scene)
    resolvedScene?.remove?.(outlineLine)
  }

  // 생성 자원 해제
  outlineLine.geometry?.dispose?.()
  if (Array.isArray(outlineLine.material)) {
    outlineLine.material.forEach(m => m?.dispose?.())
  } else {
    outlineLine.material?.dispose?.()
  }
  outlineLine = null
}

export function getOutlineLine() {
  return outlineLine;
}
