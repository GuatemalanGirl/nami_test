// interaction/zoomControls.js

import * as THREE from 'three'
import { Tween, Easing } from '@tweenjs/tween.js' // Easing까지 import
import { tweenGroup } from '../core/tweenGroup.js' // 그룹 import
import { ZOOM_DISTANCE, ZOOM_DISTANCE_CLOSER, CAMERA_DURATION, PAINTING_Y_OFFSET, INITIAL_CAMERA_POS } from '../core/constants.js'
import { getZoomedPainting, setZoomedPainting, setZoomLevel, getZoomLevel } from '../domain/zoomState.js'
import { getPaintingMode } from '../domain/paintingMode.js'
import { setCameraMovingState, getCameraMovingState } from '../domain/zoomState.js'
import { endEditingPainting } from '../domain/paintingEditing.js'
import { setCurrentPaintingIndex } from '../domain/currentPainting.js'
import { showInfo } from '../ui/infoModal.js'
import { setSelectedPainting, getPaintings } from '../domain/painting.js' // paintings 배열 getter

// === 외부 메타데이터 접근: 정적 import로 Vite 빌드 에러 방지
import { getPaintingsData, fetchPaintingsData } from '../data/painting.js'

let prevCameraPos = null
let prevControlsTarget = null
let __lastCaptionClickAt = 0; // 최근 캡션 클릭 시각(ms)
// === 현재 Info 모달이 어떤 대상(key)에 대해 열려있는지 추적
let __infoOpenForKey = null

// === 메타데이터에서 대상 작품 찾기 유틸
function matchPaintingRecord(key, rec) {
  // metadata.json의 스키마가 확정되지 않았어도, 흔한 키들을 폭넓게 매칭
  return (
    rec?.id === key ||
    rec?.filename === key ||
    rec?.name === key ||
    rec?.title === key ||
    rec?.slug === key
  )
}

// === mesh에서 식별자 뽑기(우선순위: id -> filename -> name -> title -> uuid)
function extractKeyFromMesh(mesh) {
  const ud = mesh?.userData || {}
  return ud.id || ud.filename || mesh?.name || ud.title || mesh?.uuid || null
}

// === 모달 상태 헬퍼
function isInfoModalOpen() {
  return document.getElementById('infoModal')?.style.display === 'block'
}
function closeInfoModal() {
  const el = document.getElementById('infoModal')
  if (el) el.style.display = 'none'
  __infoOpenForKey = null
}

// === 메타데이터 확보 + 레코드 조회
async function ensurePaintingDataFromCatalog(mesh) {
  if (!mesh) return null

  // 이미 userData.data가 있으면 그대로 사용
  if (mesh.userData?.data) return mesh.userData.data

  // 메타데이터가 비어있다면 한 번 로드
  let catalog = getPaintingsData()
  if (!Array.isArray(catalog) || catalog.length === 0) {
    try {
      catalog = await fetchPaintingsData()
    } catch (e) {
      console.warn('[ensurePaintingDataFromCatalog] fetch failed:', e)
      return null
    }
  }

  // 키 추출 후 매칭
  const key = extractKeyFromMesh(mesh)
  if (!key) return null

  const found = catalog.find(rec => matchPaintingRecord(key, rec))
  if (found) {
    // 캐시에 태워두면 이후 접근이 빠름
    mesh.userData.data = found
    return found
  }
  return null
}

// === 사전 프리패치(에러 무시, 캐시만 노림)
function prefetchPaintingData(mesh) {
  // await 없이 백그라운드 캐싱
  ensurePaintingDataFromCatalog(mesh)
}

export function zoomTo(painting, distance, camera, controls) {
  // distance 파라미터 추가
  if (!painting) return

  const target = painting.position.clone()
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(painting.quaternion)
  const newCamPos = target.clone().addScaledVector(forward, distance) // distance 적용
  newCamPos.y = PAINTING_Y_OFFSET

  let camTween = { ...camera.position }
  let lookTween = { ...controls.target }

  setCameraMovingState(true)
  controls.enabled = false

  // 최신 Tween Group 방식 적용!
  new Tween(camTween, tweenGroup)
    .to(newCamPos, CAMERA_DURATION)
    .easing(Easing.Cubic.InOut)
    .onUpdate(() => {
      camera.position.set(camTween.x, camTween.y, camTween.z)
    })
    .start()

  new Tween(lookTween, tweenGroup)
    .to(target, CAMERA_DURATION)
    .easing(Easing.Cubic.InOut)
    .onUpdate(() => {
      controls.target.set(lookTween.x, lookTween.y, lookTween.z)
      controls.update()
    })
    .onComplete(() => {
      setCameraMovingState(false)
      controls.enabled = true

      // 모달 열려있으면 다시 표시
      if (document.getElementById('infoModal')?.style.display === 'block') {
        const mesh = getZoomedPainting()
        if (mesh && mesh.userData && mesh.userData.data) {
          showInfo(mesh.userData.data, mesh)
        }
      }
    })
    .start()
}

export function onClick(event, camera, controls, raycaster, pointer, paintings, scene) {
  if (getPaintingMode()) return // 설정창 작품선택 시 클릭 차단
  if (getCameraMovingState()) return

  pointer.x = (event.clientX / window.innerWidth) * 2 - 1
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
  raycaster.setFromCamera(pointer, camera)

  const allPaintings = getPaintings()
  const hits = raycaster.intersectObjects(allPaintings, true)
  if (hits.length > 0) {
    let mesh = hits[0].object

    // === 캡션 박스를 클릭한 경우 ===
    if (mesh.userData?.type === 'caption' || mesh.name === 'captionBox') {
      const parent = mesh.parent

      // 더블클릭 가드: 방금 캡션을 클릭했다는 흔적 남김(500ms 유효)
      __lastCaptionClickAt = performance.now()

      // 모달은 열려 있는데 __infoOpenForKey가 비어 있으면 현재 대상을 추정해 세팅
      if (isInfoModalOpen() && !__infoOpenForKey) {
        const current = getZoomedPainting() || parent
        __infoOpenForKey = extractKeyFromMesh(current) || null
      }

      if (parent) {
        // === 토글: 같은 작품으로 이미 모달이 열려 있으면 닫기
        const key = extractKeyFromMesh(parent)
        if (isInfoModalOpen() && __infoOpenForKey && key && __infoOpenForKey === key) {
          closeInfoModal()
          return // 닫기만 하고 종료
        }

        // 1) 캐시가 있으면 즉시 열기
        if (parent.userData?.data) {
          showInfo(parent.userData.data, parent)
          __infoOpenForKey = key || null // ===  현재 열린 대상 기록
        } else {
          // 2) 캐시가 없으면 카탈로그에서 조회 후 열기
          ;(async () => {
            const data = await ensurePaintingDataFromCatalog(parent)
            if (data) {
              showInfo(data, parent)
              __infoOpenForKey = key || null //
            }
            // 필요시 폴백: document.getElementById('infoButton')?.click()
          })()
        }
      }

      // === 캡션 클릭 시에는 선택/아웃라인/편집 버튼/줌 모두 무시하고 종료 ===
      return
    }

    // === textPlane이 선택된 경우 parent(프레임/플레인)로 치환 ===
    if (
      mesh.parent &&
      (mesh.parent.userData.type === 'intro-frame' || mesh.parent.userData.type === 'intro-plane')
    ) {
      mesh = mesh.parent
    }

    setSelectedPainting(mesh)

    if (getZoomedPainting() === mesh) return

    // "paintings 배열에 포함" 또는 "type 체크" 모두 포함
    if (
      allPaintings.indexOf(mesh) !== -1 ||
      mesh.userData.type === 'intro-frame' ||
      mesh.userData.type === 'intro-plane'
    ) {
      setCurrentPaintingIndex(allPaintings.indexOf(mesh))

      // === 선택 직후 데이터 프리패치(다음 info 열기 빠르게)
      prefetchPaintingData(mesh)

      zoomTo(mesh, ZOOM_DISTANCE, camera, controls) // 첫 번째 줌
      setZoomedPainting(mesh)
      setZoomLevel(1)
    }
  } else {
    endEditingPainting(scene) // 그림이 아닌곳 클릭 시 편집 종료 -> 버튼 숨김
  }
}

export function onDoubleClick(event, camera, controls, raycaster, pointer, scene) {
  if (getPaintingMode()) return // 설정창 작품선택 시 클릭 차단
  const zoomed = getZoomedPainting()
  if (!zoomed || getCameraMovingState()) return

  // === 더블클릭 가드: 직전에(≤500ms) 캡션을 클릭했다면 모든 줌 토글 금지
  if (performance.now() - __lastCaptionClickAt <= 500) {
    return
  }

  // === 레이캐스트로도 한 번 더 안전장치 (호출부에서 raycaster/pointer 전달 시)
  if (raycaster && pointer) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(pointer, camera)

    const hits = raycaster.intersectObjects(getPaintings(), true)
    if (hits.length > 0) {
      const obj = hits[0].object
      if (obj?.userData?.type === 'caption' || obj?.name === 'captionBox') {
        return // 캡션 더블클릭은 2차 줌 금지
      }
    }
  }

  const level = getZoomLevel()
  if (level === 1) {
    zoomTo(zoomed, ZOOM_DISTANCE_CLOSER, camera, controls) // 2차 줌
    setZoomLevel(2)
  } else if (level === 2) {
    zoomTo(zoomed, ZOOM_DISTANCE, camera, controls) // 다시 1차 줌으로
    setZoomLevel(1)
  }
}


/**
 * 홈 버튼 클릭 시 Tween으로 카메라 이동(시선은 유지)
 * @param {THREE.Camera} camera 
 * @param {THREE.OrbitControls} controls 
 */
export function moveCameraToHome(camera, controls) {
  // 1. 카메라 z축만 중앙(0)으로 Tween 이동
  const targetPos = {
    x: INITIAL_CAMERA_POS.x,
    y: INITIAL_CAMERA_POS.y,
    z: INITIAL_CAMERA_POS.z
  }

  // 2. controls.target의 y는 현재 값 고정, x/z만 중앙으로 Tween
  const oldTarget = {
    x: controls.target.x,
    y: controls.target.y,
    z: controls.target.z,
  }
  const centerTarget = {
    x: 0,
    y: PAINTING_Y_OFFSET,
    z: 0
  }

  new Tween(camera.position, tweenGroup)
    .to(targetPos, 1200)
    .easing(Easing.Quadratic.Out)
    .onUpdate(() => {
      controls.update()
    })
    .start()

  new Tween(oldTarget, tweenGroup)
    .to(centerTarget, 1200)
    .easing(Easing.Quadratic.Out)
    .onUpdate(() => {
      controls.target.set(oldTarget.x, oldTarget.y, oldTarget.z)
      controls.update()
    })
    .start()
}

export function saveCameraPrevState(camera, controls) {
  prevCameraPos = camera.position.clone()
  prevControlsTarget = controls.target.clone()
}

export function zoomBackOut(camera, controls) {
  if (!prevCameraPos || !prevControlsTarget) return

  const startCam = camera.position.clone()
  const startTarget = controls.target.clone()
  const state = { t: 0 }

  setCameraMovingState(true)
  controls.enabled = false

  // 최신 Tween Group 방식 적용
  new Tween(state, tweenGroup)
    .to({ t: 1 }, 900)
    .easing(Easing.Cubic.InOut)
    .onUpdate(({ t }) => {
      camera.position.lerpVectors(startCam, prevCameraPos, t)
      controls.target.lerpVectors(startTarget, prevControlsTarget, t)
      controls.update()
    })
    .onComplete(() => {
      setCameraMovingState(false)
      // 초기화
      prevCameraPos = null
      prevControlsTarget = null
    })
    .start()
}
