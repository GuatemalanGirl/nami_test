// interaction/artwallDragHandlers.js
import * as THREE from 'three';
// -------------------------------------------------------------
// [ARTWALL] 아트월 드래그, 클릭, 편집, 이동 이벤트 핸들러 모듈
// - pointerdown: 아트월 선택/드래그 시작
// - pointermove: 아트월 드래그 이동
// - pointerup  : 아트월 편집/드래그 종료
// -------------------------------------------------------------

export function registerArtwallDragHandlers(domElement, {
  getArtwallMode,
  getCurrentWall,
  getArtwalls,
  detectWall,
  getEditingArtwall,
  startEditingArtwall,
  endEditingArtwall,
  ROOM_WIDTH,
  ROOM_HEIGHT,
  ROOM_DEPTH,
  camera,
  raycaster,
  scene,
  editingButtonsDiv
}) {
  // 아트월 드래그/선택 상태 변수
  let pointerDownArtTime = 0; // pointerdown 시간 기록
  let dragStartArt = null; // pointerdown에서 마우스 좌표 기록
  let isDraggingArt = false; // 드래그 중 여부
  let selectedArtwall = null; // 현재 마우스로 선택한 아트월 Mesh
  const dragThreshold = 7; // 픽셀
  const clickTimeThreshold = 200; // ms

  // 1) pointerdown: 아트월 선택/편집 모드 진입
  domElement.addEventListener("pointerdown", (e) => {
    if (!getArtwallMode()) return;
    pointerDownArtTime = Date.now();
    dragStartArt = { x: e.clientX, y: e.clientY };
    isDraggingArt = false;
    selectedArtwall = null;

    const currentWall = getCurrentWall();

    // Raycast로 현재 벽면에서 클릭한 아트월 찾기
    const rect = domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);
    const wallArts = getArtwalls().filter((m) => detectWall(m) === currentWall);
    const hit = raycaster.intersectObjects(wallArts)[0];
    if (hit) selectedArtwall = hit.object;

    // 이미 다른 아트월 편집중이면 편집 종료
    const editingArtwall = getEditingArtwall();
    if (editingArtwall && editingArtwall !== selectedArtwall) {
      endEditingArtwall(scene, editingButtonsDiv);
    }
  });

  // 2) pointermove: 드래그로 이동
  domElement.addEventListener("pointermove", (e) => {
    if (!getArtwallMode() || !(e.buttons & 1) || !dragStartArt) return;

    const dx = e.clientX - dragStartArt.x;
    const dy = e.clientY - dragStartArt.y;
    if (!isDraggingArt && Math.hypot(dx, dy) > dragThreshold) {
      isDraggingArt = true;
      endEditingArtwall(scene, editingButtonsDiv); // 드래그 시작 → 편집 패널 숨김
    }
    if (!isDraggingArt || !selectedArtwall) return;

    const currentWall = getCurrentWall();

    // 벽면에서 마우스 위치에 따라 아트월 이동
    const rect = domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);
    const wallMesh = scene.getObjectByName(currentWall);
    const hit = wallMesh && raycaster.intersectObject(wallMesh)[0];
    if (!hit) return;

    const p = hit.point.clone();
    const n = hit.face.normal.clone().transformDirection(wallMesh.matrixWorld);
    p.add(n.multiplyScalar(0.05)); // 벽에서 살짝 띄우기

    // 벽 경계 내로 클램프
    const halfW = ROOM_WIDTH / 2,
      halfH = ROOM_HEIGHT / 2,
      halfD = ROOM_DEPTH / 2;
    const sBox = new THREE.Box3().setFromObject(selectedArtwall);
    const size = new THREE.Vector3();
    sBox.getSize(size);
    const hw = size.x / 2,
      hh = size.y / 2,
      hd = size.z / 2;

    switch (currentWall) {
      case "front":
      case "back":
        p.x = THREE.MathUtils.clamp(p.x, -halfW + hw, halfW - hw);
        p.y = THREE.MathUtils.clamp(p.y, -halfH + hh, halfH - hh);
        break;
      case "left":
      case "right":
        p.z = THREE.MathUtils.clamp(p.z, -halfD + hd, halfD - hd);
        p.y = THREE.MathUtils.clamp(p.y, -halfH + hh, halfH - hh);
        break;
    }
    selectedArtwall.position.copy(p);
  });

  // 3) pointerup: 클릭(편집) vs 드래그(이동) 판정
  domElement.addEventListener("pointerup", (e) => {
    if (!getArtwallMode() || !dragStartArt) return;

    const dt = Date.now() - pointerDownArtTime;
    const dist = Math.hypot(
      e.clientX - dragStartArt.x,
      e.clientY - dragStartArt.y
    );
    const clicked = dt < clickTimeThreshold && dist < dragThreshold;

    if (!isDraggingArt && clicked && selectedArtwall) {
      startEditingArtwall(selectedArtwall, scene, editingButtonsDiv); // 클릭시 편집 진입(삭제 버튼 생성)
    }
    if (!selectedArtwall || (clicked && !selectedArtwall)) {
      endEditingArtwall(scene, editingButtonsDiv);
    }

    // 리셋
    dragStartArt = null;
    isDraggingArt = false;
    selectedArtwall = null;
  });
}
