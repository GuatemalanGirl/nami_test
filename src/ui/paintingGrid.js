// ui/paintingGrid.js

import { getPage,
    setPage,
    getPaintingsByPage,
    getTotalPaintingPages,
    getPaintingThumbUrl
} from "../data/painting.js"

// 썸네일 그리드 생성 + 이벤트 등록
export function populatePaintingGrid() {
  const grid = document.getElementById("paintingGrid")
  if (!grid) return

  grid.innerHTML = "" // 기존 내용 초기화

  const page = getPage() // 현재 페이지
  const itemsPerPage = 9
  const currentItems = getPaintingsByPage()

  currentItems.forEach((painting, index) => {
    const globalIndex = page + itemsPerPage + index // globalIndex 계산

    const thumb = document.createElement("img")
    thumb.src = getPaintingThumbUrl(painting.filename)
    thumb.alt = painting.title
    thumb.draggable = true
    thumb.dataset.index = globalIndex // 전체 인덱스 기준
    thumb.classList.add("thumbnail")

    // 드래그 시작
    thumb.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("painting", JSON.stringify(painting)) // 객체 전체 전달
    })

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
