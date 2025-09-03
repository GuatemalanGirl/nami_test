// ui/paintingGrid.js

import {
  getPage,
  setPage,
  getPaintingsByPage,
  getTotalPaintingPages,
  getPaintingThumbUrl
} from "../data/painting.js"

// ───────────────────────────────────────────────────────────
// 헬퍼: 모바일/포인터 특성 감지
const isCoarsePointer = () =>
  (window.matchMedia && window.matchMedia("(pointer:coarse)").matches) ||
  ("ontouchstart" in window);

// 캔버스 참조 (script.js의 init()에서 window.__galleryCanvas = renderer.domElement 해두면 가장 정확)
function getCanvasElement() {
  return window.__galleryCanvas || document.querySelector("canvas");
}

// 모바일 폴백: 캔버스로 drop 이벤트를 "가짜"로 디스패치
function dispatchSyntheticDrop(painting, clientX, clientY) {
  const canvas = getCanvasElement();
  if (!canvas) return;

  // dropHandlers가 e.clientX/Y와 e.dataTransfer.getData('painting')를 읽는다고 가정
  const evt = new Event("drop", { bubbles: true, cancelable: true });
  // 좌표 주입(간단히 확장 속성으로 넣음)
  evt.clientX = clientX;
  evt.clientY = clientY;
  // DataTransfer 대체: 필요한 키만 구현
  evt.dataTransfer = {
    getData: (type) => (type === "painting" ? JSON.stringify(painting) : "")
  };

  canvas.dispatchEvent(evt);
}

// ───────────────────────────────────────────────────────────
// 썸네일 그리드 생성 + 이벤트 등록
export function populatePaintingGrid() {
  const grid = document.getElementById("paintingGrid")
  if (!grid) return

  grid.innerHTML = "" // 기존 내용 초기화

  const page = getPage() // 현재 페이지
  const itemsPerPage = 9
  const currentItems = getPaintingsByPage()

  currentItems.forEach((painting, index) => {
    // ✅ 버그 수정: 글로벌 인덱스 계산
    const globalIndex = page * itemsPerPage + index

    const thumb = document.createElement("img")
    thumb.src = getPaintingThumbUrl(painting.filename)
    thumb.alt = painting.title
    // 데스크톱만 네이티브 드래그 사용, 모바일은 폴백 사용
    thumb.draggable = !isCoarsePointer()
    thumb.dataset.index = globalIndex // 전체 인덱스 기준
    thumb.classList.add("thumbnail")

    // ── 데스크톱: 네이티브 Drag & Drop
    if (!isCoarsePointer()) {
      // 드래그 시작
      thumb.addEventListener("dragstart", (e) => {
        // 객체 전체 전달
        e.dataTransfer.setData("painting", JSON.stringify(painting))
      })
    } else {
      // ── 모바일: 터치 탭/릴리즈 → 가짜 drop 디스패치
      // 짧은 탭으로도 배치할 수 있게 touchend에서 캔버스에 drop 보냄
      thumb.addEventListener("touchend", (e) => {
        // 사용자 의도와 스크롤 제스처 충돌 방지
        if (e.cancelable) e.preventDefault()
        const t = e.changedTouches && e.changedTouches[0]
        if (!t) return

        // 터치 위치 기준으로 dropHandlers가 레이캐스트하도록 좌표 전달
        dispatchSyntheticDrop(painting, t.clientX, t.clientY)
      }, { passive: false })

      // 선택적으로: 모바일에서도 클릭(탭)으로 동작하게 추가
      thumb.addEventListener("click", (e) => {
        const canvas = getCanvasElement()
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        // 캔버스 중앙으로 드롭(사용자가 바로 보이도록)
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        dispatchSyntheticDrop(painting, cx, cy)
      })
    }

    grid.appendChild(thumb)
  })

  // 페이징 버튼 상태 업데이트
  updatePageButtons()
}

function updatePageButtons() {
  const prev = document.getElementById("prevPageBtn")
  const next = document.getElementById("nextPageBtn")
  const maxPage = getTotalPaintingPages() - 1 // 페이지 수 - 1 == 마지막 인덱스

  prev.disabled = getPage() === 0
  next.disabled = getPage() >= maxPage
}

// 페이지 버튼 이벤트 바인딩
export function setupPaintingPagination() {
  const prev = document.getElementById("prevPageBtn")
  const next = document.getElementById("nextPageBtn")

  if (prev && next) {
    prev.addEventListener("click", () => {
      if (getPage() > 0) {
        setPage(getPage() - 1)
        populatePaintingGrid()
      }
    })

    next.addEventListener("click", () => {
      const maxPage = getTotalPaintingPages() - 1
      if (getPage() < maxPage) {
        setPage(getPage() + 1)
        populatePaintingGrid()
      }
    })
  }
}
