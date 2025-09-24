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

// 캔버스 기준 정규화 좌표 계산 유틸(존재 시 사용, 없으면 기존 방식 폴백)
import { updatePointer } from '../core/pointer.js'

import { updateWallViewTo } from '../core/view.js'
import { getFacingWallName } from '../core/facingWall.js' // 레이캐스트 기반 벽 판정

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
  return ud.id || ud.filename || mesh?.name || ud.title || ud.uuid || null
}

// === 모달 상태 헬퍼
function isInfoModalOpen() {
  // style.display 대신 getComputedStyle로 판단(클래스 토글/애니메이션 대응)
  const el = document.getElementById('infoModal');
  return !!el && getComputedStyle(el).display !== 'none';
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
      const modal = document.getElementById('infoModal');
      if (modal && getComputedStyle(modal).display !== 'none') {
        const mesh = getZoomedPainting()
        if (mesh && mesh.userData && mesh.userData.data) {
          showInfo(mesh.userData.data, mesh)
        }
      }
    })
    .start()
}

// 좌표 계산을 더 견고하게: 캔버스 BCR 기준 → 레이캐스트 빗나감 방지
function setPointerFromEvent(event, pointer, renderer) {
  // renderer가 있고 clientX/Y가 있는 이벤트이면 BCR 기준으로 계산
  if (renderer?.domElement && event?.clientX != null && event?.clientY != null) {
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    return
  }
  // 그 외엔 기존 유틸 시도
  if (renderer?.domElement) {
    try { updatePointer(event, pointer, renderer); return } catch {}
  }
  // 최후 폴백: 창(window) 기준
  if (event?.clientX != null && event?.clientY != null) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
  }
}

// renderer를 옵션으로 추가해, 있으면 캔버스 기준 좌표를 사용
export function onClick(event, camera, controls, raycaster, pointer, paintings, scene, renderer /* optional */) {
  if (getPaintingMode()) return // 설정창 작품선택 시 클릭 차단
  if (getCameraMovingState()) return

  // 터치 기본 제스처 개입 방지(스크롤/더블탭 확대 등)
  if (event?.cancelable && event.pointerType && event.pointerType !== 'mouse') event.preventDefault()

  // 좌표 계산: 캔버스(BCR) 기준 정규화(-1~1)로 우선 처리
  setPointerFromEvent(event, pointer, renderer)
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

export function onDoubleClick(event, camera, controls, raycaster, pointer, scene, renderer /* optional */) {
  if (getPaintingMode()) return // 설정창 작품선택 시 클릭 차단
  const zoomed = getZoomedPainting()
  if (!zoomed || getCameraMovingState()) return

  // === 더블클릭 가드: 직전에(≤500ms) 캡션을 클릭했다면 모든 줌 토글 금지
  if (performance.now() - __lastCaptionClickAt <= 500) {
    return
  }

  // === 레이캐스트로도 한 번 더 안전장치 (호출부에서 raycaster/pointer 전달 시)
  if (raycaster && pointer) {
    // 터치 기본 제스처 억제
    if (event?.cancelable && event.pointerType && event.pointerType !== 'mouse') event.preventDefault()

    // 더블클릭도 동일하게 BCR 기준 좌표 적용
    setPointerFromEvent(event, pointer, renderer)
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

export function zoomBackOut(camera, controls, opts = {}) {
  const { keepControlsDisabled = false } = opts; // 서문 편집 모드에서 컨트롤 비활성 유지 옵션
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
      // 필요 시 컨트롤을 계속 비활성 상태로 유지 (서문 편집 모드)
      controls.enabled = keepControlsDisabled ? false : true
      // 초기화
      prevCameraPos = null
      prevControlsTarget = null
    })
    .start()
}

export function attachAutoReturnOnZoomOut(opts = {}) {
  const {
    camera, controls, scene,
    useRelative = true, delta = 0.7,
    threshold = 14, eps = 0.05,
    cooldownMs = 600, respectMode = true, debug = false,
  } = opts;

  // 이미 붙어 있으면 재장착 금지
  if (controls.__autoReturnAttached) {
    if (debug) console.debug('[autoReturn] already attached, skip');
    return;
  }

  let prevDist  = null;
  let startDist = null;
  let cooling   = false;
  let armed     = false;

  // 고정 피벗 계산용 임시 벡터
  const _tmp = new THREE.Vector3();

  function getFocusObject() {
    return (typeof getZoomedPainting === 'function' && getZoomedPainting()) || null;
  }

  // 포커스 객체의 "고정 피벗"을 얻는다.
  //   - zoomTo()에서 painting.userData.__focusPivot = target.clone() 로 캐시했다면 그 값을 우선 사용
  //   - 캐시가 없다면 월드 포지션으로 폴백(원점이 중앙이 아닌 모델도 대체로 안정적)
  function getFocusPivot(obj) {
    if (!obj) return null;
    if (obj.userData && obj.userData.__focusPivot) {
      // clone() 으로 외부 변형을 차단
      return obj.userData.__focusPivot.clone();
    }
    return obj.getWorldPosition(_tmp);
  }

  function distToFocus() {
    const obj = getFocusObject();
    if (!obj) {
      // 포커스 없으면 컨트롤 타겟 기준(중앙 상태에선 자유)
      return camera.position.distanceTo(controls?.target ?? camera.position);
    }
    const pivot = getFocusPivot(obj);
    return camera.position.distanceTo(pivot);
  }

  // DOT 근사 폴백
  function getFacingWallByDot() {
    const dir = new THREE.Vector3();
    if (controls?.target) dir.copy(controls.target).sub(camera.position).normalize();
    else camera.getWorldDirection(dir).normalize();
    const normals = {
      front: new THREE.Vector3( 0,  0,  1),
      back:  new THREE.Vector3( 0,  0, -1),
      left:  new THREE.Vector3( 1,  0,  0),
      right: new THREE.Vector3(-1,  0,  0),
    };
    let best = 'front', bestDot = -Infinity;
    for (const [name, n] of Object.entries(normals)) {
      const d = dir.dot(n);
      if (d > bestDot) { bestDot = d; best = name; }
    }
    return best;
  }

  function maybeTrigger(dist) {
    if (!armed) return;
    if (cooling) return;
    if (typeof getCameraMovingState === 'function' && getCameraMovingState()) return;
    if (respectMode && typeof getPaintingMode === 'function' && getPaintingMode()) return;

    // 작은 흔들림 걸러내기 + 명확한 “줌아웃”
    const goingOut = prevDist != null && dist > (prevDist + eps) && dist > (startDist + eps);

    // 상대 임계(권장): 제스처 시작 시점의 거리 + delta
    const crossedRelative = useRelative && startDist != null && dist >= (startDist + delta);

    // 절대 임계(옵션): threshold 상향 돌파
    const crossedAbsolute = !useRelative && prevDist != null && (prevDist <= threshold && dist >= threshold);

    if (debug) console.debug('[autoReturn maybe]', { dist, prevDist, startDist, goingOut, crossedRelative, crossedAbsolute, armed });

    if (goingOut && (crossedRelative || crossedAbsolute)) {
      cooling = true;

      // 우선 레이캐스트, 실패하면 DOT 폴백
      let facing = 'front';
      try { if (scene) facing = getFacingWallName(camera, scene) || getFacingWallByDot(); }
      catch { facing = getFacingWallByDot(); }

      if (debug) console.debug('[autoReturn trigger] facing =', facing);
      updateWallViewTo(camera, controls, facing);

      // 중앙 복귀 후 상태 초기화(임계 얽힘 해제)
      try { setZoomedPainting(null); } catch {}
      try { setZoomLevel(0); } catch {}
      armed     = false;
      prevDist  = null;
      startDist = null;

      setTimeout(() => { cooling = false; }, cooldownMs);
    }
  }

  function onChange() {
    const d = distToFocus();
    if (d == null) { prevDist = null; return; }
    if (prevDist === null) prevDist = d;
    maybeTrigger(d);
    prevDist = d;
  }

  function onStart() {
    const d = distToFocus();
    prevDist  = d;
    startDist = d;
    armed     = !!getFocusObject(); // 포커스가 있을 때만 ‘무장’
    if (debug) console.debug('[autoReturn start]', { armed, startDist });
  }

  function onEnd() {
    const d = distToFocus();
    if (d != null) prevDist = d;
    startDist = prevDist;
    if (debug) console.debug('[autoReturn end]', { prevDist });
  }

  controls.addEventListener('start',  onStart);
  controls.addEventListener('change', onChange);
  controls.addEventListener('end',    onEnd);

  controls.__autoReturnAttached = true;
  if (debug) console.debug('[autoReturn] attached');
}
