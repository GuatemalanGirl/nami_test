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

    const thumb = document.createElement("img");
    thumb.loading = "lazy";
    thumb.src = getPaintingThumbUrl(painting.filename);
    thumb.alt = painting.title || painting.filename || "painting";
    thumb.draggable = !coarse;               // coarse면 네이티브 DnD 끔
    thumb.dataset.index = String(globalIndex);
    thumb.classList.add("thumbnail");
    thumb.style.touchAction = "manipulation";

    if (!coarse) {
      // 데스크톱: 네이티브 DnD
      thumb.addEventListener("dragstart", (e) => {
        try {
          e.dataTransfer.effectAllowed = "copy";
          if (typeof e.dataTransfer.setDragImage === "function") {
            e.dataTransfer.setDragImage(
              thumb, Math.min(32, thumb.width / 4), Math.min(32, thumb.height / 4)
            );
          }
          e.dataTransfer.setData("painting", JSON.stringify(painting));
        } catch {}
        thumb.classList.add("dragging");
      });
      const cleanup = () => thumb.classList.remove("dragging");
      thumb.addEventListener("dragend", cleanup);
      thumb.addEventListener("drop", cleanup);
    } else {
      // 모바일/태블릿(Android 등): 터치 폴백
      thumb.addEventListener("touchend", (e) => {
        if (e.cancelable) e.preventDefault();
        const t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        dispatchSyntheticDrop("painting", painting, t.clientX, t.clientY);
      }, { passive: false });

      // (선택) 클릭 보조: 캔버스 내부로 좌표 보정되므로 중복 위험 없음
      thumb.addEventListener("click", (e) => {
        dispatchSyntheticDrop("painting", painting, e.clientX, e.clientY);
      });
    }

    // iOS 컨텍스트 메뉴 억제
    thumb.addEventListener("contextmenu", (e) => {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    grid.appendChild(thumb);
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