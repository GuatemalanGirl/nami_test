// interaction/paintingDragHandlers.js

import * as THREE from 'three'
// -------------------------------------------------------------
// [PAINTING] 그림(작품) 드래그, 클릭, 편집, 이동 이벤트 핸들러 모듈
// - pointerdown: 그림 선택/드래그 시작
// - pointermove: 그림 드래그 이동
// - pointerup  : 그림 선택/편집/드래그 종료
// -------------------------------------------------------------

import { updatePaintingOrderByPosition } from '../core/order.js'

export function registerPaintingDragHandlers(domElement, {
  getIsResizingWithHandle,
  getIsResizingPainting,
  getPaintingMode,
  getSelectedPainting,
  setSelectedPainting,
  getEditingPainting,
  startEditingPainting,
  endEditingPainting,
  getPaintings,
  getCurrentWall,
  ROOM_WIDTH,
  ROOM_HEIGHT,
  ROOM_DEPTH,
  detectWall,
  camera,
  raycaster,
  scene,
  controls,
  quill
}) {
  // 그림 드래그/선택 상태 변수 (이 파일 로컬)
  let pointerDownTime = 0; // pointerdown 시각
  let dragStartScreen = null; // pointerdown 위치
  let isDragging = false; // 드래그 중 여부
  let wasDragging = false; // 바로 직전 드래그였는지 체크
  const dragThreshold = 7; // 픽셀 (7px 이상 움직이면 드래그로 간주)
  const clickTimeThreshold = 200; // ms (200ms 이하면 클릭으로 간주)

  // -----------------------------
  // 마우스 드래그로 그림 위치 이동
  // -----------------------------
  domElement.addEventListener("pointerdown", (e) => {
    if (getIsResizingWithHandle() || getIsResizingPainting()) return; // 크기조절 중이면 무시

    if (!getPaintingMode()) return;
    pointerDownTime = Date.now();
    dragStartScreen = { x: e.clientX, y: e.clientY };
    isDragging = false;
    setSelectedPainting(null);

    const currentWall = getCurrentWall();

    // pointerdown에서 어떤 그림 위에 있는지 감지해서 selectedPainting 저장
    const rect = domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);
    const wallPaintings = getPaintings().filter(
      (mesh) => detectWall(mesh) === currentWall
    );
    const hits = raycaster.intersectObjects(wallPaintings, true);
    if (hits.length > 0) {
      let mesh = hits[0].object;
      // ---- parent 치환 ----
      if (
        mesh.parent &&
        (mesh.parent.userData.type === 'intro-frame' || mesh.parent.userData.type === 'intro-plane')
      ) {
        mesh = mesh.parent;
      }
      setSelectedPainting(mesh);
    }
  });

  domElement.addEventListener("pointerup", (e) => {
    if (getIsResizingWithHandle() || getIsResizingPainting()) return; // 크기조절 중이면 무시

    if (!getPaintingMode() || !dragStartScreen) return;
    const dt = Date.now() - pointerDownTime;
    const dx = e.clientX - dragStartScreen.x;
    const dy = e.clientY - dragStartScreen.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // --- 1. 드래그 상태 확인 ---
    if (isDragging) {
      wasDragging = true;
      // 드래그로 끝났을 때: 배열 정렬 동기화
      updatePaintingOrderByPosition();
      // 드래그로 끝났을 때는 아무 동작도 하지 않는다 (버튼X)
    } else {
      wasDragging = false;
      // 클릭 판정(=드래그 아님 + 시간/거리 조건)
      const sel = getSelectedPainting();
      if (dt < clickTimeThreshold && dist < dragThreshold && sel) {
        if (getEditingPainting() && getEditingPainting() !== sel) {
          endEditingPainting(scene);
        }
        if (getEditingPainting() !== sel) {
          startEditingPainting(sel, scene, camera, controls, quill);
        }
      }
      // 그림 없는 곳 클릭시
      if (
        !sel ||
        (dt < clickTimeThreshold && dist < dragThreshold && !sel)
      ) {
        endEditingPainting(scene);
      }
    }
    // 리셋
    dragStartScreen = null;
    pointerDownTime = 0;
    isDragging = false;
    setSelectedPainting(null);
  });

  domElement.addEventListener("pointermove", (e) => {
    if (getIsResizingWithHandle() || getIsResizingPainting()) return; // 크기조절 중이면 무시

    if (!getPaintingMode() || !(e.buttons & 1) || !dragStartScreen) return;

    const dx = e.clientX - dragStartScreen.x;
    const dy = e.clientY - dragStartScreen.y;
    if (!isDragging && Math.sqrt(dx * dx + dy * dy) > dragThreshold) {
      isDragging = true; // 일정 이상 움직이면 드래그 시작

      if (getEditingPainting()) {
        // 드래그 시작 -> 기존 편집(테두리) 제거
        endEditingPainting(scene); // 테두리+편집버튼 모두 사라짐
      }
    }

    // 드래그 중이면 selectedPainting 이동
    if (isDragging) {
      const sel = getSelectedPainting();
      if (sel) {
        const rect = domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(mouse, camera);

        const currentWall = getCurrentWall();
        const wallMesh = scene.getObjectByName(currentWall);
        if (wallMesh) {
          const intersects = raycaster.intersectObject(wallMesh);
          if (intersects.length > 0) {
            const point = intersects[0].point.clone();
            const normal = intersects[0].face.normal
              .clone()
              .transformDirection(wallMesh.matrixWorld);
            point.add(normal.multiplyScalar(0.05));

            const box = new THREE.Box3().setFromObject(sel);
            const size = new THREE.Vector3();
            box.getSize(size);

            const halfW = ROOM_WIDTH / 2;
            const halfH = ROOM_HEIGHT / 2;
            const halfD = ROOM_DEPTH / 2;

            const halfWidth = size.x / 2;
            const halfHeight = size.y / 2;
            const halfDepth = size.z / 2;

            switch (currentWall) {
              case "front":
              case "back":
                point.x = THREE.MathUtils.clamp(
                  point.x,
                  -halfW + halfWidth,
                  halfW - halfWidth
                );
                point.y = THREE.MathUtils.clamp(
                  point.y,
                  -halfH + halfHeight,
                  halfH - halfHeight
                );
                break;
              case "left":
              case "right":
                point.z = THREE.MathUtils.clamp(
                  point.z,
                  -halfD + halfDepth,
                  halfD - halfDepth
                );
                point.y = THREE.MathUtils.clamp(
                  point.y,
                  -halfH + halfHeight,
                  halfH - halfHeight
                );
                break;
            }

            sel.position.copy(point);
          }
        }
      }
    }
  });
}
