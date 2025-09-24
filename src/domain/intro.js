// domain/intro.js

import * as THREE from 'three'
import { safeUpdatePaintingOrder } from '../core/order.js'
import { setIntroMode } from './introMode.js'
import { markAsColorTexture } from '../core/colorManagement.js'
import { removeOutline } from '../ui/outline.js'
import { hidePaintingEditButtons } from '../ui/paintingEditButtons.js'
import { endEditingPainting } from './paintingEditing.js'

let tempIntroMeshes = []
let originalIntroState = []

export function createIntroFrameBoxAt(position, currentWall, scene, paintings, tempIntroMeshes, isIntroMode) {
  const boxWidth = 3, boxHeight = 3, boxDepth = 0.1 // 작품과 두께 동일
  const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth)
  const materials = Array(6).fill(new THREE.MeshStandardMaterial({ color: 0xffffff }))
  materials[4] = new THREE.MeshBasicMaterial({ color: 0xffffff }) // 앞면

  const box = new THREE.Mesh(geometry, materials)
  box.position.copy(position)

  const rotY = getWallRotationY(currentWall)
  box.rotation.y = rotY
  // 작품처럼 정면 방향으로 밀기
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(box.quaternion)
  box.position.add(forward.multiplyScalar(boxDepth / 2))

  box.userData = {
    isPainting: true, // 탐색·줌 대상
    type: 'intro-frame',
    /*data : {                    // infoModal 기본 데이터
      title       : "전시 서문",
      description : "(내용 없음)"
    }*/
    _baseScale: box.scale.clone(), // 처음 1,1,1 저장
    textMesh: null, // 텍스트 메쉬를 나중에 연결할 수 있도록 기본값 null
  }

   // 이전에 저장된 색상이 있으면 앞면 색 반영
  if (box.userData.frameColor) {
    box.material[4].color.set(box.userData.frameColor)
  }

  scene.add(box)
  paintings.push(box)
  if (isIntroMode) tempIntroMeshes.push(box)
  safeUpdatePaintingOrder()
  return box
}

export function createIntroWallPlaneAt(position, currentWall, scene, paintings, tempIntroMeshes, isIntroMode) {
  const geometry = new THREE.PlaneGeometry(3, 3)
  const material = new THREE.MeshBasicMaterial({
    color: 0xb3b3b3,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
    depthWrite: false
  })

  const plane = new THREE.Mesh(geometry, material)
  plane.position.copy(position) // 1. 위치 지정 (point는 이미 벽 앞)

  const rotY = getWallRotationY(currentWall) // 2. 회전 (작품 드롭과 완전히 동일하게)
  plane.rotation.y = rotY

  // 3. 벽 정면 방향으로 plane의 두께(혹은 offset)만큼 더 빼기
  // 여기서 offset을 "아트월"보다 더 크게!
  const offset = 0.08 // 벽면서문은 0.08로 더 앞쪽!
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(plane.quaternion)
  plane.position.add(forward.multiplyScalar(offset))

  // 4. 항상 아트월보다 위에 나오도록 renderOrder 적용
  plane.renderOrder = 10// 아트월이 1~2면 이건 10 등 더 큰 값

  plane.userData = {
    isPainting: true, // 탐색 대상
    type: 'intro-plane',
    /*data : {                    // infoModal용 최소 데이터
      title       : "전시 서문",
      description : "(내용 없음)"
    }*/
    _baseScale: plane.scale.clone(),
    textMesh: null
  }

  scene.add(plane)
  paintings.push(plane)
  if (isIntroMode) tempIntroMeshes.push(plane)
  safeUpdatePaintingOrder()
  return plane
}

/* ──────────────────────────────────────────────────────────
 * 전시 포스터 Plane 생성 (드래그&드롭용)
 *  - 기본은 흰색 Plane + DoubleSide
 *  - 텍스처는 선택/편집 시 paintingEditButtons의 업로드 버튼에서 적용
 * ────────────────────────────────────────────────────────── */
export function createPosterPlaneAt(position, currentWall, scene, paintings, tempIntroMeshes, isIntroMode) {
  // 이미 포스터가 있으면 새로 만들지 않음(최대 1개 정책)
  // getObjectByProperty는 중첩 프로퍼티('userData.type')를 지원하지 않으므로 traverse로 검사
  const exists = (() => {
    let found = null;
    scene?.traverse((obj) => {
      if (!found && obj?.userData?.type === 'poster') found = obj;
    });
    return found;
  })();
  if (exists) {
    console.warn('[poster] already exists; skip creating another.');
    return exists;
  }

  const geometry = new THREE.PlaneGeometry(3, 3) // 세로 포스터 기본 비율

  // 앞·뒤를 분리: 앞면(FrontSide)은 텍스처/흰색, 뒷면(BackSide)은 단색
  const frontMat = new THREE.MeshBasicMaterial({
    color: 0xd1ecff,
    side: THREE.FrontSide,
    transparent: false,
    toneMapped: false, // 톤매핑 바꿔도 포스터 색을 그대로 유지
  })
  const poster = new THREE.Mesh(geometry, frontMat)

  // 뒷면 전용 메쉬(단색) — 필요 시 색상 변경 가능
  const backMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,        // 기본 뒷면 색상
    side: THREE.BackSide,
    polygonOffset: true,    // 앞·뒤 Z-fighting 방지
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  })
  const backPlane = new THREE.Mesh(geometry.clone(), backMat)
  backPlane.name = 'posterBack'
  poster.add(backPlane)

  poster.position.copy(position)

  const rotY = getWallRotationY(currentWall)
  poster.rotation.y = rotY

  // 벽에서 약간 띄우기(아트월보다 앞)
  const offset = 0.08
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(poster.quaternion)
  poster.position.add(forward.multiplyScalar(offset))

  // 아트월보다 위에 렌더링
  poster.renderOrder = 10

  poster.userData = {
    isPainting: true,     // 탐색 대상(공통 파이프라인 활용)
    type: 'poster',       // 포스터 식별자
    _baseScale: poster.scale.clone(),
    textMesh: null,       // (포스터는 텍스트 메쉬 사용 안함, 일관성을 위해 필드만 둠)
    // 색상 기억: UI에서 바꿀 때 참고 가능
    posterBackColor: backMat.color.getHex(),
    applyTexture: (texture) => {
      markAsColorTexture(texture) // 포스터 텍스처는 sRGB 지정
      frontMat.map = texture
      frontMat.color.set(0xffffff) // 이미지가 씌워질 때 배경색 영향 제거
      frontMat.needsUpdate = true
    }
  }

  // 디버깅/선택 후 재조회에 유리하게 네이밍
  poster.name = `poster-${Date.now()}`

  scene.add(poster)
  paintings.push(poster)
  if (isIntroMode) tempIntroMeshes.push(poster)
  safeUpdatePaintingOrder()
  return poster
}

export function getWallRotationY(currentWall) {
  switch (currentWall) {
    case 'front': return Math.PI
    case 'back': return 0
    case 'left': return -Math.PI / 2
    case 'right': return Math.PI / 2
    default: return 0
  }
}

// 진입 시점에 상태 백업
export function snapshotIntroState(currentIntroMeshes) {
  if (!Array.isArray(currentIntroMeshes)) {
    console.warn("snapshotIntroState: 유효하지 않은 intro mesh 배열입니다", currentIntroMeshes)
    return
  }
  originalIntroState.length = 0
  currentIntroMeshes.forEach(mesh => {
    originalIntroState.push({
      mesh,
      position: mesh.position.clone(),
      rotation: mesh.rotation.clone(),
      html: mesh.userData.html,
    })
  })
}

// 편집 취소(롤백)
export function restoreIntroState(scene, paintings, updateIntroTextPlaneFromHTML) {
  // 1. 새로 만든 intro 메쉬 제거
  for (let mesh of tempIntroMeshes) {
    scene.remove(mesh)
    const idx = paintings.indexOf(mesh)
    if (idx !== -1) paintings.splice(idx, 1)
  }
  tempIntroMeshes.length = 0

  // 2. 원본 intro 객체 위치·회전·텍스트 복원
  for (let { mesh, position, rotation, html } of originalIntroState) {
    mesh.position.copy(position)
    mesh.rotation.copy(rotation)
    mesh.userData.html = html
    updateIntroTextPlaneFromHTML(mesh, html)
  }
  originalIntroState.length = 0
}

// 임시 intro 메쉬 추가/조회/초기화
export function addTempIntroMesh(mesh) {
  tempIntroMeshes.push(mesh)
}
export function getTempIntroMeshes() {
  return tempIntroMeshes
}
export function clearTempIntroMeshes() {
  tempIntroMeshes.length = 0
}

/**
 * 프레임 크기 변화 후 텍스트 스케일을 재계산
 * @param {THREE.Mesh} frameMesh  플레임(박스/플레인) 메쉬
 */
export function updateIntroTextScale(frameMesh) {
  const textMesh = frameMesh.userData.textMesh
  if (!textMesh) return

  // 최초 생성 시 저장해 둔 "기준 프레임 스케일"
  const baseFrameScale = frameMesh.userData._baseScale // {x,y}
  const sx = frameMesh.scale.x / baseFrameScale.x
  const sy = frameMesh.scale.y / baseFrameScale.y

  // ⬇️ ① fitInside : 짧은 변에 맞춰 글씨를 줄임
  const s = Math.min(sx, sy)

  // ⬇️ ② fitOutside 방식이 좋다면 Math.max(sx, sy) 사용
  // const s = Math.max(sx, sy);

  textMesh.scale.set(s, s, s)

  // 글자를 프레임 중앙에 재정렬 (선택)
  const bbox = new THREE.Box3().setFromObject(textMesh)
  const size = new THREE.Vector3()
  bbox.getSize(size)
  textMesh.position.set(
    -size.x * 0.5,
    -size.y * 0.5,
    0.001, // z-offset 살짝 앞으로
  )
}

//
// 자동 저장용 커밋 함수
//
export function commitIntroChanges(scene) {
  setIntroMode(false); // 설정창 '전시서문쓰기 모드' 해제
  clearTempIntroMeshes(); // 임시 intro 메쉬 초기화
  safeUpdatePaintingOrder();
  hidePaintingEditButtons();  // 편집종료 시 버튼 숨김
  endEditingPainting(scene); // 편집 종료
}
