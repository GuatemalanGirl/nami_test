// src/ui/touchDropFallback.js

export const isCoarsePointer = () =>
  (window.matchMedia && window.matchMedia("(pointer:coarse)").matches) ||
  ("ontouchstart" in window);

export function getCanvasElement() {
  return window.__galleryCanvas || document.querySelector("canvas");
}

// 좌표가 캔버스 내부인지 판정
function clampToCanvas(x, y, canvas) {
  const r = canvas.getBoundingClientRect();
  const cx = Math.min(Math.max(x, r.left + 1), r.right - 1);
  const cy = Math.min(Math.max(y, r.top + 1),  r.bottom - 1);
  return { x: cx, y: cy, inside: x >= r.left && x <= r.right && y >= r.top && y <= r.bottom };
}

// 터치 → 캔버스로 synthetic drop 디스패치
// kind: 'painting' | 'artwall' | 'intro-type'
let __lastSentAt = 0;
export function dispatchSyntheticDrop(kind, payload, clientX, clientY) {
  const now = performance.now();
  // ① touchend→click 중복 방지 (300ms 내 중복 무시)
  if (now - __lastSentAt < 300) return;
  __lastSentAt = now;

  const canvas = getCanvasElement();
  if (!canvas) return;

  // ② 좌표 보정(오프캔버스면 가장 가까운 내부로 스냅)
  const { x, y } = clampToCanvas(clientX, clientY, canvas);

  const evt = new Event("drop", { bubbles: true, cancelable: true });
  // 드롭 리스너가 쓰는 필드만 주입
  evt.clientX = x;
  evt.clientY = y;
  evt.dataTransfer = {
    getData: (type) => {
      if (type === "painting" && kind === "painting") return JSON.stringify(payload);
      if (type === "artwall"  && kind === "artwall")  return JSON.stringify(payload);
      if (type === "intro-type" && kind === "intro-type") return String(payload);
      return "";
    }
  };

  canvas.dispatchEvent(evt);
}

/* ─────────────────────────────────────────────────────────
 * ★ 터치 전용 폴백 DnD (pointer 기반) + 고스트 프리뷰
 * - Android 등에서 네이티브 DnD 미동작 시 UX 보완
 * - 임계치(threshold) 초과 시 고스트 생성 → 포인터 따라다님
 * - pointerup 시 dispatchSyntheticDrop 호출
 * - payload는 객체 또는 함수(지연 평가) 모두 지원
 * ───────────────────────────────────────────────────────── */
export function enableTouchDragSource(
  el,
  kind, // 'painting' | 'artwall' | 'intro-type'
  payloadOrGetter, // object or () => object/string
  { ghostSize = 72, threshold = 6 } = {}
) {
  let dragging = false, started = false, sx = 0, sy = 0, ghost = null;

  const getPayload = () =>
    typeof payloadOrGetter === "function" ? payloadOrGetter() : payloadOrGetter;

  const makeGhost = () => {
    const g = document.createElement("div");
    Object.assign(g.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: `${ghostSize}px`,
      height: `${ghostSize}px`,
      borderRadius: "10px",
      boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
      pointerEvents: "none",
      zIndex: 999999,
      opacity: "0.95",
      backgroundSize: "cover",
      backgroundPosition: "center",
      transform: "translate(-50%, -50%)",
      willChange: "transform",
      backdropFilter: "saturate(1.1) contrast(1.05)"
    });
    if (el instanceof HTMLImageElement) {
      g.style.backgroundImage = `url(${el.currentSrc || el.src})`;
      // 이미지 비율이 긴 경우 보이도록 최소 배경색
      g.style.backgroundColor = "rgba(255,255,255,0.85)";
    } else {
      // intro 박스 등의 경우 텍스트 라벨을 간단히 복사
      g.style.display = "grid";
      g.style.placeItems = "center";
      g.style.background = getComputedStyle(el).background || "rgba(255,255,255,0.9)";
      g.style.color = "#000";
      g.style.fontSize = "11px";
      g.style.padding = "6px";
      g.style.textAlign = "center";
      g.textContent = (el.textContent || "").replace(/\s+/g, " ").trim();
    }
    document.body.appendChild(g);
    return g;
  };

  const onDown = (e) => {
    if (e.pointerType === "mouse") return; // 마우스는 네이티브 DnD 사용
    dragging = true;
    started = false;
    sx = e.clientX; sy = e.clientY;
    el.setPointerCapture?.(e.pointerId);
  };

  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!started && Math.hypot(dx, dy) > threshold) {
      started = true;
      ghost = makeGhost();
      el.classList.add("dragging");
    }
    if (started && ghost) {
      if (e.cancelable) e.preventDefault(); // 스크롤 억제
      ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    }
  };

  const finish = (e) => {
    if (!dragging) return;
    dragging = false;
    el.releasePointerCapture?.(e.pointerId);
    if (ghost) { ghost.remove(); ghost = null; }
    if (started) {
      const payload = getPayload();
      dispatchSyntheticDrop(kind, payload, e.clientX, e.clientY);
    }
    el.classList.remove("dragging");
  };

  el.addEventListener("pointerdown", onDown, { passive: true });
  el.addEventListener("pointermove", onMove, { passive: false });
  el.addEventListener("pointerup", finish, { passive: true });
  el.addEventListener("pointercancel", finish, { passive: true });
}