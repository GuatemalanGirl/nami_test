// interaction/artwallDragHandlers.js

import * as THREE from 'three'
// -------------------------------------------------------------
// [ARTWALL] 아트월 드래그, 클릭, 편집, 이동 이벤트 핸들러 모듈
// - pointerdown: 아트월 선택/드래그 시작
// - pointermove: 아트월 드래그 이동
// - pointerup  : 아트월 편집/드래그 종료
// -------------------------------------------------------------

import { createEdgeWallNavigator } from './edgeWallNavigator.js'
import { goToLeftWall, goToRightWall } from '../ui/wallNavigation.js'
import { getCameraMovingState } from '../domain/zoomState.js'

export function registerArtwallDragHandlers(domElement, {
  // 모드/데이터
  getArtwallMode,
  getCurrentWall,
  getArtwalls,
  detectWall,

  // 편집 훅(아트월 전용)
  getEditingArtwall,
  startEditingArtwall,
  endEditingArtwall,

  // 룸 치수/3D
  ROOM_WIDTH,
  ROOM_HEIGHT,
  ROOM_DEPTH,
  camera,
  raycaster,
  scene,
  controls,             // 벽 전환/카메라 갱신에 필요
  editingButtonsDiv,

  // (옵션) 리사이즈 중이면 드래그/네비 비활성화
  getIsResizingArtwall = () => false
}) {
  // 로컬 상태 (paintingDragHandlers 패턴 동일)
  let pointerDownTime = 0          // pointerdown 시각
  let dragStartScreen = null       // pointerdown 위치
  let isDragging = false           // 드래그 중 여부
  let wasDragging = false          // 직전 드래그 여부
  const dragThreshold = 7          // px: 드래그 판정
  const clickTimeThreshold = 200   // ms: 클릭 판정

  // 엣지 네비 직후 pointerup 억제(클릭/드롭 오작동 방지)
  let suppressNextPointerUp = false

  // 실제 드래그 타깃(선택된 아트월)이 있는지
  let hasDragTargetArt = false

  // 현재 선택된 아트월(로컬 관리; 아트월 전용)
  let selectedArtwall = null

  // 게이트 함수 (painting 구조와 동일한 패턴)
  const isModeActive   = () => !!getArtwallMode?.()
  const isAnyResizing  = () => !!getIsResizingArtwall?.()

  // 회전 계산에 재사용할 임시 객체들(할당 최소화)
  const forward = new THREE.Vector3(0, 0, 1) // mesh의 “정면”이 +Z라고 가정
  const tmpQuat = new THREE.Quaternion()
  const tmpNorm = new THREE.Vector3()

  // 엣지-드래그 네비게이터 (painting과 동일 구조)
  const edgeNav = createEdgeWallNavigator({
    domElement,
    isActive:   () => isModeActive() && hasDragTargetArt, // ★ 타깃 있을 때만
    isDragging: () => isDragging,
    isResizing: () => isAnyResizing(),
    isMoving:   () => !!getCameraMovingState?.(),
    onBeforeNavigate: () => {
      try { endEditingArtwall?.(scene, editingButtonsDiv) } catch {}
      // 드래그 연속성 유지: 선택/드래그 상태는 유지하고 pointerup만 억제
      suppressNextPointerUp = true
    },
    goLeft:  () => goToLeftWall(camera, controls),
    goRight: () => goToRightWall(camera, controls),
    edgePct: 0.08,   // 좌/우 8%
    dwellMs: 100,    // 100ms 머물면 전환
    cooldownMs: 500  // 재트리거 대기
  })

  // -----------------------------
  // pointerdown: 선택/드래그 시작
  // -----------------------------
  domElement.addEventListener('pointerdown', (e) => {
    if (isAnyResizing()) return
    if (!isModeActive()) return

    pointerDownTime  = Date.now()
    dragStartScreen  = { x: e.clientX, y: e.clientY }
    isDragging       = false
    wasDragging      = false
    suppressNextPointerUp = false

    selectedArtwall = null
    hasDragTargetArt = false

    // 현재 벽에서 히트 검사 (자식까지)
    const currentWall = getCurrentWall()
    const rect = domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.setFromCamera(mouse, camera)
    const wallArts = (getArtwalls?.() || []).filter(m => detectWall(m) === currentWall)
    const hit = raycaster.intersectObjects(wallArts, true)[0] // ★ true: 자식까지
    if (hit) {
      selectedArtwall = hit.object
      hasDragTargetArt = true
    }

    // 다른 아트월 편집 중이면 종료
    const editing = getEditingArtwall?.()
    if (editing && editing !== selectedArtwall) {
      endEditingArtwall?.(scene, editingButtonsDiv)
    }

    // 엣지 네비 시작(타깃/플래그 확정 이후)
    edgeNav.onDragStart()

    // 사이드 패널 위에서도 이벤트 유지
    try { domElement.setPointerCapture?.(e.pointerId) } catch {}
  })

  // -----------------------------
  // pointermove: 드래그 이동
  // -----------------------------
  domElement.addEventListener('pointermove', (e) => {
    if (isAnyResizing()) return
    if (!isModeActive() || !(e.buttons & 1) || !dragStartScreen) return

    const dx = e.clientX - dragStartScreen.x
    const dy = e.clientY - dragStartScreen.y

    if (!isDragging && Math.hypot(dx, dy) > dragThreshold) {
      // 드래그 시작은 타깃이 있을 때만
      if (!hasDragTargetArt || !selectedArtwall) return
      isDragging = true
      // 드래그 시작 → 편집 패널/버튼 숨김
      try { endEditingArtwall?.(scene, editingButtonsDiv) } catch {}
    }

    if (!isDragging || !selectedArtwall) return

    // 현재 벽의 평면에서 포지션 업데이트
    const currentWall = getCurrentWall()
    const rect = domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.setFromCamera(mouse, camera)
    const wallMesh = scene.getObjectByName(currentWall)
    if (!wallMesh) return

    const hit = raycaster.intersectObject(wallMesh)[0]
    if (!hit) return

    const p = hit.point.clone()
    const n = hit.face.normal.clone().transformDirection(wallMesh.matrixWorld)
    p.add(n.multiplyScalar(0.05)) // 벽에서 살짝 띄우기

    // 경계 클램프
    const halfW = ROOM_WIDTH  / 2
    const halfH = ROOM_HEIGHT / 2
    const halfD = ROOM_DEPTH  / 2

    const box  = new THREE.Box3().setFromObject(selectedArtwall)
    const size = new THREE.Vector3()
    box.getSize(size)
    const hw = size.x / 2
    const hh = size.y / 2
    const hd = size.z / 2

    switch (currentWall) {
      case 'front':
      case 'back':
        p.x = THREE.MathUtils.clamp(p.x, -halfW + hw, halfW - hw)
        p.y = THREE.MathUtils.clamp(p.y, -halfH + hh, halfH - hh)
        break
      case 'left':
      case 'right':
        p.z = THREE.MathUtils.clamp(p.z, -halfD + hd, halfD - hd)
        p.y = THREE.MathUtils.clamp(p.y, -halfH + hh, halfH - hh)
        break
    }

    selectedArtwall.position.copy(p)

    // 회전(노멀 정렬): forward(+Z) -> 벽 노멀(n) 방향으로 회전
    tmpNorm.copy(n).normalize()
    tmpQuat.setFromUnitVectors(forward, tmpNorm)
    // 부드럽게 보간(원하면 0.2~0.5 사이로 조절)
    selectedArtwall.quaternion.slerp(tmpQuat, 0.35)
    // 즉시 정렬 원하면: selectedArtwall.quaternion.copy(tmpQuat)
  })

  // -----------------------------
  // pointerup: 클릭/드래그 종료
  // -----------------------------
  domElement.addEventListener('pointerup', (e) => {
    if (isAnyResizing()) return
    if (!isModeActive() || !dragStartScreen) return

    // 엣지 네비 직후 억제 분기
    if (suppressNextPointerUp) {
      suppressNextPointerUp = false
      dragStartScreen = null
      pointerDownTime = 0
      isDragging = false
      // 선택/드래그 연속성을 유지하고 싶으면 아래 두 줄을 주석 처리
      selectedArtwall = null
      hasDragTargetArt = false
      edgeNav.onDragEnd()
      try { domElement.releasePointerCapture?.(e.pointerId) } catch {}
      return
    }

    const dt = Date.now() - pointerDownTime
    const dist = Math.hypot(
      e.clientX - dragStartScreen.x,
      e.clientY - dragStartScreen.y
    )
    const clicked = dt < clickTimeThreshold && dist < dragThreshold

    if (isDragging) {
      wasDragging = true
      // (아트월은 별도 정렬 없음 — 필요시 여기서 호출)
    } else {
      wasDragging = false
      // 클릭 → 편집 진입
      if (clicked && selectedArtwall) {
        startEditingArtwall?.(selectedArtwall, scene, editingButtonsDiv)
      }
      // 빈 곳 클릭 → 편집 종료
      if (!selectedArtwall || (clicked && !selectedArtwall)) {
        endEditingArtwall?.(scene, editingButtonsDiv)
      }
    }

    // 리셋
    dragStartScreen = null
    pointerDownTime = 0
    isDragging = false
    selectedArtwall = null
    hasDragTargetArt = false
    edgeNav.onDragEnd()

    try { domElement.releasePointerCapture?.(e.pointerId) } catch {}
  })

  // -----------------------------
  // pointercancel: 안전 리셋
  // -----------------------------
  domElement.addEventListener('pointercancel', (e) => {
    if (!isModeActive() || !dragStartScreen) return
    suppressNextPointerUp = false
    dragStartScreen = null
    pointerDownTime = 0
    isDragging = false
    selectedArtwall = null
    hasDragTargetArt = false
    edgeNav.onDragEnd()
    try { domElement.releasePointerCapture?.(e.pointerId) } catch {}
  })
}