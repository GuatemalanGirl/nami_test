// interaction/pointerManager.js

const DRAG_THRESHOLD = 8;      // px: 탭/드래그 구분
const DOUBLE_TAP_MS = 300;     // 더블탭 간격
const DOUBLE_TAP_DIST = 12;    // px
const pointers = new Map();
let primaryId = null;
let dragging = false;
let lastTap = { t: 0, x: 0, y: 0 };

function dist(a, b){ const dx=a.x-b.x, dy=a.y-b.y; return Math.hypot(dx, dy); }

export function initPointerManager(stageEl, handlers){
  const H = Object.assign({
    onTap(){}, onDoubleTap(){},
    onDragStart(){}, onDragMove(){}, onDragEnd(){},
    onPinchStart(){}, onPinch(){}, onPinchEnd(){},
  }, handlers);

  // 내부 상태
  let pinch = null; // {d0, c0:{x,y}}

  function getTwo(){
    const arr = [...pointers.values()];
    return arr.length >= 2 ? arr.slice(0,2) : null;
  }

  function centroid(a,b){ return { x:(a.x+b.x)/2, y:(a.y+b.y)/2 }; }

  function onDown(e){
    // stage 제스처는 우리가 처리
    if (e.cancelable) e.preventDefault();
    stageEl.setPointerCapture?.(e.pointerId);

    const p = { id:e.pointerId, x:e.clientX, y:e.clientY, sx:e.clientX, sy:e.clientY, t:performance.now(), type:e.pointerType };
    pointers.set(e.pointerId, p);
    if (primaryId == null) primaryId = e.pointerId;

    // 두 손가락 시작 → pinch start
    const two = getTwo();
    if (two && !pinch){
      const [a,b] = two;
      pinch = {
        d0: dist(a,b),
        c0: centroid(a,b),
      };
      dragging = false; // 드래그 중이면 종료
      H.onPinchStart?.(pinch.c0);
    }
  }

  function onMove(e){
    const p = pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;

    // 핀치 중
    if (pinch){
      const [a,b] = getTwo() || [];
      if (!a || !b) return;
      const d = dist(a,b);
      const c = centroid(a,b);
      const scale = d / pinch.d0;
      H.onPinch?.({ scale, center:c });
      return;
    }

    // 단일 포인터 드래그 판단
    if (e.pointerId === primaryId && !dragging){
      const moved = dist({x:p.sx,y:p.sy}, p);
      if (moved > DRAG_THRESHOLD){
        dragging = true;
        H.onDragStart?.({ x:p.sx, y:p.sy, pointerType:p.type });
      }
    }
    if (dragging && e.pointerId === primaryId){
      H.onDragMove?.({ x:p.x, y:p.y, dx:p.x-p.sx, dy:p.y-p.sy, pointerType:p.type });
    }
  }

  function finishPointer(e){
    const p = pointers.get(e.pointerId);
    if (!p) return;

    // 핀치 종료
    if (pinch){
      const two = getTwo();
      if (!two || two.length < 2){
        H.onPinchEnd?.();
        pinch = null;
      }
    } else if (e.pointerId === primaryId){
      // 드래그 끝 or 탭/더블탭
      if (dragging){
        dragging = false;
        H.onDragEnd?.({ x:p.x, y:p.y, pointerType:p.type });
      } else {
        const now = performance.now();
        const isDouble = (now - lastTap.t) < DOUBLE_TAP_MS &&
                         dist({x:lastTap.x,y:lastTap.y}, p) < DOUBLE_TAP_DIST;
        if (isDouble){
          H.onDoubleTap?.({ x:p.x, y:p.y, pointerType:p.type });
          lastTap.t = 0; // 소진
        } else {
          H.onTap?.({ x:p.x, y:p.y, pointerType:p.type });
          lastTap = { t: now, x: p.x, y: p.y };
        }
      }
    }

    pointers.delete(e.pointerId);
    if (pointers.size === 0){
      primaryId = null;
      dragging = false;
    } else if (primaryId === e.pointerId){
      primaryId = [...pointers.keys()][0];
    }
  }

  stageEl.addEventListener('pointerdown', onDown, { passive:false });
  stageEl.addEventListener('pointermove', onMove, { passive:false });
  stageEl.addEventListener('pointerup', finishPointer, { passive:true });
  stageEl.addEventListener('pointercancel', finishPointer, { passive:true });

  return () => {
    stageEl.removeEventListener('pointerdown', onDown);
    stageEl.removeEventListener('pointermove', onMove);
    stageEl.removeEventListener('pointerup', finishPointer);
    stageEl.removeEventListener('pointercancel', finishPointer);
  };
}