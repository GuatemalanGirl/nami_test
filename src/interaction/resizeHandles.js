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
const dragPlane = new THREE.Plane();
const dragStartPoint = new THREE.Vector3();
const dragCurrentPoint = new THREE.Vector3();

/**
 * pointerdown: 크기 조절 시작
 */
export function onResizeHandlePointerDown(event, raycaster, pointer, camera, renderer) {
  const resizeHandleMesh = getResizeHandleMesh();
  if (!resizeHandleMesh) return;

  updatePointer(event, pointer, renderer);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(resizeHandleMesh);

  if (hits.length) {
    const mesh = resizeHandleMesh.userData.targetMesh;
    if (!mesh) return; // 추가: null 안전!

    isResizingWithHandle = true;

    dragPlane.setFromNormalAndCoplanarPoint(
      camera.getWorldDirection(new THREE.Vector3()).negate(),
      resizeHandleMesh.position,
    );
    raycaster.ray.intersectPlane(dragPlane, dragStartPoint);

    mesh.userData._resizeOrigScale = mesh.userData.originalScale.clone();
  }
}

/**
 * pointermove: 드래그 중 실시간 크기 조절
 */
export function onResizeHandlePointerMove(event, raycaster, pointer, camera, renderer, scene) {
  const resizeHandleMesh = getResizeHandleMesh();
  if (!isResizingWithHandle || !resizeHandleMesh) return;

  const mesh = resizeHandleMesh.userData.targetMesh;
  if (!mesh) return; // 추가: null 안전!

  const orig = mesh.userData._resizeOrigScale;
  if (!orig) return; // 추가: null 안전!

  updatePointer(event, pointer, renderer);
  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(dragPlane, dragCurrentPoint);

  // 핸들러 위치를 마우스 위치(3D)에 맞춘다
  resizeHandleMesh.position.copy(dragCurrentPoint);

  /* 월드 -> 로컬 좌표로 변환해 Δ 계산 */
  const localStart = mesh.worldToLocal(dragStartPoint.clone());
  const localCurrent = mesh.worldToLocal(dragCurrentPoint.clone());
  const deltaLocal = localCurrent.clone().sub(localStart);

  // 핸들러 크기 조절 범위 -> 최소 0.5배, 최대 2배
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
        Math.max(Math.abs(factorX), Math.abs(factorY)) * Math.sign(factorY);
      mesh.scale.x = orig.x * factor;
      mesh.scale.y = orig.y * factor;
    } else {
      mesh.scale.x = orig.x * factorX;
      mesh.scale.y = orig.y * factorY;
    }
    // z(두께)는 그대로 유지!
  } else {
    // ---- 기존 그림(정사각형 등) → 비율 고정 크기조절 ----
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
export function onResizeHandlePointerUp(scene) {
  const resizeHandleMesh = getResizeHandleMesh();
  if (!isResizingWithHandle || !resizeHandleMesh) return;

  isResizingWithHandle = false;

  const mesh = resizeHandleMesh.userData.targetMesh;
  if (!mesh || !mesh.userData.originalScale) return; // 추가: null 안전!

  mesh.userData.scaleValue = mesh.scale.x / mesh.userData.originalScale.x;

  // 프레임·플레인 서문이면 실시간으로 텍스트 업데이트
  if (mesh.userData.type?.startsWith('intro') && mesh.userData.html) {
    updateIntroTextPlaneFromHTML(mesh, mesh.userData.html);
  }
}

// getter
export function getIsResizingWithHandle() {
  return isResizingWithHandle;
}

// setter
export function setIsResizingWithHandle(value) {
  isResizingWithHandle = value;
}