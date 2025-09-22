// ui/paintingGrid.js

import {
  getPage, setPage,
  getPaintingsByPage, getTotalPaintingPages, getPaintingThumbUrl,
  // 추가: 페이지당 개수 동적 제어
  getPaintingPageSize, setPaintingPageSize
} from "../data/painting.js";
import { isCoarsePointer, dispatchSyntheticDrop } from "./touchDropFallback.js";

/* =========================================
   추가: 반응형(모바일/데스크톱) 페이지 크기 설정
   - 데스크톱: 9개(3×3)
   - 모바일(≤1180px): 4개(4×1)
   ========================================= */

/**
 * 뷰포트에 맞춰 페이지 크기(9↔4) 적용 + 리렌더
 * - 최초 1회 호출 후, 미디어쿼리 변화에도 자동 반영
 */
export function initPaintingGridResponsive() {
  // 가로(1180px) 기준 확장
  const mq = window.matchMedia("(max-width: 1180px)");

  const apply = () => {
    const nextSize = mq.matches ? 4 : 9;
    if (getPaintingPageSize && getPaintingPageSize() === nextSize) {
      populatePaintingGrid();
      updatePageButtons();
      return;
    }
    setPaintingPageSize(nextSize);  // 페이지당 개수 변경
    setPage(0);                     // 안전하게 첫 페이지로
    populatePaintingGrid();
    updatePageButtons();
  };

  apply();
  // 미디어쿼리 변화 대응
  if (mq.addEventListener) mq.addEventListener("change", apply);
  else if (mq.addListener) mq.addListener(apply); // 구형 폴백
}

// ───────────────────────────────────────────────────────────────
// ★ 포인터 기반 드래그 폴백 (고스트 미리보기 포함)

let _ghostEl = null;
let _dragging = false;
let _dragStartX = 0, _dragStartY = 0;
const _DRAG_THRESHOLD = 4; // 픽셀 (클릭과 드래그 구분)

// ★ 추가: 고스트 앵커/크기 상태 (커서 중앙 정렬용)
const GHOST_ANCHOR = 'center'; // 'center' | 'grip'
let _ghostW = 56, _ghostH = 56, _anchorX = 0, _anchorY = 0;

// ★ 드래그 고스트 DOM 생성 (커서 '중앙' 또는 grip 지점 기준)
function makeGhost(nodeForSize, anchorMode = GHOST_ANCHOR, startX = 0, startY = 0) {
  const rect = nodeForSize?.getBoundingClientRect?.() || { width:56, height:56, left:startX, top:startY };
  _ghostW = Math.max(32, rect.width);
  _ghostH = Math.max(32, rect.height);

  // 앵커 계산: center면 절반, grip이면 눌렀던 지점
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
  // 필요하면 썸네일 백그라운드 프리뷰를 넣을 수 있음
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
function startPointerDragFromGrid(eStart, painting, previewImg) {
  if (!eStart.isPrimary) return;
  // 스크롤 제스처로 흘러가지 않게
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
      // 드래그로 확정되는 순간
      setDraggingUI(true);
      // 고스트 생성 (앵커: 중앙) + 첫 위치 즉시 반영
      _ghostEl = makeGhost(previewImg, GHOST_ANCHOR, _dragStartX, _dragStartY); // ★
      posGhost(ev.clientX, ev.clientY); // ★
    }
    if (moved) {
      posGhost(ev.clientX, ev.clientY);
    }
    moved = moved || (Math.abs(dx) > _DRAG_THRESHOLD || Math.abs(dy) > _DRAG_THRESHOLD);
  };

  const up = (ev) => {
    try { eStart.target.releasePointerCapture?.(eStart.pointerId); } catch {}
    window.removeEventListener('pointermove', move, { passive:false });
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);

    const x = ev.clientX, y = ev.clientY;

    // 고스트 정리
    if (_ghostEl) { _ghostEl.remove(); _ghostEl = null; }
    const wasDragging = _dragging;
    setDraggingUI(false);

    // 실제 drop 디스패치 (드래그로 인정될 때만)
    if (wasDragging) {
      try {
        // touchDropFallback 경유
        dispatchSyntheticDrop('painting', painting, x, y);
      } catch {
        // 유틸 실패 시 직접 합성 이벤트 전송
        window.dispatchEvent(new CustomEvent('touchdrop', {
          detail: { kind:'painting', payload: painting, clientX:x, clientY:y }
        }));
      }
    } else {
      // moved 가 threshold 미만이면 클릭으로 간주 → 필요시 클릭 동작 넣기
    }
  };

  window.addEventListener('pointermove', move, { passive:false });
  window.addEventListener('pointerup', up, { once:true });
  window.addEventListener('pointercancel', up, { once:true });
}

// ───────────────────────────────────────────────────────────────

// 썸네일 그리드 생성 + 이벤트 등록
export function populatePaintingGrid() {
  const grid = document.getElementById("paintingGrid");
  if (!grid) return;

  grid.innerHTML = ""; // 기존 내용 초기화

  const page = getPage(); // 현재 페이지(0-based)
  // 변경: 하드코딩 9 → 동적 페이지 크기 사용
  const itemsPerPage = (typeof getPaintingPageSize === "function")
    ? getPaintingPageSize()
    : 9;

  const currentItems = getPaintingsByPage(); // 현재 페이지 아이템 목록
  const coarse = isCoarsePointer();

  currentItems.forEach((painting, index) => {
    const globalIndex = page * itemsPerPage + index;

    // ★ IMG를 직접 드래그 소스로 쓰지 않고, 래퍼를 드래그 소스로 사용
    const wrap = document.createElement("div");
    wrap.className = "painting-thumb";        // (스타일 훅)
    wrap.tabIndex = 0;
    wrap.draggable = !coarse;                 // coarse면 네이티브 DnD 끔
    wrap.dataset.index = String(globalIndex);
    wrap.style.touchAction = "none";          // ★ 제스처/스크롤 간섭 최소화
    wrap.style.userSelect = "none";           // ★ 선택 방지

    const thumb = document.createElement("img");
    thumb.loading = "lazy";
    thumb.src = getPaintingThumbUrl(painting.filename);
    thumb.alt = painting.title || painting.filename || "painting";
    thumb.classList.add("thumbnail");
    thumb.draggable = false;                  // ★ IMG 네이티브 드래그 억제
    thumb.style.touchAction = "manipulation";

    wrap.appendChild(thumb);

    if (!coarse) {
      // 데스크톱: 네이티브 DnD (래퍼 기준)
      wrap.addEventListener("dragstart", (e) => {
        try {
          e.dataTransfer.effectAllowed = "copy";

          // ★ 다중 포맷으로 안전하게 setData (크롬북/환경 호환 ↑)
          const raw = JSON.stringify(painting);
          e.dataTransfer.setData("painting", raw); // 앱 전용 키
          e.dataTransfer.setData(
            "application/json",
            JSON.stringify({ kind: "painting", payload: painting })
          );
          e.dataTransfer.setData(
            "text/plain",
            JSON.stringify({ kind: "painting", payload: painting })
          );

          // ★ 드래그 고스트: '중앙' 기준으로 setDragImage
          if (typeof e.dataTransfer.setDragImage === "function") {
            const rect = thumb.getBoundingClientRect();        // ★
            const offX = rect.width / 2;                       // ★ 중앙
            const offY = rect.height / 2;                      // ★ 중앙
            e.dataTransfer.setDragImage(thumb, offX, offY);    // ★
          }
        } catch {}
        wrap.classList.add("dragging");
        document.body.classList.add("is-dragging"); // ★ 패널 오버레이 차단용
      });

      const cleanup = () => {
        wrap.classList.remove("dragging");
        document.body.classList.remove("is-dragging");
      };
      wrap.addEventListener("dragend", cleanup);
      wrap.addEventListener("drop", cleanup);

      // ★ 보강: 네이티브 DnD가 먹히지 않는 환경(크롬북 변수) 대비, 포인터 폴백도 함께 장착
      wrap.addEventListener("pointerdown", (e) => {
        // 마우스라도 OS/브라우저 정책으로 dragstart가 막히는 케이스가 있어 대비
        if (e.button !== 0) return; // 좌클릭만
        // dragstart가 정상 동작했다면 이 경로는 up 전에 취소될 수 있음(문제 없음)
        startPointerDragFromGrid(e, painting, thumb);
      }, { passive:false });

    } else {
      // 모바일/태블릿(Android 등): 포인터 폴백 (드래그 미리보기 포함)
      wrap.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        startPointerDragFromGrid(e, painting, thumb);
      }, { passive:false });
    }

    // iOS 컨텍스트 메뉴 억제
    wrap.addEventListener("contextmenu", (e) => {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    grid.appendChild(wrap);
  });

  updatePageButtons();
}

/** 추가: 이미지/커스텀 요소용 비활성 처리 유틸 */
function setNavDisabled(el, disabled) {
  if (!el) return;
  el.setAttribute("aria-disabled", disabled ? "true" : "false");
  el.classList.toggle("is-disabled", !!disabled);
  el.style.pointerEvents = disabled ? "none" : "";
  el.style.opacity = disabled ? "0.35" : "";
}

function updatePageButtons() {
  const prev = document.getElementById("prevPageBtn");
  const next = document.getElementById("nextPageBtn");
  const maxPage = getTotalPaintingPages() - 1; // 마지막 페이지 인덱스
  const isFirst = getPage() === 0;
  const isLast  = getPage() >= maxPage;

  if (prev) prev.disabled = isFirst;
  if (next) next.disabled = isLast;

  // 추가: 이미지/커스텀 요소 접근성 & 스타일 비활성화
  setNavDisabled(prev, isFirst);
  setNavDisabled(next, isLast);
}

// 페이지 버튼 이벤트 바인딩
export function setupPaintingPagination() {
  const prev = document.getElementById("prevPageBtn");
  const next = document.getElementById("nextPageBtn");

  if (prev) {
    prev.addEventListener("click", () => {
      // 🔧 추가: aria-disabled 방어
      if (prev.getAttribute("aria-disabled") === "true") return;

      if (getPage() > 0) {
        setPage(getPage() - 1);
        populatePaintingGrid();
      }
    });
  }
  if (next) {
    next.addEventListener("click", () => {
      if (next.getAttribute("aria-disabled") === "true") return;

      const maxPage = getTotalPaintingPages() - 1;
      if (getPage() < maxPage) {
        setPage(getPage() + 1);
        populatePaintingGrid();
      }
    });
  }
}
