// ui/artwallGrid.js

import {
  getArtwallsByPage,
  getArtwallPage,
  setArtwallPage,
  getTotalArtwallPages,
  getArtwallThumbUrl,
  // ▼ 추가: 반응형 페이지 크기 제어
  getArtwallPageSize,
  setArtwallPageSize,
} from "../data/artwall.js";
import { isCoarsePointer, dispatchSyntheticDrop } from "./touchDropFallback.js"; // ★ 터치 폴백 유틸

/* =========================================
   추가: 반응형(모바일/데스크톱) 페이지 크기 설정
   - 데스크톱: 9개(3×3)
   - 모바일(≤1180px): 4개(4×1)
   ========================================= */

/**
 * 뷰포트에 맞춰 페이지 크기(9↔4) 적용 + 리렌더
 * - 최초 1회 호출 후, 미디어쿼리 변화에도 자동 반영
 */
export function initArtwallGridResponsive() {
  const mq = window.matchMedia("(max-width: 1180px)");

  const apply = () => {
    const nextSize = mq.matches ? 4 : 9;
    if (typeof getArtwallPageSize === "function" && getArtwallPageSize() === nextSize) {
      populateArtwallGrid();
      updateArtwallPageButtons();
      return;
    }
    setArtwallPageSize(nextSize);
    setArtwallPage(0);           // 안전하게 첫 페이지로
    populateArtwallGrid();
    updateArtwallPageButtons();
  };

  apply();
  // 미디어쿼리 변화 대응
  if (mq.addEventListener) mq.addEventListener("change", apply);
  else if (mq.addListener) mq.addListener(apply); // 구형 폴백
}

// ───────────────────────────────────────────────────────────────
// ★ 포인터 기반 드래그 폴백 (고스트 미리보기 포함: 작품 그리드와 동일 전략)

let _ghostEl = null;
let _dragging = false;
let _dragStartX = 0, _dragStartY = 0;
const _DRAG_THRESHOLD = 4; // 픽셀 (클릭과 드래그 구분)

// ★ 고스트 앵커/크기 상태 (커서 중앙 정렬)
const GHOST_ANCHOR = 'center'; // 'center' | 'grip'
let _ghostW = 56, _ghostH = 56, _anchorX = 0, _anchorY = 0;

// ★ 드래그 고스트 DOM 생성 (커서 '중앙' 또는 grip 지점 기준)
function makeGhost(nodeForSize, anchorMode = GHOST_ANCHOR, startX = 0, startY = 0) {
  const rect = nodeForSize?.getBoundingClientRect?.() || { width:56, height:56, left:startX, top:startY };
  _ghostW = Math.max(32, rect.width);
  _ghostH = Math.max(32, rect.height);

  // center면 절반, grip이면 눌렀던 지점
  if (anchorMode === 'center') {
    _anchorX = _ghostW / 2;
    _anchorY = _ghostH / 2;
  } else {
    _anchorX = startX - rect.left;
    _anchorY = startY - rect.top;
  }

  const el = document.createElement('div');
  el.className = 'drag-ghost';
  el.style.position = 'fixed';
  el.style.left = '0';
  el.style.top = '0';
  el.style.width = _ghostW + 'px';
  el.style.height = _ghostH + 'px';
  el.style.pointerEvents = 'none';
  el.style.opacity = '0.9';
  el.style.transform = 'translate(-9999px,-9999px)';
  el.style.willChange = 'transform';
  document.body.appendChild(el);
  return el;
}

// ★ 고스트를 커서 기준(앵커 보정)으로 정확히 위치
function posGhost(x, y) {
  if (!_ghostEl) return;
  _ghostEl.style.transform = `translate(${x - _anchorX}px, ${y - _anchorY}px)`;
}

function setDraggingUI(on) {
  document.body.classList.toggle('is-dragging', !!on);
  _dragging = !!on;
}

// ★ 포인터 드래그 시작(폴백): pointerdown에서 호출
function startPointerDragFromGrid(eStart, wall, previewImg) {
  if (!eStart.isPrimary) return;
  if (eStart.cancelable) eStart.preventDefault();
  try { eStart.target.setPointerCapture?.(eStart.pointerId); } catch {}

  _dragStartX = eStart.clientX;
  _dragStartY = eStart.clientY;
  let moved = false;

  const move = (ev) => {
    if (ev.cancelable) ev.preventDefault();
    const dx = ev.clientX - _dragStartX;
    const dy = ev.clientY - _dragStartY;
    if (!moved && (Math.abs(dx) > _DRAG_THRESHOLD || Math.abs(dy) > _DRAG_THRESHOLD)) {
      setDraggingUI(true);
      _ghostEl = makeGhost(previewImg, GHOST_ANCHOR, _dragStartX, _dragStartY); // ★
      posGhost(ev.clientX, ev.clientY); // ★ 첫 위치 즉시 반영
    }
    if (moved) posGhost(ev.clientX, ev.clientY);
    moved = moved || (Math.abs(dx) > _DRAG_THRESHOLD || Math.abs(dy) > _DRAG_THRESHOLD);
  };

  const up = (ev) => {
    try { eStart.target.releasePointerCapture?.(eStart.pointerId); } catch {}
    window.removeEventListener('pointermove', move, { passive:false });
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);

    const x = ev.clientX, y = ev.clientY;

    if (_ghostEl) { _ghostEl.remove(); _ghostEl = null; }
    const wasDragging = _dragging;
    setDraggingUI(false);

    if (wasDragging) {
      try {
        dispatchSyntheticDrop('artwall', wall, x, y);
      } catch {
        window.dispatchEvent(new CustomEvent('touchdrop', {
          detail: { kind:'artwall', payload: wall, clientX:x, clientY:y }
        }));
      }
    } else {
      // 클릭으로 취급하고 싶으면 여기서 처리
    }
  };

  window.addEventListener('pointermove', move, { passive:false });
  window.addEventListener('pointerup', up, { once:true });
  window.addEventListener('pointercancel', up, { once:true });
}

// ───────────────────────────────────────────────────────────────

export function populateArtwallGrid() {
  const grid = document.getElementById("artwallGrid");
  if (!grid) return;

  grid.innerHTML = "";
  const page = getArtwallPage();
  const itemsPerPage = (typeof getArtwallPageSize === "function") ? getArtwallPageSize() : 9;
  const walls = getArtwallsByPage(page);
  const coarse = isCoarsePointer(); // 포인터 특성 감지

  walls.forEach((wall, index) => {
    // ★ IMG를 직접 드래그 소스로 쓰지 않고, 래퍼를 드래그 소스로 사용
    const wrap = document.createElement('div');
    wrap.className = 'artwall-thumb';      // (스타일 훅)
    wrap.tabIndex = 0;
    wrap.draggable = !coarse;              // coarse(모바일/태블릿)에서는 네이티브 DnD 비활성화
    wrap.style.touchAction = 'none';       // ★ 제스처/스크롤 간섭 최소화
    wrap.style.userSelect = 'none';        // ★ 선택 방지

    const img = document.createElement("img");
    // 가벼운 최적화
    img.loading = "lazy";
    img.decoding = "async";

    img.src = getArtwallThumbUrl(wall.filename);
    img.alt = wall.title || wall.filename || "artwall";
    img.draggable = false;                 // ★ IMG 네이티브 드래그 억제
    img.classList.add("thumbnail");
    img.style.touchAction = "manipulation"; // 터치에서 스크롤 과민도 완화

    // 페이지/인덱스 데이터셋(선택)
    img.dataset.page = String(page);
    img.dataset.index = String(page * itemsPerPage + index);

    wrap.appendChild(img);

    if (!coarse) {
      // ── 데스크톱: 네이티브 Drag & Drop (래퍼 기준)
      wrap.addEventListener("dragstart", (e) => {
        try {
          e.dataTransfer.effectAllowed = "copy";

          // ★ 다중 포맷으로 안전하게 setData (크롬북/환경 호환 ↑)
          const raw = JSON.stringify(wall);
          e.dataTransfer.setData("artwall", raw); // 앱 전용 키
          e.dataTransfer.setData(
            "application/json",
            JSON.stringify({ kind: "artwall", payload: wall })
          );
          e.dataTransfer.setData(
            "text/plain",
            JSON.stringify({ kind: "artwall", payload: wall })
          );

          // ★ 드래그 고스트: '중앙' 기준으로 setDragImage
          if (typeof e.dataTransfer.setDragImage === "function") {
            const rect = img.getBoundingClientRect();
            const offX = rect.width / 2;
            const offY = rect.height / 2;
            e.dataTransfer.setDragImage(img, offX, offY);
          }
        } catch (_) {
          // 구형/특수 환경에서 dataTransfer 접근 불가 → 무시
        }
        wrap.classList.add("dragging");
        document.body.classList.add('is-dragging'); // ★ 패널 오버레이 차단용
      });

      const cleanup = () => {
        wrap.classList.remove("dragging");
        document.body.classList.remove('is-dragging');
      };
      wrap.addEventListener("dragend", cleanup);
      wrap.addEventListener("drop", cleanup);

      // ★ 보강: 네이티브 DnD가 막히는 환경(크롬북 변수) 대비 포인터 폴백도 함께 장착
      wrap.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        startPointerDragFromGrid(e, wall, img);
      }, { passive:false });

    } else {
      // ── Android 등 터치 환경: 포인터 폴백 (가짜 drop 캔버스로 디스패치)
      wrap.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        startPointerDragFromGrid(e, wall, img);
      }, { passive:false });
    }

    // iOS 등 컨텍스트 메뉴 억제(드래그 목적일 때 UX 향상)
    wrap.addEventListener(
      "contextmenu",
      (e) => {
        if (e.cancelable) e.preventDefault();
      },
      { passive: false }
    );

    grid.appendChild(wrap);
  });

  updateArtwallPageButtons();
}

/** 추가: 이미지/커스텀 요소용 비활성 처리 유틸 */
function setNavDisabled(el, disabled) {
  if (!el) return;
  el.setAttribute("aria-disabled", disabled ? "true" : "false");
  el.classList.toggle("is-disabled", !!disabled);
  el.style.pointerEvents = disabled ? "none" : "";
  el.style.opacity = disabled ? "0.35" : "";
}

function updateArtwallPageButtons() {
  const prev = document.getElementById("prevArtPageBtn");
  const next = document.getElementById("nextArtPageBtn");
  const current = getArtwallPage();
  const maxPage = getTotalArtwallPages() - 1;

  // 버튼 요소가 <img>여도 비활성화 처리되도록 유틸 적용
  setNavDisabled(prev, current === 0);
  setNavDisabled(next, current >= maxPage);
}

export function setupArtwallPagination() {
  const prev = document.getElementById("prevArtPageBtn");
  const next = document.getElementById("nextArtPageBtn");

  if (prev) {
    prev.addEventListener("click", () => {
      if (prev.getAttribute("aria-disabled") === "true") return; // 안전 가드
      const page = getArtwallPage();
      if (page > 0) {
        setArtwallPage(page - 1);
        populateArtwallGrid();
      }
    });
  }

  if (next) {
    next.addEventListener("click", () => {
      if (next.getAttribute("aria-disabled") === "true") return; // 안전 가드
      const page = getArtwallPage();
      const maxPage = getTotalArtwallPages() - 1;
      if (page < maxPage) {
        setArtwallPage(page + 1);
        populateArtwallGrid();
      }
    });
  }
}
