// ui/introOverlayEditor.js

import * as THREE from "three"
import { Tween, Easing } from "@tweenjs/tween.js" // 최신 방식
import { tweenGroup } from "../core/tweenGroup.js" // 새로 만든 그룹 import
import { setCameraMovingState } from '../domain/zoomState.js'
import { updateIntroTextPlaneFromHTML } from './updateIntroTextPlane.js'
import { setupQuillEditor } from './textEditor.js'
import { showPaintingEditButtons, hidePaintingEditButtons } from './paintingEditButtons.js'
import { zoomBackOut, saveCameraPrevState } from "../interaction/zoomControls.js"

// --- 오버레이 편집 관련 내부 상태 ---
let editingIntroMesh = null // 현재 편집중인 mesh 저장
let editingIntroHTML = null // 편집 중인 전시서문 HTML 저장용

const introTextEditorOverlay = document.getElementById("introTextEditorOverlay")

// Quill 오버레이 내부 클릭 시 이벤트 전파 막기 (이벤트 캡처링 방지)
if (introTextEditorOverlay) {
  introTextEditorOverlay.addEventListener("mousedown", (e) => e.stopPropagation())
}

// --- 텍스트 입력 오버레이 열기 -> mesh 표면의 중앙 지점을 2D 화면 좌표로 투영하는 방식 ---
export function showOverlayEditor(mesh, camera, controls, quill) {
  hidePaintingEditButtons()
  setEditorOverlayToPlane(mesh, camera)

  // 새 편집 대상으로 업데이트
  editingIntroMesh = mesh
  setupQuillEditor('#quillEditor')
  
  /** 1. 먼저 모든 text-change 리스너 제거 */
  quill.off("text-change")

  /** 2. 콘텐츠 로드/초기화 (silent 옵션으로 이벤트 방지) */
  if (mesh.userData.html && mesh.userData.html.trim() !== "") {
    // 기존 글이 있으면 붙여 넣기
    quill.clipboard.dangerouslyPasteHTML(mesh.userData.html, "silent")
    editingIntroHTML = mesh.userData.html
  } else {
    // 빈 글로 초기화
    quill.setText("", "silent")
    editingIntroHTML = ""
  }

  /** 3. 새 리스너 등록 */
  quill.on("text-change", function () {
    editingIntroHTML = quill.root.innerHTML // 임시 변수에만 저장
    updateIntroTextPlaneFromHTML(mesh, editingIntroHTML) // 미리보기
  })

  // 편집 모드 진입시 즉시 미리보기
  updateIntroTextPlaneFromHTML(mesh, quill.root.innerHTML)

  // 3D→2D 변환으로 화면에 띄울 위치 계산
  let worldPos
  if (mesh.geometry.parameters &&
      mesh.geometry.parameters.depth !== undefined
  ) {
    worldPos = mesh.localToWorld(
      new THREE.Vector3(0, 0, mesh.geometry.parameters.depth / 2 + 0.02),
    )
  } else {
    worldPos = mesh.localToWorld(new THREE.Vector3(0, 0, 0.03))
  }
  worldPos.project(camera)
  const sx = (worldPos.x * window.innerWidth) / 2 + window.innerWidth / 2
  const sy = (-worldPos.y * window.innerHeight) / 2 + window.innerHeight / 2

  // 오버레이 띄우기
  introTextEditorOverlay.style.display = "block"
  introTextEditorOverlay.style.left = sx - 180 + "px" // 에디터 너비의 절반
  introTextEditorOverlay.style.top = sy - 70 + "px" // 에디터 높이의 절반
}


// --- 오버레이 위치와 크기를 mesh에 맞게 조정 ---
export function setEditorOverlayToPlane(mesh, camera) {
  const geom = mesh.geometry.parameters
  // 1. 3D 플레인 4모서리 계산
  const corners = [
    new THREE.Vector3(-geom.width / 2, geom.height / 2, 0),
    new THREE.Vector3(geom.width / 2, geom.height / 2, 0),
    new THREE.Vector3(-geom.width / 2, -geom.height / 2, 0),
    new THREE.Vector3(geom.width / 2, -geom.height / 2, 0),
  ]
  corners.forEach((v) => mesh.localToWorld(v))
  // 2. 화면 2D로 변환
  const toScreen = (v) => {
    v.project(camera)
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight,
    }
  }
  const s = corners.map(toScreen)
  // 3. 오버레이 크기/위치 산출
  const left = Math.min(...s.map((p) => p.x))
  const right = Math.max(...s.map((p) => p.x))
  const top = Math.min(...s.map((p) => p.y))
  const bottom = Math.max(...s.map((p) => p.y))
  const width = right - left
  const height = bottom - top
  // 4. 오버레이 스타일 적용 (16:9 직사각형)
  const overlay = introTextEditorOverlay
  const RATIO = 16 / 9 // 가로:세로
  const MIN_W = 420 // 최소 폭(px)
  const MIN_H = 280 // 최소 높이(px)
  const TOOLBAR = 120 // 툴바·버튼 영역 높이

  // (1) 먼저 플레인 폭을 그대로 쓰고 높이를 16:9로 계산
  let oW = width
  let oH = Math.round(width / RATIO)

  // (2) 만약 계산된 높이가 플레인보다 커지면, 높이를 기준삼아 다시 계산
  if (oH > height) {
    oH = height
    oW = Math.round(height * RATIO)
  }
  if (oW < MIN_W) {
    oW = MIN_W
    oH = Math.round(MIN_W / RATIO)
  }
  if (oH < MIN_H) {
    oH = MIN_H
    oW = Math.round(MIN_H * RATIO)
  }

  // (3) 스타일 적용
  overlay.style.width = oW + "px"
  overlay.style.height = oH + "px"
  overlay.style.left = left + width / 2 - oW / 2 + "px"
  overlay.style.top = top + height / 2 - oH / 2 + "px"

  // Quill 본문 높이 = 전체높이 - 툴바·버튼
  document.getElementById("quillEditor").style.cssText =
    `width:100%;height:${oH - TOOLBAR}px;`
}

// --- 서문 오브젝트(프레임/플레인)에 포커스하면서 에디터 띄우기 ---
export function focusIntroWithEditor(mesh, camera, controls, quill) {
  // **현재 카메라 상태 저장** (줌인 전)
  saveCameraPrevState(camera, controls)

  // 서문 중심/하단 계산
  const box = new THREE.Box3().setFromObject(mesh)
  const center = box.getCenter(new THREE.Vector3())

  const overlayHeight = 220 // 오버레이 실제 높이
  const usableHeight = window.innerHeight - overlayHeight
  const vFOV = THREE.MathUtils.degToRad(camera.fov)
  const objHeight = box.max.y - box.min.y
  let distance =
    (objHeight / 2 / Math.tan(vFOV / 2)) * (window.innerHeight / usableHeight)
  distance *= 2.5

  let normal = new THREE.Vector3(0, 0, 1)
  mesh.getWorldDirection(normal)
  const camPos = center.clone().addScaledVector(normal, distance)

  // 카메라는 항상 center를 바라봄
  const camTween = {
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z,
  }
  const lookTween = {
    x: controls.target.x,
    y: controls.target.y,
    z: controls.target.z,
  }

  setCameraMovingState(true)
  controls.enabled = false

  // 최신 Tween Group 패턴 적용
  new Tween(camTween, tweenGroup)
    .to({ x: camPos.x, y: camPos.y, z: camPos.z }, 900)
    .easing(Easing.Cubic.InOut)
    .onUpdate(() => {
      camera.position.set(camTween.x, camTween.y, camTween.z)
    })
    .start()

  new Tween(lookTween, tweenGroup)
    .to({ x: center.x, y: center.y, z: center.z }, 900)
    .easing(Easing.Cubic.InOut)
    .onUpdate(() => {
      controls.target.set(lookTween.x, lookTween.y, lookTween.z)
      controls.update()
    })
    .onComplete(() => {
      setCameraMovingState(false)
      controls.enabled = true

      showOverlayEditorFixed(mesh, camera, controls, quill)
    })
    .start()

}

// --- 오버레이 텍스트에디터를 중앙 하단 고정 위치에 띄움 ---
export function showOverlayEditorFixed(mesh, camera, controls, quill) {
  // 오버레이 텍스트에디터 열기 -> 중앙 하단 고정
  hidePaintingEditButtons()
  setEditorOverlayToPlane(mesh, camera)

  // 새 편집 대상으로 업데이트
  editingIntroMesh = mesh
  setupQuillEditor('#quillEditor')

  quill.off("text-change")
  if (mesh.userData.html && mesh.userData.html.trim() !== "") {
    quill.clipboard.dangerouslyPasteHTML(mesh.userData.html, "silent")
    editingIntroHTML = mesh.userData.html
  } else {
    quill.setText("", "silent")
    editingIntroHTML = ""
  }
  quill.on("text-change", function () {
    editingIntroHTML = quill.root.innerHTML
    updateIntroTextPlaneFromHTML(mesh, editingIntroHTML)
  })
  updateIntroTextPlaneFromHTML(mesh, quill.root.innerHTML)

  const overlay = introTextEditorOverlay
  overlay.style.display = "block"
  overlay.style.position = "fixed"
  overlay.style.left = "50%"
  overlay.style.transform = "translateX(-50%)"
  overlay.style.zIndex = 1100

  const margin = 32 // 화면 하단에서 32px 띄움 (원하는 값으로 조정)
  // 반드시 display: block 후에 높이 측정!
  const { height: overlayHeight } = overlay.getBoundingClientRect()

  // 브라우저 화면 하단에서 margin만큼 위로 (너무 위로 가지 않게 min값 적용)
  let top = window.innerHeight - overlayHeight - margin
  if (top < margin) top = margin
  overlay.style.top = `${top}px`

  setupOverlayEditorButtonEvents(camera, controls, quill)
}

// --- 오버레이 버튼 이벤트(확인/취소) ---
export function setupOverlayEditorButtonEvents(camera, controls, quill) {
  document.getElementById("introTextApplyBtn").onclick = function () {
    if (editingIntroMesh) {
      // Quill에서 HTML을 가져와 userData에 저장
      editingIntroMesh.userData.html = quill.root.innerHTML
      updateIntroTextPlaneFromHTML(editingIntroMesh, quill.root.innerHTML)
    }
    introTextEditorOverlay.style.display = "none"
    zoomBackOut(camera, controls, { keepControlsDisabled: true })
    showPaintingEditButtons(editingIntroMesh)
    editingIntroMesh = null
  }

  document.getElementById("introTextCancelBtn").onclick = function () {
    if (editingIntroMesh) {
      updateIntroTextPlaneFromHTML(
        editingIntroMesh,
        editingIntroMesh.userData.html || "",
      )
    }
    introTextEditorOverlay.style.display = "none"
    zoomBackOut(camera, controls, { keepControlsDisabled: true })
    showPaintingEditButtons(editingIntroMesh)
    editingIntroMesh = null
  }
}

// 오버레이 닫기 전용 함수
export function closeIntroOverlayEditor() {
  const overlay = document.getElementById("introTextEditorOverlay")
  if (overlay) overlay.style.display = "none"
  // 내부 상태도 정리
  if (typeof editingIntroMesh !== "undefined") {
    editingIntroMesh = null
  }
  // (필요시 추가 상태 초기화도 여기에)
}

// === (필요시) 외부에서 현재 편집 mesh 얻기 위한 getter ===
export function getEditingIntroMesh() {
  return editingIntroMesh
}
