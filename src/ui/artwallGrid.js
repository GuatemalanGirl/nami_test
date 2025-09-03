// ui/artwallGrid.js

import {
  getArtwallsByPage,
  getArtwallPage,
  setArtwallPage,
  getTotalArtwallPages,
  getArtwallThumbUrl,
} from "../data/artwall.js";

export function populateArtwallGrid() {
  const grid = document.getElementById("artwallGrid");
  if (!grid) return;

  grid.innerHTML = "";
  const walls = getArtwallsByPage();

  walls.forEach((wall, index) => {
    const img = document.createElement("img");
    // 가벼운 최적화
    img.loading = "lazy";
    img.decoding = "async";

    img.src = getArtwallThumbUrl(wall.filename);
    img.alt = wall.title || wall.filename || "artwall";
    img.draggable = true;
    img.classList.add("thumbnail");
    // 터치에서 길게 눌러 드래그 전환 시 스크롤 과민도 완화
    img.style.touchAction = "manipulation";

    // (선택) 페이지/인덱스 데이터셋
    img.dataset.page = String(getArtwallPage());
    img.dataset.index = String(index);

    // 드래그 시작
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

    // iOS 등에서 길게 눌러 뜨는 컨텍스트 메뉴 억제(드래그 목적일 때 UX 향상)
    img.addEventListener(
      "contextmenu",
      (e) => {
        if (e.cancelable) e.preventDefault();
      },
      { passive: false }
    );

    // ★★★ Android 등 터치 환경 폴백 DnD 활성화 (pointer 기반 커스텀 드래그)
    enableTouchDragSource(img, "artwall", wall, { ghostSize: 72 });

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

/* ─────────────────────────────────────────────────────────
 * ★ 터치 전용 폴백 DnD (pointer 기반)
 * - Android Chrome 등에서 HTML5 DnD가 동작하지 않는 경우를 대비
 * - 드래그 시작 임계(TH) 초과 시 고스트를 띄우고, 손을 떼는 위치로
 *   window에 'touchdrop' 커스텀 이벤트를 발행 → dropHandlers가 수신
 * ───────────────────────────────────────────────────────── */
function enableTouchDragSource(el, kind, payload, { ghostSize = 64 } = {}) {
  let dragging = false, started = false, sx = 0, sy = 0, ghost = null;
  const TH = 6;

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
      opacity: "0.9",
      backgroundSize: "cover",
      backgroundPosition: "center",
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
    sx = e.clientX; sy = e.clientY;
    el.setPointerCapture?.(e.pointerId);
  };

  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
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
    if (ghost) { ghost.remove(); ghost = null; }
    if (started) {
      window.dispatchEvent(new CustomEvent("touchdrop", {
        detail: { kind, payload, clientX: e.clientX, clientY: e.clientY },
        bubbles: true,
      }));
    }
    el.classList.remove("dragging");
  };

  el.addEventListener("pointerdown", onDown, { passive: true });
  el.addEventListener("pointermove", onMove, { passive: false });
  el.addEventListener("pointerup", finish, { passive: true });
  el.addEventListener("pointercancel", finish, { passive: true });
}
