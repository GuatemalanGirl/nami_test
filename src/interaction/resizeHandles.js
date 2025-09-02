// interaction/resizeHandles.js
// -------------------------------------------------------------
// [ARTWALL] Resize Handle 상호작용 이벤트 처리 모듈
// - pointerdown: 크기 조절 시작
// - pointermove: 드래그에 따라 실시간 크기 반영
// - pointerup: 최종 scale 적용 및 저장
// -------------------------------------------------------------

import * as THREE from 'three';
import { updatePointer } from '../core/pointer.js';
import { getResizeHandleMesh, updateResizeHandlePosition } from '../ui/resizeHandle.js';
import { showOutline } from '../ui/outline.js';
import { updateIntroTextPlaneFromHTML } from '../ui/updateIntroTextPlane.js'

let isResizingWithHandle = false;
// 터치 안정화: 어느 포인터가 리사이즈 중인지 고정
let activePointerId = null;

const dragPlane = new THREE.Plane();
const dragStartPoint = new THREE.Vector3();
const dragCurrentPoint = new THREE.Vector3();

/**
 * pointerdown: 크기 조절 시작
 */
export function onResizeHandlePointerDown(event, raycaster, pointer, camera, renderer) {
  const resizeHandleMesh = getResizeHandleMesh();
  if (!resizeHandleMesh) return;

  // 터치 스크롤/더블탭 확대 방지
  if (event.cancelable) event.preventDefault();

  updatePointer(event, pointer, renderer);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(resizeHandleMesh, true); // 자식까지 감지

  if (hits.length) {
    const mesh = resizeHandleMesh.userData.targetMesh;
    if (!mesh) return; // null 안전!

    isResizingWithHandle = true;
    activePointerId = event.pointerId; // 이 포인터만 추적

    // 캔버스에서 제스처가 끊기지 않도록(가능한 경우)
    try { event.target.setPointerCapture?.(event.pointerId); } catch {}

    dragPlane.setFromNormalAndCoplanarPoint(
      camera.getWorldDirection(new THREE.Vector3()).negate(),
      resizeHandleMesh.position,
    );
    raycaster.ray.intersectPlane(dragPlane, dragStartPoint);

    mesh.userData._resizeOrigScale = mesh.userData.originalScale?.clone();
  }
}

/**
 * pointermove: 드래그 중 실시간 크기 조절
 */
export function onResizeHandlePointerMove(event, raycaster, pointer, camera, renderer, scene) {
  const resizeHandleMesh = getResizeHandleMesh();
  if (!isResizingWithHandle || !resizeHandleMesh) return;

  // 다른 손가락/마우스 포인터의 move 이벤트는 무시
  if (activePointerId !== null && event.pointerId !== activePointerId) return;

  const mesh = resizeHandleMesh.userData.targetMesh;
  if (!mesh) return; // null 안전!

  const orig = mesh.userData._resizeOrigScale;
  if (!orig) return; // null 안전!

  // 터치 제스처 충돌 방지
  if (event.cancelable && event.pointerType !== 'mouse') event.preventDefault();

  updatePointer(event, pointer, renderer);
  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(dragPlane, dragCurrentPoint);

  // 핸들러 위치를 마우스 위치(3D)에 맞춘다
  resizeHandleMesh.position.copy(dragCurrentPoint);

  /* 월드 -> 로컬 좌표로 변환해 Δ 계산 */
  const localStart = mesh.worldToLocal(dragStartPoint.clone());
  const localCurrent = mesh.worldToLocal(dragCurrentPoint.clone());
  const deltaLocal = localCurrent.clone().sub(localStart);

  // 크기 조절 범위
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 2.0;

  if (
    mesh.userData.type === 'intro-frame' ||
    mesh.userData.type === 'intro-plane'
  ) {
    // 서문(사각형) -> x/y축 각각 자유 조절
    let factorX = 1 + deltaLocal.x;
    let factorY = 1 + deltaLocal.y;
    factorX = Math.max(MIN_SCALE, Math.min(MAX_SCALE, factorX));
    factorY = Math.max(MIN_SCALE, Math.min(MAX_SCALE, factorY));

    // 쉬프트키 누르면 정비율(정사각형)
    if (event.shiftKey) {
      const factor =
        Math.max(Math.abs(factorX), Math.abs(factorY)) * Math.sign(factorY || 1);
      mesh.scale.x = orig.x * factor;
      mesh.scale.y = orig.y * factor;
    } else {
      mesh.scale.x = orig.x * factorX;
      mesh.scale.y = orig.y * factorY;
    }
    // z(두께)는 그대로 유지!
  } else {
    // ---- 기존 그림(정사각형 등) -> 비율 고정 크기조절 ----
    let factor = 1 + deltaLocal.y;
    const clampedFactor = Math.max(MIN_SCALE, Math.min(MAX_SCALE, factor));
    mesh.scale.set(orig.x * clampedFactor, orig.y * clampedFactor, orig.z);
  }

  // 프레임·플레인 서문이면 실시간으로 텍스트 업데이트
  if (mesh.userData.type?.startsWith('intro') && mesh.userData.html) {
    updateIntroTextPlaneFromHTML(mesh, mesh.userData.html);
  }

  showOutline(mesh, scene);
  updateResizeHandlePosition(mesh);
}

/**
 * pointerup: 크기 조절 종료
 */
export function onResizeHandlePointerUp(scene /* <- 기존 시그니처 유지 */) {
  const resizeHandleMesh = getResizeHandleMesh();
  if (!isResizingWithHandle || !resizeHandleMesh) return;

  isResizingWithHandle = false;
  activePointerId = null; // 리셋

  const mesh = resizeHandleMesh.userData.targetMesh;
  if (!mesh || !mesh.userData.originalScale) return; // null 안전!

  mesh.userData.scaleValue = mesh.scale.x / mesh.userData.originalScale.x;

  // 프레임·플레인 서문이면 실시간으로 텍스트 업데이트
  if (mesh.userData.type?.startsWith('intro') && mesh.userData.html) {
    updateIntroTextPlaneFromHTML(mesh, mesh.userData.html);
  }

  // 캡처 해제는 호출부에서 pointerup 이벤트 객체로 처리(이 모듈은 시그니처 유지)
}

// getter
export function getIsResizingWithHandle() {
  return isResizingWithHandle;
}

// setter
export function setIsResizingWithHandle(value) {
  isResizingWithHandle = value;
}