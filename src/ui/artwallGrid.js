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

export function populateArtwallGrid() {
  const grid = document.getElementById("artwallGrid");
  if (!grid) return;

  grid.innerHTML = "";
  const page = getArtwallPage();
  const itemsPerPage = (typeof getArtwallPageSize === "function") ? getArtwallPageSize() : 9;
  const walls = getArtwallsByPage(page);
  const coarse = isCoarsePointer(); // 포인터 특성 감지

  walls.forEach((wall, index) => {
    const img = document.createElement("img");
    // 가벼운 최적화
    img.loading = "lazy";
    img.decoding = "async";

    img.src = getArtwallThumbUrl(wall.filename);
    img.alt = wall.title || wall.filename || "artwall";
    img.draggable = !coarse; // coarse(모바일/태블릿)에서는 네이티브 DnD 비활성화
    img.classList.add("thumbnail");
    img.style.touchAction = "manipulation"; // 터치에서 스크롤 과민도 완화

    // 페이지/인덱스 데이터셋(선택)
    img.dataset.page = String(page);
    img.dataset.index = String(page * itemsPerPage + index);

    if (!coarse) {
      // ── 데스크톱: 네이티브 Drag & Drop
      img.addEventListener("dragstart", (e) => {
        try {
          e.dataTransfer.effectAllowed = "copy";
          if (typeof e.dataTransfer.setDragImage === "function") {
            e.dataTransfer.setDragImage(
              img,
              Math.min(32, img.width / 4),
              Math.min(32, img.height / 4)
            );
          }
          e.dataTransfer.setData("artwall", JSON.stringify(wall));
        } catch (_) {
          // 구형/특수 환경에서 dataTransfer 접근 불가 → 무시
        }
        img.classList.add("dragging");
      });

      const cleanup = () => img.classList.remove("dragging");
      img.addEventListener("dragend", cleanup);
      img.addEventListener("drop", cleanup);
    } else {
      // ── Android 등 터치 환경: 폴백(가짜 drop 캔버스로 디스패치)
      img.addEventListener(
        "touchend",
        (e) => {
          if (e.cancelable) e.preventDefault();
          const t = e.changedTouches && e.changedTouches[0];
          if (!t) return;
          dispatchSyntheticDrop("artwall", wall, t.clientX, t.clientY); // ★
        },
        { passive: false }
      );

      // (선택) 탭으로도 배치 가능
      img.addEventListener("click", (e) => {
        dispatchSyntheticDrop("artwall", wall, e.clientX, e.clientY); // ★
      });
    }

    // iOS 등 컨텍스트 메뉴 억제(드래그 목적일 때 UX 향상)
    img.addEventListener(
      "contextmenu",
      (e) => {
        if (e.cancelable) e.preventDefault();
      },
      { passive: false }
    );

    grid.appendChild(img);
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