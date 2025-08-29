// interaction/paintingDragHandlers.js

import * as THREE from 'three'
// -------------------------------------------------------------
// [PAINTING] 그림(작품) 드래그, 클릭, 편집, 이동 이벤트 핸들러 모듈
// - pointerdown: 그림 선택/드래그 시작
// - pointermove: 그림 드래그 이동
// - pointerup  : 그림 선택/편집/드래그 종료
// -------------------------------------------------------------

import { updatePaintingOrderByPosition } from '../core/order.js'
import { createEdgeWallNavigator } from './edgeWallNavigator.js'
import { goToLeftWall, goToRightWall } from '../ui/wallNavigation.js'
import { getCameraMovingState } from '../domain/zoomState.js'

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
  quill,

  // intro(서문) 모드 게이트 (없으면 false)
  getIntroMode = () => false
}) {
  // 그림 드래그/선택 상태 변수 (이 파일 로컬)
  let pointerDownTime = 0; // pointerdown 시각
  let dragStartScreen = null; // pointerdown 위치
  let isDragging = false; // 드래그 중 여부
  let wasDragging = false; // 바로 직전 드래그였는지 체크
  const dragThreshold = 7; // 픽셀 (7px 이상 움직이면 드래그로 간주)
  const clickTimeThreshold = 200; // ms (200ms 이하면 클릭으로 간주)

  // 네비 직후 pointerup 클릭/드롭 판정 억제 플래그
  let suppressNextPointerUp = false;

  // 실제 드래그 타깃(작품/서문)이 선택되어 있는지
  let hasDragTarget = false;

  // 헬퍼: 활성 모드(작품 or 서문) 여부
  const anyModeActive = () => !!(getPaintingMode?.() || getIntroMode?.());

  // 헬퍼: 리사이즈 중 여부 (공통 게이트)
  const anyResizing = () => !!(getIsResizingWithHandle?.() || getIsResizingPainting?.());

  // 회전 계산에 재사용할 임시 객체들(할당 최소화)
  const forward = new THREE.Vector3(0, 0, 1); // mesh의 “정면”이 +Z라고 가정
  const tmpQuat  = new THREE.Quaternion();
  const tmpNorm  = new THREE.Vector3();

  // 엣지-드래그 네비게이터 생성 (painting+intro 공통 사용)
  const edgeNav = createEdgeWallNavigator({
    domElement,
    // ★ 타깃이 있을 때만 엣지 네비 활성
    isActive:   () => anyModeActive() && hasDragTarget,
    isDragging: () => isDragging,
    isResizing: () => anyResizing(),
    isMoving:   () => !!getCameraMovingState?.(), // 카메라 이동 중엔 비활성화
    onBeforeNavigate: (dir) => {
      // 네비 직전 드래그 안전 처리 (선택/드래그는 유지)
      try { endEditingPainting?.(scene); } catch(_) {}
      // 드래그 연속성 유지를 위해 상태를 리셋하지 않음
      suppressNextPointerUp = true;
    },
    goLeft:  () => goToLeftWall(camera, controls),
    goRight: () => goToRightWall(camera, controls),
    edgePct: 0.08,   // 좌/우 8%
    dwellMs: 100,    // 머문 시간
    cooldownMs: 500  // 재트리거 대기
  });

  // -----------------------------
  // 마우스 드래그로 그림 위치 이동
  // -----------------------------
  domElement.addEventListener("pointerdown", (e) => {
    if (anyResizing()) return; // 크기조절 중이면 무시

    // 작품/서문 모드 중 하나라도 아니면 무시
    if (!anyModeActive()) return;

    pointerDownTime = Date.now();
    dragStartScreen = { x: e.clientX, y: e.clientY };
    isDragging = false;
    suppressNextPointerUp = false;

    // (작품/서문 공통) 선택 초기화
    setSelectedPainting?.(null);
    hasDragTarget = false;

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
      setSelectedPainting?.(mesh);
      hasDragTarget = true;        // 실제 타깃 확보
    } else {
      hasDragTarget = false;       // 빈 곳 클릭
    }

    // 엣지 네비 초기화 (타깃 판정 이후 호출)
    edgeNav.onDragStart();

    // 패널 위로 포인터가 가도 이벤트 유지
    try { domElement.setPointerCapture?.(e.pointerId); } catch (_) {}
  });

  domElement.addEventListener("pointerup", (e) => {
    if (anyResizing()) return; // 크기조절 중이면 무시
    if (!anyModeActive() || !dragStartScreen) return;

    // 네비 직후 pointerup 억제 — 클릭/드롭 판정 없이 리셋만
    if (suppressNextPointerUp) {
      suppressNextPointerUp = false;
      dragStartScreen = null;
      pointerDownTime = 0;
      isDragging = false;
      setSelectedPainting?.(null);
      hasDragTarget = false; 
      edgeNav.onDragEnd();
      try { domElement.releasePointerCapture?.(e.pointerId); } catch (_) {}
      return;
    }

    const dt = Date.now() - pointerDownTime;
    const dx = e.clientX - dragStartScreen.x;
    const dy = e.clientY - dragStartScreen.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // --- 1. 드래그 상태 확인 ---
    if (isDragging) {
      wasDragging = true;
      // 드래그로 끝났을 때: 배열 정렬 동기화 (그림 모드에서만)
      if (getPaintingMode?.()) {
        updatePaintingOrderByPosition();
      }
      // 드래그로 끝났을 때는 아무 동작도 하지 않는다 (버튼X)
    } else {
      wasDragging = false;

      // 클릭 판정은 "작품 모드에서만" 수행 (서문 모드에선 별도 편집 오픈 X)
      if (getPaintingMode?.()) {
        const sel = getSelectedPainting?.();
        if (dt < clickTimeThreshold && dist < dragThreshold && sel) {
          if (getEditingPainting?.() && getEditingPainting() !== sel) {
            endEditingPainting?.(scene);
          }
          if (getEditingPainting?.() !== sel) {
            startEditingPainting?.(sel, scene, camera, controls, quill);
          }
        }
        // 그림 없는 곳 클릭시
        if (!sel || (dt < clickTimeThreshold && dist < dragThreshold && !sel)) {
          endEditingPainting?.(scene);
        }
      } else {
        // intro 모드 클릭은 여기서 특별 처리 없음(필요 시 별도 모듈에서)
      }
    }
    // 리셋
    dragStartScreen = null;
    pointerDownTime = 0;
    isDragging = false;
    setSelectedPainting?.(null);
    hasDragTarget = false;
    edgeNav.onDragEnd();

    try { domElement.releasePointerCapture?.(e.pointerId); } catch (_) {}
  });

  domElement.addEventListener("pointermove", (e) => {
    if (anyResizing()) return; // 크기조절 중이면 무시

    if (!anyModeActive() || !(e.buttons & 1) || !dragStartScreen) return;

    const dx = e.clientX - dragStartScreen.x;
    const dy = e.clientY - dragStartScreen.y;
    if (!isDragging && Math.sqrt(dx * dx + dy * dy) > dragThreshold) {
      
      if (!hasDragTarget) return; // 실제 선택된 타깃이 없으면 드래그 시작하지 않음(엣지 네비도 비활성)
      isDragging = true; // 일정 이상 움직이면 드래그 시작

      if (getPaintingMode?.()) {
        // 드래그 시작 -> 기존 편집(테두리) 제거
        if (getEditingPainting?.()) {
          endEditingPainting?.(scene); // 테두리+편집버튼 모두 사라짐
        }
      } else if (getIntroMode?.()) {
        // 서문 모드 드래그 시작 시에도 그림 편집 UI는 닫아두는 편이 안전
        try { endEditingPainting?.(scene); } catch(_) {}
      }
    }

    // 드래그 중이면 selectedPainting(또는 intro 오브젝트) 이동
    if (isDragging) {
      const sel = getSelectedPainting?.();
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

            // 회전(노멀 정렬): forward(+Z) -> 벽 노멀(normal) 방향으로 회전
            tmpNorm.copy(normal).normalize();
            tmpQuat.setFromUnitVectors(forward, tmpNorm);
            // 부드럽게 보간(원하면 0.2~0.5 사이로 조절)
            sel.quaternion.slerp(tmpQuat, 0.35);
            // 즉시 정렬 원하면: sel.quaternion.copy(tmpQuat);
          }
        }
      }
    }
  });

  // pointercancel: 캡처 해제 + 상태 리셋(안전)
  domElement.addEventListener("pointercancel", (e) => {
    if (!anyModeActive() || !dragStartScreen) return;
    suppressNextPointerUp = false;
    dragStartScreen = null;
    pointerDownTime = 0;
    isDragging = false;
    setSelectedPainting?.(null);
    hasDragTarget = false; 
    edgeNav.onDragEnd();
    try { domElement.releasePointerCapture?.(e.pointerId); } catch (_) {}
  });
}