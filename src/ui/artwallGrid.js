// ui/artwallGrid.js

import {
  getArtwallsByPage,
  getArtwallPage,
  setArtwallPage,
  getTotalArtwallPages,
  getArtwallThumbUrl
} from "../data/artwall.js"

export function populateArtwallGrid() {
  const grid = document.getElementById("artwallGrid")
  if (!grid) return

  grid.innerHTML = ""
  const walls = getArtwallsByPage()

  walls.forEach((wall) => {
    const img = document.createElement("img")
    img.src = getArtwallThumbUrl(wall.filename)
    img.alt = wall.title || ""
    img.draggable = true
    img.classList.add("thumbnail")

    img.addEventListener("dragstart", (e) =>
      e.dataTransfer.setData("artwall", JSON.stringify(wall)),
    )

    grid.appendChild(img)
  })

  updateArtwallPageButtons()
}

function updateArtwallPageButtons() {
  const prev = document.getElementById("prevArtPageBtn")
  const next = document.getElementById("nextArtPageBtn")
  const current = getArtwallPage()
  const maxPage = getTotalArtwallPages() - 1

  prev.disabled = current === 0
  next.disabled = current >= maxPage
}

export function setupArtwallPagination() {
  const prev = document.getElementById("prevArtPageBtn")
  const next = document.getElementById("nextArtPageBtn")

  if (!prev || !next) return

  prev.addEventListener("click", () => {
    const page = getArtwallPage()
    if (page > 0) {
      setArtwallPage(page - 1)
      populateArtwallGrid()
    }
  })

  next.addEventListener("click", () => {
    const page = getArtwallPage()
    const maxPage = getTotalArtwallPages() - 1
    if (page < maxPage) {
      setArtwallPage(page + 1)
      populateArtwallGrid()
    }
  })
}
