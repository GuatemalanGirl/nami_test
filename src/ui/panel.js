// ui/panel.js

import { commitPaintingChanges, snapshotPaintingState } from '../domain/painting.js'
import { setPaintingMode } from '../domain/paintingMode.js'
import {
  commitIntroChanges,
  snapshotIntroState,
  clearTempIntroMeshes,
  getTempIntroMeshes
} from '../domain/intro.js'
import { setIntroMode } from '../domain/introMode.js'
import { clearEditingArtwalls, commitArtwallChanges } from '../domain/artwall.js'
import { setArtwallMode } from '../domain/artwallMode.js'
import { restoreTextureSet } from '../domain/texture.js'
import { populatePaintingGrid } from './paintingGrid.js'
import { populateIntroGrid } from './introGrid.js'
import { populateArtwallGrid } from './artwallGrid.js'
import { updateWallView } from '../core/view.js'
import { closeInfo } from './infoModal.js'
import { getSkipCancelBackground } from '../domain/backgroundState.js'
import { setCurrentWall } from '../domain/wall.js'

/**
 * 패널 전환 및 상태 관리 함수
 * @param {string} panelId - 전환할 패널 ID
 */
// InfoModal 열려 있으면 우선 닫기
export function showPanel(panelId, camera, controls, scene) {
  const modal = document.getElementById('infoModal')
  const isVisible = modal && getComputedStyle(modal).display !== 'none'
  if (isVisible) closeInfo()

  const currentActive = document.querySelector('.settings-slide.active')
  const currentId = currentActive?.id

  // 아트월 -> 다른 패널 전환 시 outline 제거
  if (currentId === 'panel-artwalls' && panelId !== 'panel-artwalls') {
    clearEditingArtwalls()
  }

  // 백그라운드 -> 메인 전환 시 롤백 처리
  if (currentId === 'panel-background' && panelId === 'panel-main') {
    if (!getSkipCancelBackground()) restoreTextureSet()
  }

  // 작품 패널 종료 -> 자동 저장
  if (currentId === 'panel-paintings' && panelId === 'panel-main') {
    commitPaintingChanges()
  }

  // 작품 / 서문 / 아트월 패널로 진입할 때
  if (['panel-paintings', 'panel-intro', 'panel-artwalls'].includes(panelId)) {
    populatePaintingGrid()
    setPaintingMode(true) // 작품선택모드 진입
    if (controls) controls.enabled = false // 사용자 회전 비활성화
    setCurrentWall('front') // front부터 시작
    updateWallView(camera, controls) // 카메라 이동

    snapshotPaintingState()
    
  } else {
    setPaintingMode(false) // 작품 선택 모드 해제
    if (controls) controls.enabled = true 
  }

  // 패널이 panel-intro 에서 panel-main 으로 돌아갈 때 롤백
  if (currentId === 'panel-intro' && panelId === 'panel-main') {
    commitIntroChanges() // 자동 저장
  }

  // 서문 진입 시 상태 초기화
  if (panelId === 'panel-intro') {
    setIntroMode(true)
    clearTempIntroMeshes()
    populateIntroGrid()  // (필요 시) 여기서 프레임/플레인 썸네일+드래그 준비
    const introMeshes = getTempIntroMeshes()
    console.log("introMeshes for snapshot:", introMeshes)
    snapshotIntroState(introMeshes)
  } else {
    setIntroMode(false)
  }

  // 아트월 -> 메인 전환 시 저장
  if (currentId === 'panel-artwalls' && panelId === 'panel-main') {
    commitArtwallChanges(scene)
  }

  // 아트월 진입 시
  if (panelId === 'panel-artwalls') {
    populateArtwallGrid()
    setArtwallMode(true)
    if (controls) controls.enabled = false
    setCurrentWall('front')
    updateWallView(camera, controls)
  } else {
    setArtwallMode(false)
    clearEditingArtwalls()
  }

  // DOM 변경: 패널 활성화
  document.querySelectorAll('.settings-slide').forEach((el) =>
    el.classList.remove('active'),
  )
  document.getElementById(panelId)?.classList.add('active')
}

/**
 * 패널 외부 클릭 시 자동 닫기 설정
 * - panel-main이 열려있을 때 외부를 클릭하면 닫음
 */
export function setupPanelAutoClose() {
  const panel = document.getElementById("settingsPanel")
  const toggle = document.getElementById("settingsToggle")
  if (!panel || !toggle) return

  document.addEventListener("click", (e) => {
    const isOpen = panel.classList.contains("open")
    if (!isOpen) return

    // 현재 활성화된 패널 확인
    const currentActive = document.querySelector('.settings-slide.active')
    const currentId = currentActive?.id

    // panel-main일 때만 닫기 허용
    if (currentId !== 'panel-main') return

    // 패널 내부 또는 톱니 버튼 클릭은 무시
    if (panel.contains(e.target) || toggle.contains(e.target)) return

    // 외부 클릭 → 닫기
    panel.classList.remove("open")
    toggle.classList.remove("moving")
  })
}