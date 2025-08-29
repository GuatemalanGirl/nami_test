// interaction/edgeWallNavigator.js
// 드래그 중 포인터가 좌/우 화면 가장자리에 일정 시간 머물면
// 지정된 goLeft()/goRight()를 호출하는 재사용 유틸.
//
// 사용처 예시:
//  const edgeNav = createEdgeWallNavigator({
//    domElement,
//    isActive: () => getPaintingMode(),   // 현재 모드 활성 여부
//    isDragging: () => isDragging,        // 드래그 중?
//    isResizing: () => getIsResizingWithHandle() || getIsResizingPainting(),
//    isMoving: () => false,               // (선택) 카메라/벽 전환 중 여부
//    onBeforeNavigate: (dir) => { /* 드래그 안전종료 등 */ },
//    goLeft:  () => goToLeftWall(camera, controls),
//    goRight: () => goToRightWall(camera, controls),
//    onHintChange: (dir) => { /* 'left'|'right'|null → 힌트 UI 토글 (옵션) */ },
//    edgePct: 0.08, dwellMs: 350, cooldownMs: 600
//  });
//
//  edgeNav.onDragStart(); // pointerdown 시
//  edgeNav.onDragEnd();   // pointerup/cancel 시
//  edgeNav.destroy();     // 핸들러 해제

export function createEdgeWallNavigator({
  domElement,

  // 상태 getter
  isActive,         // () => boolean   (이 모드에서만 동작)
  isDragging,       // () => boolean
  isResizing,       // () => boolean
  isMoving,         // () => boolean (선택; 카메라/벽 전환 애니메이션 중)

  // 네비 직전 정리 훅: 드래그 종료/선택 해제/포인터업 억제 등
  onBeforeNavigate, // (dir:'left'|'right') => void

  // 실제 벽 전환 실행자
  goLeft,           // () => void
  goRight,          // () => void

  // (선택) 가장자리 힌트 UI 토글 콜백
  onHintChange,     // (dir:'left'|'right'|null) => void

  // 파라미터
  edgePct = 0.08,   // 좌/우 8% 영역에서만 감지
  dwellMs = 350,    // 가장자리 체류 시간(ms)
  cooldownMs = 600  // 재트리거 쿨다운(ms)
}) {
  let destroyed = false;
  let pendingDir = null;   // 'left' | 'right' | null
  let dwellTimer = null;
  let lastNavAt = 0;

  function emitHint(dir) {
    if (typeof onHintChange === 'function') onHintChange(dir);
  }

  function clearTimer() {
    if (dwellTimer) {
      clearTimeout(dwellTimer);
      dwellTimer = null;
    }
    pendingDir = null;
    emitHint(null);
  }

  function schedule(dir) {
    if (pendingDir === dir) return;
    clearTimer();
    pendingDir = dir;
    emitHint(dir);

    if (!dir) return;
    if (!isActive?.()) { clearTimer(); return; }
    if (!isDragging?.()) { clearTimer(); return; }
    if (isResizing?.()) { clearTimer(); return; }
    if (isMoving?.()) { clearTimer(); return; }

    dwellTimer = setTimeout(() => {
      dwellTimer = null;

      const now = performance.now();
      if (now - lastNavAt < cooldownMs) { clearTimer(); return; }

      try { onBeforeNavigate?.(dir); } catch (_) {}

      if (dir === 'left') { try { goLeft?.(); } catch (_) {} }
      else                { try { goRight?.(); } catch (_) {} }

      lastNavAt = performance.now();
      clearTimer();
    }, dwellMs);
  }

  function onPointerMove(e) {
    if (destroyed) return;

    // 빠른 가드
    if (!isActive?.() || !isDragging?.() || isResizing?.() || isMoving?.()) {
      clearTimer();
      return;
    }

    const rect = domElement.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;

    if (x <= edgePct) schedule('left');
    else if (x >= 1 - edgePct) schedule('right');
    else clearTimer();
  }

  function onPointerLeave() { clearTimer(); }
  function onPointerCancel() { clearTimer(); }

  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerleave', onPointerLeave);
  domElement.addEventListener('pointercancel', onPointerCancel);

  return {
    onDragStart() { clearTimer(); },
    onDragEnd()   { clearTimer(); },
    destroy() {
      destroyed = true;
      clearTimer();
      domElement.removeEventListener('pointermove', onPointerMove);
      domElement.removeEventListener('pointerleave', onPointerLeave);
      domElement.removeEventListener('pointercancel', onPointerCancel);
    }
  };
}