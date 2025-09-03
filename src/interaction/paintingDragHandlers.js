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

  // 멀티터치/포인터 관리 (핀치 시 드래그 잠금)
  const activePointers = new Set();
  let primaryPointerId = null;
  let multiTouch = false;

  // ★ 안드로이드(Samsung Internet/Chrome) pointerup 좌표 폴백용
  let lastClientPos = { x: 0, y: 0 };
  function getSafeClientXY(e) {
    let x = e?.clientX, y = e?.clientY;
    // 일부 브라우저에서 pointerup이 0,0 또는 undefined로 올 수 있어 폴백
    if (x == null || y == null || (x === 0 && y === 0)) {
      x = lastClientPos.x;
      y = lastClientPos.y;
    }
    return { x, y };
  }

  // 드래그 중 OrbitControls 잠깐 비활성화를 "원래 상태로 복원"되게 처리
  let __controlsPrev = null;
  const snapshotControls = () => {
    if (!controls || __controlsPrev) return;
    __controlsPrev = {
      enabled: controls.enabled,
      rotate:  controls.enableRotate ?? true,
      zoom:    controls.enableZoom   ?? true,
      pan:     controls.enablePan    ?? true,
    };
  };
  const lockControls = () => {
    if (!controls) return;
    snapshotControls();
    controls.enabled = false;
    if ('enableRotate' in controls) controls.enableRotate = false;
    if ('enableZoom'   in controls) controls.enableZoom   = false;
    if ('enablePan'    in controls) controls.enablePan    = false;
  };
  const restoreControls = () => {
    if (!controls || !__controlsPrev) return;
    // 원래 상태로 복원 (작품설정 모드에서 이미 잠겨 있었다면 그대로 유지됨)
    controls.enabled = __controlsPrev.enabled;
    if ('enableRotate' in controls) controls.enableRotate = __controlsPrev.rotate;
    if ('enableZoom'   in controls) controls.enableZoom   = __controlsPrev.zoom;
    if ('enablePan'    in controls) controls.enablePan    = __controlsPrev.pan;
    __controlsPrev = null;
  };

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
    // 타깃이 있고 멀티터치가 아닐 때만 엣지 네비 활성
    isActive:   () => anyModeActive() && hasDragTarget && !multiTouch,
    isDragging: () => isDragging,
    isResizing: () => anyResizing(),
    isMoving:   () => !!getCameraMovingState?.(),
    onBeforeNavigate: (dir) => {
      try { endEditingPainting?.(scene); } catch(_) {}
      suppressNextPointerUp = true;
    },
    goLeft:  () => goToLeftWall(camera, controls),
    goRight: () => goToRightWall(camera, controls),
    edgePct: 0.08,
    dwellMs: 100,
    cooldownMs: 500
  });

  // ─────────────────────────────────────────────────────────────
  // 드롭/취소 시, 히트 지점으로 스냅 + 경계 클램프 + 노멀 정렬
  //  - 현재 벽 히트 실패 시 4면 전체 검색
  //  - hit.object가 벽의 자식일 수 있으므로 최상위 벽 그룹을 parent 체인에서 탐색
  //  - 못 찾으면 노멀(|nx| vs |nz|)로 벽을 추정
  function finalizeDropAtClientXY(clientXY, {
    domElement, camera, raycaster, scene,
    getCurrentWall, ROOM_WIDTH, ROOM_HEIGHT, ROOM_DEPTH
  }, sel) {
    if (!sel) return;

    const rect = domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((clientXY.x - rect.left) / rect.width) * 2 - 1,
      -((clientXY.y - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);

    // 1) 현재 벽 우선, 안 맞으면 4면 전체 검사
    const currRoot = scene.getObjectByName(getCurrentWall());
    let hit = currRoot ? raycaster.intersectObject(currRoot, true)[0] : null;
    if (!hit) {
      const walls = ['front','back','left','right']
        .map(n => scene.getObjectByName(n))
        .filter(Boolean);
      hit = raycaster.intersectObjects(walls, true)[0] || null;
    }
    if (!hit) return;

    // 2) 최상위 벽 그룹을 찾아 이름 확정 (front/back/left/right)
    const WALL_NAMES = new Set(['front','back','left','right']);
    let root = hit.object;
    while (root && !WALL_NAMES.has(root.name)) root = root.parent;
    let wallName = root?.name || null;

    // 2-1) 그래도 못 찾으면 노멀로 추정(|nx| vs |nz|)
    const normalW = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (!wallName) {
      const ax = Math.abs(normalW.x), az = Math.abs(normalW.z);
      if (az >= ax) wallName = (normalW.z > 0) ? 'front' : 'back';
      else          wallName = (normalW.x > 0) ? 'right' : 'left';
    }

    // 3) 표면으로 약간 띄우기
    const point = hit.point.clone().add(normalW.clone().multiplyScalar(0.05));

    // 4) 경계 클램프
    const box = new THREE.Box3().setFromObject(sel);
    const size = new THREE.Vector3(); box.getSize(size);
    const halfW = ROOM_WIDTH/2, halfH = ROOM_HEIGHT/2, halfD = ROOM_DEPTH/2;
    const hw = size.x/2, hh = size.y/2, hd = size.z/2;

    switch (wallName) {
      case 'front':
      case 'back':
        point.x = THREE.MathUtils.clamp(point.x, -halfW+hw,  halfW-hw);
        point.y = THREE.MathUtils.clamp(point.y, -halfH+hh,  halfH-hh);
        break;
      case 'left':
      case 'right':
        point.z = THREE.MathUtils.clamp(point.z, -halfD+hd,  halfD-hd);
        point.y = THREE.MathUtils.clamp(point.y, -halfH+hh,  halfH-hh);
        break;
    }

    // 5) 최종 적용 + 회전(노멀 정렬)
    sel.position.copy(point);
    const q = new THREE.Quaternion().setFromUnitVectors(forward, normalW.clone().normalize());
    sel.quaternion.slerp(q, 0.35);

    // 6) 메타 갱신(선택)
    sel.userData.wall = wallName;
  }
  // ─────────────────────────────────────────────────────────────

  // -----------------------------
  // 마우스/터치 드래그로 그림 위치 이동
  // -----------------------------
  domElement.addEventListener("pointerdown", (e) => {
    if (anyResizing()) return;
    if (!anyModeActive()) return;

    // 포인터 집계
    activePointers.add(e.pointerId);
    if (primaryPointerId == null) primaryPointerId = e.pointerId;
    multiTouch = activePointers.size >= 2;

    // 터치 브라우저의 기본 제스처 방지 (CSS에 touch-action:none 도 함께 권장)
    if (e.cancelable && e.pointerType !== 'mouse') e.preventDefault();

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
      hasDragTarget = true;
    } else {
      hasDragTarget = false;
    }

    edgeNav.onDragStart();

    try { domElement.setPointerCapture?.(e.pointerId); } catch (_) {}
  }, { passive:false }); // 터치 제스처 제어를 위해 passive:false

  domElement.addEventListener("pointerup", (e) => {
    if (anyResizing()) return;
    if (!anyModeActive() || !dragStartScreen) return;

    // 포인터 집계 업데이트
    activePointers.delete(e.pointerId);
    // 남은 포인터 수를 기준으로 재계산 (버그 픽스: 1개 남아도 true였던 문제)
    multiTouch = activePointers.size >= 2;
    if (activePointers.size === 0) {
      primaryPointerId = null;
    } else if (primaryPointerId === e.pointerId) {
      primaryPointerId = [...activePointers][0];
    }

    // 멀티터치가 유지 중이면 클릭/드롭 판정 제외
    if (multiTouch) {
      try { domElement.releasePointerCapture?.(e.pointerId); } catch (_) {}
      return;
    }

    // 네비 직후 pointerup 억제 — 클릭/드롭 판정 없이 리셋만
    if (suppressNextPointerUp) {
      suppressNextPointerUp = false;
      dragStartScreen = null;
      pointerDownTime = 0;
      isDragging = false;
      setSelectedPainting?.(null);
      hasDragTarget = false; 
      edgeNav.onDragEnd();
      restoreControls(); // 드래그 전 상태로 복귀
      try { domElement.releasePointerCapture?.(e.pointerId); } catch (_) {}
      return;
    }

    const dt = Date.now() - pointerDownTime;
    const dx = e.clientX - dragStartScreen.x;
    const dy = e.clientY - dragStartScreen.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (isDragging) {
      // 드래그 종료 시, 일부 브라우저에서 마지막 move가 누락될 수 있어 한 번 더 스냅
      const sel = getSelectedPainting?.();
      if (sel) {
        const client = getSafeClientXY(e);
        finalizeDropAtClientXY(client, {
          domElement,
          camera, raycaster, scene,
          getCurrentWall,
          ROOM_WIDTH, ROOM_HEIGHT, ROOM_DEPTH
        }, sel);
      }

      wasDragging = true;
      if (getPaintingMode?.()) updatePaintingOrderByPosition();
      // 드래그로 끝났을 때는 추가 동작 없음
    } else {
      wasDragging = false;

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
        // intro 모드 클릭은 별도 처리 없음
      }
    }
    // 리셋
    dragStartScreen = null;
    pointerDownTime = 0;
    isDragging = false;
    setSelectedPainting?.(null);
    hasDragTarget = false;
    edgeNav.onDragEnd();
    restoreControls(); // 드래그 전 상태로 복귀

    try { domElement.releasePointerCapture?.(e.pointerId); } catch (_) {}
  }, { passive:true });

  domElement.addEventListener("pointermove", (e) => {
    if (anyResizing()) return;
    if (!anyModeActive() || !dragStartScreen) return;

    // 최근 좌표를 계속 저장 (안드로이드 pointerup 폴백용)
    lastClientPos.x = e.clientX;
    lastClientPos.y = e.clientY;

    // 멀티터치 중엔 드래그 차단 (핀치/팬은 OrbitControls에게)
    if (multiTouch) return;

    // 터치 스크롤 방지(안전): stage는 CSS touch-action:none 권장
    if (e.cancelable && e.pointerType !== 'mouse') e.preventDefault();

    const dx = e.clientX - dragStartScreen.x;
    const dy = e.clientY - dragStartScreen.y;

    // 기존: !(e.buttons & 1) 때문에 터치가 모두 무시되던 문제 제거
    if (!isDragging && Math.sqrt(dx * dx + dy * dy) > dragThreshold) {
      if (!hasDragTarget) return; // 타깃 없으면 드래그 시작 안 함
      isDragging = true;
      lockControls(); // 드래그 중 OrbitControls 비활성화 (종료 시 원상복구)

      if (getPaintingMode?.()) {
        if (getEditingPainting?.()) {
          endEditingPainting?.(scene);
        }
      } else if (getIntroMode?.()) {
        try { endEditingPainting?.(scene); } catch(_) {}
      }
    }

    // 드래그 중이면 selectedPainting 이동
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
          // ▼ 자식 메쉬까지 포함해 교차 검사 (브라우저별 히트 차이 대응)
          const intersects = raycaster.intersectObject(wallMesh, true);
          if (intersects.length > 0) {
            const point = intersects[0].point.clone();
            const normal = intersects[0].face.normal
              .clone()
              .transformDirection(intersects[0].object.matrixWorld); // <- hit.object 기준

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
            sel.quaternion.slerp(tmpQuat, 0.35);
          }
        }
      }
    }
  }, { passive:false }); // 드래그 중 preventDefault 허용

  // pointercancel: 캡처 해제 + 상태 리셋(안전)
  domElement.addEventListener("pointercancel", (e) => {
    if (!anyModeActive() || !dragStartScreen) return;

    // 드래그 중이었다면 마지막 좌표로 한 번 더 스냅(브라우저 별 cancel 대응)
    if (isDragging) {
      const sel = getSelectedPainting?.();
      if (sel) {
        const client = getSafeClientXY(e);
        finalizeDropAtClientXY(client, {
          domElement,
          camera, raycaster, scene,
          getCurrentWall,
          ROOM_WIDTH, ROOM_HEIGHT, ROOM_DEPTH
        }, sel);
      }
    }

    // 포인터 집계 리셋
    activePointers.delete(e.pointerId);
    multiTouch = activePointers.size >= 2; // 일관성 유지
    if (activePointers.size === 0) {
      primaryPointerId = null;
    }

    suppressNextPointerUp = false;
    dragStartScreen = null;
    pointerDownTime = 0;
    isDragging = false;
    setSelectedPainting?.(null);
    hasDragTarget = false; 
    edgeNav.onDragEnd();
    restoreControls(); // 드래그 전 상태로 복귀

    try { domElement.releasePointerCapture?.(e.pointerId); } catch (_) {}
  }, { passive:true });

  // ...registerPaintingDragHandlers 내부, 기존 리스너들 아래에 추가

  // pointerleave: 캔버스를 벗어나 손을 떼는 안드/삼성인터넷 케이스 보완
  domElement.addEventListener("pointerleave", (e) => {
    if (!isDragging) return;

    // 마지막 좌표로 드롭 한 번 더 스냅 (getSafeClientXY는 이미 위에 정의됨)
    const sel = getSelectedPainting?.();
    if (sel) {
      const client = getSafeClientXY(e);
      finalizeDropAtClientXY(client, {
        domElement,
        camera, raycaster, scene,
        getCurrentWall,
        ROOM_WIDTH, ROOM_HEIGHT, ROOM_DEPTH
      }, sel);

      // 작품설정 모드면 정렬 동기화(PC와 동일한 타이밍 맞춤)
      if (getPaintingMode?.()) updatePaintingOrderByPosition();
    }

    // 리셋 (pointercancel과 동일)
    dragStartScreen = null;
    pointerDownTime = 0;
    isDragging = false;
    setSelectedPainting?.(null);
    hasDragTarget = false;
    edgeNav.onDragEnd();
    restoreControls();
    try { domElement.releasePointerCapture?.(e.pointerId); } catch(_) {}
  }, { passive:true });
}
