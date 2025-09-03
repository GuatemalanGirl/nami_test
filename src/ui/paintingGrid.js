// ui/paintingGrid.js

import {
  getPage, setPage, getPaintingsByPage, getTotalPaintingPages, getPaintingThumbUrl,
} from "../data/painting.js";
import { isCoarsePointer, dispatchSyntheticDrop } from "./touchDropFallback.js";

// 썸네일 그리드 생성 + 이벤트 등록
export function populatePaintingGrid() {
  const grid = document.getElementById("paintingGrid");
  if (!grid) return;

  grid.innerHTML = ""; // 기존 내용 초기화

  const page = getPage();             // 현재 페이지(0-based)
  const itemsPerPage = 9;
  const currentItems = getPaintingsByPage(); // 현재 페이지 아이템 목록
  const coarse = isCoarsePointer();

  currentItems.forEach((painting, index) => {
    const globalIndex = page * itemsPerPage + index;

    const thumb = document.createElement("img");
    thumb.loading = "lazy";
    thumb.src = getPaintingThumbUrl(painting.filename);
    thumb.alt = painting.title || painting.filename || "painting";
    thumb.draggable = !coarse;               // ★ coarse면 네이티브 DnD 끔
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

function updatePageButtons() {
  const prev = document.getElementById("prevPageBtn");
  const next = document.getElementById("nextPageBtn");
  const maxPage = getTotalPaintingPages() - 1; // 마지막 페이지 인덱스

  if (prev) prev.disabled = getPage() === 0;
  if (next) next.disabled = getPage() >= maxPage;
}

// 페이지 버튼 이벤트 바인딩
export function setupPaintingPagination() {
  const prev = document.getElementById("prevPageBtn");
  const next = document.getElementById("nextPageBtn");

  if (prev) {
    prev.addEventListener("click", () => {
      if (getPage() > 0) {
        setPage(getPage() - 1);
        populatePaintingGrid();
      }
    });
  }
  if (next) {
    next.addEventListener("click", () => {
      const maxPage = getTotalPaintingPages() - 1;
      if (getPage() < maxPage) {
        setPage(getPage() + 1);
        populatePaintingGrid();
      }
    });
  }
}
