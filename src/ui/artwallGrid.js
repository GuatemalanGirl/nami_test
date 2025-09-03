// ui/artwallGrid.js

import {
  getArtwallsByPage,
  getArtwallPage,
  setArtwallPage,
  getTotalArtwallPages,
  getArtwallThumbUrl,
} from "../data/artwall.js";
import { isCoarsePointer, enableTouchDragSource } from "./touchDropFallback.js"; // ★ 터치 폴백 + 고스트

export function populateArtwallGrid() {
  const grid = document.getElementById("artwallGrid");
  if (!grid) return;

  grid.innerHTML = "";
  const walls = getArtwallsByPage();
  const coarse = isCoarsePointer(); // ★ 포인터 특성 감지

  walls.forEach((wall, index) => {
    const img = document.createElement("img");
    // 가벼운 최적화
    img.loading = "lazy";
    img.decoding = "async";

    img.src = getArtwallThumbUrl(wall.filename);
    img.alt = wall.title || wall.filename || "artwall";
    img.draggable = !coarse; // ★ coarse(모바일/태블릿)에서는 네이티브 DnD 비활성화
    img.classList.add("thumbnail");
    // 터치에서 길게 눌러 드래그 전환 시 스크롤 과민도 완화
    img.style.touchAction = "manipulation";
    img.style.userSelect = "none";
    img.style.webkitUserSelect = "none";

    // (선택) 페이지/인덱스 데이터셋
    img.dataset.page = String(getArtwallPage());
    img.dataset.index = String(index);

    if (!coarse) {
      // ── 데스크톱: 네이티브 Drag & Drop
      img.addEventListener("dragstart", (e) => {
        try {
          e.dataTransfer.effectAllowed = "copy";
          // 드래그 고스트를 썸네일로 지정(시야 가리지 않게 살짝 오프셋)
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

      // 드래그 종료/드롭 시 비주얼 상태 정리
      const cleanup = () => {
        img.classList.remove("dragging");
      };
      img.addEventListener("dragend", cleanup);
      img.addEventListener("drop", cleanup);
    } else {
      // ── Android 등 터치 환경: 폴백(고스트 + synthetic drop)
      //    손가락을 임계치 이상 이동하면 고스트가 나타나고,
      //    손을 떼는 위치로 캔버스에 drop을 디스패치합니다.
      enableTouchDragSource(img, "artwall", () => wall, {
        ghostSize: 80,
        threshold: 6,
      });
    }

    // iOS 등에서 길게 눌러 뜨는 컨텍스트 메뉴 억제(드래그 목적일 때 UX 향상)
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

function updateArtwallPageButtons() {
  const prev = document.getElementById("prevArtPageBtn");
  const next = document.getElementById("nextArtPageBtn");
  const current = getArtwallPage();
  const maxPage = getTotalArtwallPages() - 1;

  if (prev) prev.disabled = current === 0;
  if (next) next.disabled = current >= maxPage;
}

export function setupArtwallPagination() {
  const prev = document.getElementById("prevArtPageBtn");
  const next = document.getElementById("nextArtPageBtn");

  if (prev) {
    prev.addEventListener("click", () => {
      const page = getArtwallPage();
      if (page > 0) {
        setArtwallPage(page - 1);
        populateArtwallGrid();
      }
    });
  }

  if (next) {
    next.addEventListener("click", () => {
      const page = getArtwallPage();
      const maxPage = getTotalArtwallPages() - 1;
      if (page < maxPage) {
        setArtwallPage(page + 1);
        populateArtwallGrid();
      }
    });
  }
}
