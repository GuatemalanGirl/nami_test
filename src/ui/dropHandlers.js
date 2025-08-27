// ui/dropHandlers.js

import * as THREE from 'three'
import { getCurrentWall } from '../domain/wall.js'
import { loadAndAddArtwall, getTempArtwalls } from '../domain/artwall.js'
import { loadAndAddPainting, getPaintings, getTempPaintings, attachCaptionBox } from '../domain/painting.js'
import { ROOM_DEPTH, ROOM_WIDTH, ROOM_HEIGHT } from '../core/constants.js'
import { createIntroFrameBoxAt, createIntroWallPlaneAt, getTempIntroMeshes, createPosterPlaneAt } from '../domain/intro.js'
import { getIntroMode } from '../domain/introMode.js'
import { updatePaintingOrderByPosition } from '../core/order.js'

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
    console.error("Invalid artwall data:", err)
    return
  }

  // 벽면 중앙 좌표 계산
  const currentWall = getCurrentWall()
  const wallMesh = scene.getObjectByName(currentWall)
  if (!wallMesh) {
    alert("벽을 찾을 수 없습니다.")
    return
  }

  const wallZ = ROOM_DEPTH / 2 - 0.01
  const wallX = ROOM_WIDTH / 2 - 0.01

  let fixedPos = new THREE.Vector3()
  let rotY = 0

  switch (currentWall) {
    case "front":
      fixedPos.set(0, 0, wallZ)
      rotY = Math.PI
      break
    case "back":
      fixedPos.set(0, 0, -wallZ)
      rotY = 0
      break
    case "left":
      fixedPos.set(wallX, 0, 0)
      rotY = -Math.PI / 2
      break
    case "right":
      fixedPos.set(-wallX, 0, 0)
      rotY = Math.PI / 2
      break
  }

  loadAndAddArtwall(wallData, fixedPos, rotY, scene, textureLoader).then((mesh) => {
    getTempArtwalls().push(mesh)
    // (필요시 아트월도 정렬)
    // updatePaintingOrderByPosition()
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
 */
export function handlePaintingDrop(rawData, scene, renderer, camera, raycaster, tempPaintings, textureLoader) {
  let paintingData
  try {
    paintingData = JSON.parse(rawData)
  } catch (err) {
    console.error("Invalid painting data:", err)
    return
  }

  const rect = renderer.domElement.getBoundingClientRect()
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  )
  raycaster.setFromCamera(mouse, camera)

  const currentWall = getCurrentWall()
  const wallMesh = scene.getObjectByName(currentWall)
  if (!wallMesh) {
    alert("벽을 찾을 수 없습니다.")
    return
  }

  const intersects = raycaster.intersectObject(wallMesh)
  if (intersects.length === 0) return

  const point = intersects[0].point.clone()
  const normal = intersects[0].face.normal.clone().transformDirection(wallMesh.matrixWorld)
  point.add(normal.multiplyScalar(0.05)) // 벽에서 띄우기

  // 벽 안쪽에 위치 제한
  const halfW = ROOM_WIDTH / 2
  const halfH = ROOM_HEIGHT / 2
  const halfD = ROOM_DEPTH / 2
  const margin = 1

  switch (currentWall) {
    case "front":
    case "back":
      point.x = THREE.MathUtils.clamp(point.x, -halfW + margin, halfW - margin)
      point.y = THREE.MathUtils.clamp(point.y, -halfH + margin, halfH - margin)
      break
    case "left":
    case "right":
      point.z = THREE.MathUtils.clamp(point.z, -halfD + margin, halfD - margin)
      point.y = THREE.MathUtils.clamp(point.y, -halfH + margin, halfH - margin)
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
    getPaintings,
    data: paintingData,
    position: point,
    rotationY: wallRotY
  }).then((mesh) => {
    tempPaintings.push(mesh) // 나중에 제거할 대상 추적

    // 드롭 시, 작품(BoxGeometry)에 "캡션(작품설명)"을 우측-중하단에 부착
    //  - attachCaptionBox 내부에서 BoxGeometry 여부, 중복 존재 등을 자체 체크함
    //  - 부모-자식 결합으로 이동/회전/스케일 자동 추종
    try {
      attachCaptionBox?.(mesh)
    } catch (e) {
      console.warn('attachCaptionBox failed:', e)
    }

    updatePaintingOrderByPosition(); // 드롭 후 반드시 정렬
  })
}

/**
 * 전시서문 프레임/플레인 썸네일 드롭 처리
 * @param {string} type - "frame" 또는 "plane"
 * @param {THREE.Scene} scene
 * @param {THREE.Renderer} renderer
 * @param {THREE.Camera} camera
 * @param {THREE.Raycaster} raycaster
 * @param {Array} paintings
 * @param {Array} tempIntroMeshes
 * @param {boolean} isIntroMode
 * @param {MouseEvent} event
 */
export function handleIntroDrop(type, scene, renderer, camera, raycaster, paintings, tempIntroMeshes, isIntroMode, event) {
  const rect = renderer.domElement.getBoundingClientRect()
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  )

  raycaster.setFromCamera(mouse, camera)
  const currentWall = getCurrentWall()
  const wallMesh = scene.getObjectByName(currentWall)
  if (!wallMesh) {
    alert("벽을 찾을 수 없습니다.")
    return
  }

  const intersects = raycaster.intersectObject(wallMesh)
  if (intersects.length === 0) return

  const point = intersects[0].point.clone()

  if (type === "frame") {
    createIntroFrameBoxAt(point, currentWall, scene, paintings, tempIntroMeshes, isIntroMode)
  } else if (type === "plane") {
    createIntroWallPlaneAt(point, currentWall, scene, paintings, tempIntroMeshes, isIntroMode)
  } else if (type === "poster") {
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
      alert('포스터는 한 개만 붙힐 수 있어요.')
      return
    }

    const poster = createPosterPlaneAt(point, currentWall, scene, paintings, tempIntroMeshes, isIntroMode);
    if (!poster) return; // 가드(도메인에서 한 번 더 막기)
  }
  updatePaintingOrderByPosition(); // 위치 정렬
}

/**
 * 드래그앤드롭 이벤트 등록
 * 
 * - dragover: 기본 동작 방지
 * - drop: artwall, painting, introType 구분하여 핸들러 호출
 * 
 * @param {HTMLElement} domElement - drop 이벤트를 받을 dom (대개 renderer.domElement)
 * @param {object} options         - 필요한 인자들 (scene, renderer, camera, raycaster, 등)
 * @param {function} options.getTempPaintings
 * @param {function} options.getPaintings
 * @param {function} options.getTempIntroMeshes
 * @param {function} options.getIntroMode
 * @param {THREE.Scene} options.scene
 * @param {THREE.Renderer} options.renderer
 * @param {THREE.Camera} options.camera
 * @param {THREE.Raycaster} options.raycaster
 * @param {THREE.TextureLoader} options.textureLoader
 * @param {object} options.draggedIntroType - { value: string|null }
 */
export function registerDropEvents(domElement, {
  scene,
  renderer,
  camera,
  raycaster,
  textureLoader
}) {
  domElement.addEventListener("dragover", (e) => {
    e.preventDefault(); // 기본 동작 방지
  })

  domElement.addEventListener("drop", (e) => {
    e.preventDefault()

    // 아트월 드래그 앤 드롭
    const artRaw = e.dataTransfer.getData("artwall")
    if (artRaw) {
      handleArtwallDrop(artRaw, scene, textureLoader)
      return
    }

    // 그림 작품 드래그 앤 드롭
    const paintingRaw = e.dataTransfer.getData("painting")
    if (paintingRaw) {
      handlePaintingDrop(
        paintingRaw,
        scene,
        renderer,
        camera,
        raycaster,
        getTempPaintings(),
        textureLoader,
        getPaintings
      )
      return // 그림 작업 끝, 아래 intro용 드롭 실행 안함
    }

    // 전시서문 프레임/플레인/포스터 드래그 앤 드롭
    const introType = e.dataTransfer.getData("intro-type")
    if (introType === "frame" || introType === "plane" || introType === "poster") {
      handleIntroDrop(
        introType,
        scene,
        renderer,
        camera,
        raycaster,
        getPaintings(),
        getTempIntroMeshes(),
        getIntroMode(),
        e // 이벤트 객체도 전달
      )
      return
    }
  })
}
