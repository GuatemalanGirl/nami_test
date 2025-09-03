// ui/dropHandlers.js
import * as THREE from 'three'
import { getCurrentWall } from '../domain/wall.js'
import { loadAndAddArtwall, getTempArtwalls } from '../domain/artwall.js'
import { loadAndAddPainting, getPaintings, getTempPaintings, attachCaptionBox } from '../domain/painting.js'
import { ROOM_DEPTH, ROOM_WIDTH, ROOM_HEIGHT } from '../core/constants.js'
import { createIntroFrameBoxAt, createIntroWallPlaneAt, getTempIntroMeshes, createPosterPlaneAt } from '../domain/intro.js'
import { getIntroMode } from '../domain/introMode.js'
import { updatePaintingOrderByPosition } from '../core/order.js'
import { updatePointer } from '../core/pointer.js' // ★ 통합 포인터(NDC) 처리

// ────────────────────────────────────────────────────────────────
// 재사용 임시 객체(할당 최소화)
const ndc = new THREE.Vector2()
const tmpPoint = new THREE.Vector3()
const tmpNormal = new THREE.Vector3()
// ────────────────────────────────────────────────────────────────

/**
 * "아트월 썸네일"을 드래그 앤 드롭했을 때 처리
 * @param {string} rawData - JSON 문자열로 인코딩된 artwall 데이터
 * @param {THREE.Scene} scene
 * @param {THREE.TextureLoader} textureLoader
 */
export function handleArtwallDrop(rawData, scene, textureLoader) {
  let wallData
  try {
    wallData = JSON.parse(rawData)
  } catch (err) {
    console.error('Invalid artwall data:', err)
    return
  }

  const currentWall = getCurrentWall()
  const wallMesh = scene.getObjectByName(currentWall)
  if (!wallMesh) {
    alert('벽을 찾을 수 없습니다.')
    return
  }

  // 벽 중앙 고정 배치 (가벼운 시작점)
  const wallZ = ROOM_DEPTH / 2 - 0.01
  const wallX = ROOM_WIDTH / 2 - 0.01

  const fixedPos = new THREE.Vector3()
  let rotY = 0

  switch (currentWall) {
    case 'front':
      fixedPos.set(0, 0, wallZ); rotY = Math.PI; break
    case 'back':
      fixedPos.set(0, 0, -wallZ); rotY = 0; break
    case 'left':
      fixedPos.set(wallX, 0, 0); rotY = -Math.PI / 2; break
    case 'right':
      fixedPos.set(-wallX, 0, 0); rotY = Math.PI / 2; break
  }

  loadAndAddArtwall(wallData, fixedPos, rotY, scene, textureLoader).then((mesh) => {
    getTempArtwalls().push(mesh)
    // (필요시 아트월 정렬) updatePaintingOrderByPosition()
  })
}

/**
 * 작품 썸네일 드롭 처리
 * @param {string} rawData - JSON 문자열
 * @param {THREE.Scene} scene
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Camera} camera
 * @param {THREE.Raycaster} raycaster
 * @param {Array} tempPaintings
 * @param {THREE.TextureLoader} textureLoader
 * @param {DragEvent} event
 */
export function handlePaintingDrop(rawData, scene, renderer, camera, raycaster, tempPaintings, textureLoader, event) {
  let paintingData
  try {
    paintingData = JSON.parse(rawData)
  } catch (err) {
    console.error('Invalid painting data:', err)
    return
  }

  // ★ 캔버스 기준 NDC 좌표 일관 처리
  const ok = updatePointer(event, ndc, renderer)
  if (!ok) return
  raycaster.setFromCamera(ndc, camera)

  const currentWall = getCurrentWall()
  const wallMesh = scene.getObjectByName(currentWall)
  if (!wallMesh) {
    alert('벽을 찾을 수 없습니다.')
    return
  }

  const intersects = raycaster.intersectObject(wallMesh)
  if (!intersects.length) return

  // 드롭 지점 + 노멀 방향 살짝 띄우기
  tmpPoint.copy(intersects[0].point)
  tmpNormal.copy(intersects[0].face.normal).transformDirection(wallMesh.matrixWorld)
  tmpPoint.add(tmpNormal.multiplyScalar(0.05))

  // 벽 안쪽 클램프
  const halfW = ROOM_WIDTH / 2
  const halfH = ROOM_HEIGHT / 2
  const halfD = ROOM_DEPTH / 2
  const margin = 1

  switch (currentWall) {
    case 'front':
    case 'back':
      tmpPoint.x = THREE.MathUtils.clamp(tmpPoint.x, -halfW + margin, halfW - margin)
      tmpPoint.y = THREE.MathUtils.clamp(tmpPoint.y, -halfH + margin, halfH - margin)
      break
    case 'left':
    case 'right':
      tmpPoint.z = THREE.MathUtils.clamp(tmpPoint.z, -halfD + margin, halfD - margin)
      tmpPoint.y = THREE.MathUtils.clamp(tmpPoint.y, -halfH + margin, halfH - margin)
      break
  }

  const wallRotY = {
    front: Math.PI,
    back: 0,
    left: -Math.PI / 2,
    right: Math.PI / 2
  }[currentWall]

  loadAndAddPainting({
    scene,
    textureLoader,
    data: paintingData,
    position: tmpPoint.clone(),  // 안전하게 복사하여 전달
    rotationY: wallRotY
  }).then((mesh) => {
    tempPaintings.push(mesh) // 나중에 제거할 대상 추적

    // 드롭 시 캡션 자동 부착(실패 무시)
    try { attachCaptionBox?.(mesh) } catch (e) { console.warn('attachCaptionBox failed:', e) }

    updatePaintingOrderByPosition() // 드롭 후 정렬
  })
}

/**
 * 전시서문 프레임/플레인/포스터 드롭 처리
 * @param {'frame'|'plane'|'poster'} type
 * @param {THREE.Scene} scene
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Camera} camera
 * @param {THREE.Raycaster} raycaster
 * @param {Array<THREE.Object3D>} paintings
 * @param {Array<THREE.Object3D>} tempIntroMeshes
 * @param {boolean} isIntroMode
 * @param {DragEvent} event
 */
export function handleIntroDrop(type, scene, renderer, camera, raycaster, paintings, tempIntroMeshes, isIntroMode, event) {
  // ★ 캔버스 기준 NDC 좌표 일관 처리
  const ok = updatePointer(event, ndc, renderer)
  if (!ok) return
  raycaster.setFromCamera(ndc, camera)

  const currentWall = getCurrentWall()
  const wallMesh = scene.getObjectByName(currentWall)
  if (!wallMesh) {
    alert('벽을 찾을 수 없습니다.')
    return
  }

  const hit = raycaster.intersectObject(wallMesh)[0]
  if (!hit) return

  // 노멀로 살짝 띄워서 배치 (z-fighting 방지)
  tmpPoint.copy(hit.point)
  tmpNormal.copy(hit.face.normal).transformDirection(wallMesh.matrixWorld)
  tmpPoint.add(tmpNormal.multiplyScalar(0.02))

  if (type === 'frame') {
    createIntroFrameBoxAt(tmpPoint.clone(), currentWall, scene, paintings, tempIntroMeshes, isIntroMode)
  } else if (type === 'plane') {
    createIntroWallPlaneAt(tmpPoint.clone(), currentWall, scene, paintings, tempIntroMeshes, isIntroMode)
  } else if (type === 'poster') {
    // 포스터는 1개 제한
    const already = (() => {
      let found = null
      scene?.traverse((obj) => {
        if (!found && obj?.userData?.type === 'poster') found = obj
      })
      return found
    })()
    if (already) {
      console.warn('[poster] only one poster is allowed.')
      alert('포스터는 한 개만 붙일 수 있어요.')
      return
    }
    const poster = createPosterPlaneAt(tmpPoint.clone(), currentWall, scene, paintings, tempIntroMeshes, isIntroMode)
    if (!poster) return
  }

  updatePaintingOrderByPosition()
}

/**
 * 드래그앤드롭 이벤트 등록
 *
 * - dragover: 기본 동작 방지 + 드롭 효과 힌트
 * - drop: artwall, painting, introType 구분하여 핸들러 호출
 *
 * @param {HTMLElement} domElement - drop 이벤트를 받을 dom (대개 renderer.domElement)
 * @param {object} options
 * @param {THREE.Scene} options.scene
 * @param {THREE.WebGLRenderer} options.renderer
 * @param {THREE.Camera} options.camera
 * @param {THREE.Raycaster} options.raycaster
 * @param {THREE.TextureLoader} options.textureLoader
 */
export function registerDropEvents(domElement, {
  scene,
  renderer,
  camera,
  raycaster,
  textureLoader
}) {
  domElement.addEventListener('dragover', (e) => {
    // 일부 브라우저에서 drop 가능 표시를 위해 반드시 필요
    e.preventDefault()
    try { e.dataTransfer.dropEffect = 'copy' } catch {}
  })

  domElement.addEventListener('drop', (e) => {
    e.preventDefault()

    // 아트월 드래그 앤 드롭
    const artRaw = e.dataTransfer.getData('artwall')
    if (artRaw) {
      handleArtwallDrop(artRaw, scene, textureLoader)
      return
    }

    // 그림 작품 드래그 앤 드롭
    const paintingRaw = e.dataTransfer.getData('painting')
    if (paintingRaw) {
      handlePaintingDrop(
        paintingRaw,
        scene,
        renderer,
        camera,
        raycaster,
        getTempPaintings(),
        textureLoader,
        e // ★ 드롭 이벤트(좌표 포함)
      )
      return
    }

    // 전시서문 프레임/플레인/포스터 드래그 앤 드롭
    const introType = e.dataTransfer.getData('intro-type')
    if (introType === 'frame' || introType === 'plane' || introType === 'poster') {
      handleIntroDrop(
        introType,
        scene,
        renderer,
        camera,
        raycaster,
        getPaintings(),
        getTempIntroMeshes(),
        getIntroMode(),
        e // ★ 드롭 이벤트(좌표 포함)
      )
      return
    }
  })
}
