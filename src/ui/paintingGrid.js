// ui/paintingGrid.js

import {
  getPage,
  setPage,
  getPaintingsByPage,
  getTotalPaintingPages,
  getPaintingThumbUrl,
} from "../data/painting.js";
import { isCoarsePointer, enableTouchDragSource } from "./touchDropFallback.js"; // ★ 터치 폴백 + 고스트

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
    thumb.decoding = "async";
    thumb.src = getPaintingThumbUrl(painting.filename);
    thumb.alt = painting.title || painting.filename || "painting";
    thumb.draggable = !coarse;               // ★ coarse면 네이티브 DnD 끔
    thumb.dataset.index = String(globalIndex);
    thumb.classList.add("thumbnail");
    // 모바일에서 길게 눌렀을 때 드래그로 전환되도록 스크롤 과민도 완화
    thumb.style.touchAction = "manipulation";
    // 선택 방지(롱프레스 시 텍스트/이미지 선택 팝업 억제)
    thumb.style.userSelect = "none";
    thumb.style.webkitUserSelect = "none";

    if (!coarse) {
      // ── 데스크톱: 네이티브 Drag & Drop
      thumb.addEventListener("dragstart", (e) => {
        try {
          e.dataTransfer.effectAllowed = "copy";
          // 드래그 미리보기(고스트)로 썸네일 자체 사용
          if (typeof e.dataTransfer.setDragImage === "function") {
            e.dataTransfer.setDragImage(
              thumb,
              Math.min(32, thumb.width / 4),
              Math.min(32, thumb.height / 4)
            );
          }
          // 전달 데이터(객체 전체) – 기존 로직 유지
          e.dataTransfer.setData("painting", JSON.stringify(painting));
        } catch {}
        // 시각 피드백
        thumb.classList.add("dragging");
      });

      // 드래그 중/종료 시 시각 피드백 정리
      const cleanup = () => {
        thumb.classList.remove("dragging");
      };
      thumb.addEventListener("dragend", cleanup);
      thumb.addEventListener("drop", cleanup); // 드롭이 같은 그리드 안에서 발생해도 정리
    } else {
      // ── Android 등 터치 환경: 폴백(고스트 + synthetic drop)
      //    손가락을 약간 이동(threshold)하면 고스트가 나타나고,
      //    손을 떼는 위치로 캔버스에 drop을 디스패치합니다.
      enableTouchDragSource(thumb, "painting", () => painting, {
        ghostSize: 80,
        threshold: 6,
      });

      // (선택) 탭으로도 곧바로 배치하고 싶다면 아래 주석 해제
      // thumb.addEventListener("click", (e) => {
      //   dispatchSyntheticDrop("painting", painting, e.clientX, e.clientY);
      // });
    }

    // (선택) 모바일 Safari 등에서 길게 눌렀을 때 컨텍스트 메뉴 억제
    thumb.addEventListener(
      "contextmenu",
      (e) => {
        if (e.cancelable) e.preventDefault();
      },
      { passive: false }
    );

    grid.appendChild(thumb);
  });

  // 페이징 버튼 상태 업데이트
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
