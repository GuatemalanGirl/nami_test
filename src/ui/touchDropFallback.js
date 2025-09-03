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
