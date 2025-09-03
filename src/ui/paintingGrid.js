// ui/paintingGrid.js

import {
  getPage,
  setPage,
  getPaintingsByPage,
  getTotalPaintingPages,
  getPaintingThumbUrl,
} from "../data/painting.js";

// 썸네일 그리드 생성 + 이벤트 등록
export function populatePaintingGrid() {
  const grid = document.getElementById("paintingGrid");
  if (!grid) return;

  grid.innerHTML = ""; // 기존 내용 초기화

  const page = getPage();             // 현재 페이지(0-based)
  const itemsPerPage = 9;
  const currentItems = getPaintingsByPage(); // 현재 페이지 아이템 목록

  currentItems.forEach((painting, index) => {
    // ★ 버그 수정: 전체 인덱스는 page * itemsPerPage + index
    const globalIndex = page * itemsPerPage + index;

    const thumb = document.createElement("img");
    thumb.loading = "lazy"; // 가벼운 최적화
    thumb.src = getPaintingThumbUrl(painting.filename);
    thumb.alt = painting.title || painting.filename || "painting";
    thumb.draggable = true; // HTML5 DnD
    thumb.dataset.index = String(globalIndex); // 전체 인덱스 기준
    thumb.classList.add("thumbnail");
    // 모바일에서 길게 눌렀을 때 드래그로 전환되도록 스크롤 과민도 완화
    thumb.style.touchAction = "manipulation";

    // 드래그 시작
    thumb.addEventListener("dragstart", (e) => {
      // 일부 브라우저에서 필수
      try {
        e.dataTransfer.effectAllowed = "copy";
        // 드래그 미리보기(고스트)로 썸네일 자체 사용
        // (offset을 약간 주면 손가락/커서 아래에서 시야를 가리지 않음)
        if (typeof e.dataTransfer.setDragImage === "function") {
          e.dataTransfer.setDragImage(
            thumb,
            Math.min(32, thumb.width / 4),
            Math.min(32, thumb.height / 4)
          );
        }
        // 전달 데이터(객체 전체) – 기존 로직 유지
        e.dataTransfer.setData("painting", JSON.stringify(painting));
      } catch (_) {
        // dataTransfer에 접근 불가한 환경(아주 구형) – 무시
      }
      // 시각 피드백
      thumb.classList.add("dragging");
    });

    // 드래그 중/종료 시 시각 피드백 정리
    const cleanupDragState = () => {
      thumb.classList.remove("dragging");
    };
    thumb.addEventListener("dragend", cleanupDragState);
    thumb.addEventListener("drop", cleanupDragState); // 드롭이 같은 그리드 안에서 발생해도 정리

    // (선택) 모바일 Safari에서 길게 눌렀을 때 컨텍스트 메뉴 억제
    thumb.addEventListener(
      "contextmenu",
      (e) => {
        if (e.cancelable) e.preventDefault();
      },
      { passive: false }
    );

    // ★★★ Android 등 터치 환경 폴백 DnD 활성화 (pointer 기반 커스텀 드래그)
    enableTouchDragSource(thumb, "painting", painting, {
      ghostSize: 72,
    });

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

/* ─────────────────────────────────────────────────────────
 * ★ 터치 전용 폴백 DnD (pointer 기반)
 * - Android Chrome 등에서 HTML5 DnD가 동작하지 않는 경우를 대비
 * - 드래그 시작 임계(TH) 초과 시 고스트를 띄우고, 손을 떼는 위치로
 *   window에 'touchdrop' 커스텀 이벤트를 발행 → dropHandlers가 수신
 * ───────────────────────────────────────────────────────── */
function enableTouchDragSource(el, kind, payload, { ghostSize = 64 } = {}) {
  let dragging = false;
  let started = false;
  let sx = 0, sy = 0;
  let ghost = null;
  const TH = 6; // 드래그 시작 임계(px)

  const makeGhost = () => {
    const g = document.createElement("div");
    Object.assign(g.style, {
      position: "fixed",
      left: "0px",
      top: "0px",
      width: `${ghostSize}px`,
      height: `${ghostSize}px`,
      borderRadius: "10px",
      boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
      pointerEvents: "none",
      zIndex: 999999,
      opacity: "0.9",
      backgroundSize: "cover",
      backgroundPosition: "center center",
      transform: "translate(-50%, -50%)",
      willChange: "transform",
    });
    if (el instanceof HTMLImageElement) {
      g.style.backgroundImage = `url(${el.currentSrc || el.src})`;
    } else {
      g.style.background = "rgba(255,255,255,0.9)";
    }
    document.body.appendChild(g);
    return g;
  };

  const onDown = (e) => {
    if (e.pointerType === "mouse") return; // 마우스는 네이티브 DnD 사용
    dragging = true;
    started = false;
    sx = e.clientX;
    sy = e.clientY;
    el.setPointerCapture?.(e.pointerId);
  };

  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (!started && Math.hypot(dx, dy) > TH) {
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
    if (ghost) {
      ghost.remove();
      ghost = null;
    }
    if (started) {
      // 캔버스 측으로 커스텀 드롭 이벤트 송신
      window.dispatchEvent(
        new CustomEvent("touchdrop", {
          detail: { kind, payload, clientX: e.clientX, clientY: e.clientY },
          bubbles: true,
        })
      );
    }
    el.classList.remove("dragging");
  };

  el.addEventListener("pointerdown", onDown, { passive: true });
  el.addEventListener("pointermove", onMove, { passive: false }); // preventDefault 가능
  el.addEventListener("pointerup", finish, { passive: true });
  el.addEventListener("pointercancel", finish, { passive: true });
}
