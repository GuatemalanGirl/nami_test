// ui/frameColorPicker.js

import { showPaintingEditButtons } from "./paintingEditButtons"

let isColorPicking = false

export function showFrameColorPicker(mesh, editingButtonsDiv, scene, camera, controls, quill) {
  // 기존 색상 백업
  const prevColor = mesh.material[4].color.getHexString()
  // 이미 열린 팔레트 있으면 중복 방지
  if (document.getElementById("frameColorPalette")) return
  isColorPicking = true

  const palette = document.createElement("div")
  palette.className = "overlay-panel"
  palette.id = "frameColorPalette"
  palette.addEventListener("mousedown", (e) => e.stopPropagation()) // 팔레트 안 클릭은 전역으로 퍼지지 않음 -> 파랑테두리 유지

  // 팔레트 컨테이너 생성
  const colors = [
    "#ffffff", "#d5d5d5", "#9f9f9f", "#6c6c6c", "#3c3c3c", "#000000",
    "#ffbb00", "#ff5900", "#ff002b", "#ff00a1", "#fb00ff", "#4000ff",
    "#0900ff", "#0059ff", "#00c8ff", "#6fff00", "#00ca2c"
  ]
  const colorRows = [colors.slice(0, 6), colors.slice(6, 12), colors.slice(12, 17)] // 첫 줄: 6개, 둘째 줄: 6개, 셋째 줄 5개 + 컬러피커

  const paletteDiv = document.createElement("div")
  paletteDiv.className = "color-palette"

  colorRows.forEach((rowColors, rowIdx) => {
    const rowDiv = document.createElement("div")
    rowDiv.className = "color-row"

    rowColors.forEach((color) => {
      const colorBtn = createColorButton(mesh, color)
      rowDiv.appendChild(colorBtn)
    })

    // ── 세 번째 줄 끝 : “사용자 지정 색상” ─────────────
    if (rowIdx === 2) {
      const customInput = createCustomColorPicker(mesh, "#" + prevColor)
      rowDiv.appendChild(customInput)
    }

    paletteDiv.appendChild(rowDiv)
  })

  palette.appendChild(paletteDiv)
  
// 확인/취소 버튼
  const okBtn = document.createElement("button")
  okBtn.classList.add("icon-btn", "sm")
  okBtn.innerHTML = `<img src="icons/apply.svg" alt="확인" />`
  okBtn.addEventListener("click", () => {
    // 색상 확정: userData, DB 등에 저장
    mesh.userData.frameColor = mesh.userData.frameColorTemp || "#" + prevColor
    mesh.userData.frameColorTemp = null
    isColorPicking = false
    // 팔레트 닫기
    document.body.removeChild(palette)
    // 편집 버튼 복귀
    showPaintingEditButtons(mesh, scene, camera, controls, quill)
  })

  const cancelBtn = document.createElement("button")
  cancelBtn.classList.add("icon-btn", "sm")
  cancelBtn.innerHTML = `<img src="icons/back.svg" alt="취소" />`
  cancelBtn.addEventListener("click", () => {
    // 취소: 기존 색상 복원
    mesh.material[4].color.set("#" + prevColor)
    mesh.userData.frameColorTemp = null
    isColorPicking = false
    document.body.removeChild(palette)
    showPaintingEditButtons(mesh, scene, camera, controls, quill)
  })

  const buttonRow = document.createElement("div")
  buttonRow.style.display = "flex"
  buttonRow.style.justifyContent = "center"
  buttonRow.style.gap = "10px"
  buttonRow.style.marginTop = "12px"
  buttonRow.appendChild(okBtn)
  buttonRow.appendChild(cancelBtn)

  palette.appendChild(buttonRow)
  document.body.appendChild(palette)

  // 편집 버튼 숨기기
  if (editingButtonsDiv) {
    editingButtonsDiv.style.display = "none"
  }
}

function createColorButton(mesh, color) {
  const btn = document.createElement("button")
  btn.className = "color-pick-btn"
  btn.style.background = color
  btn.addEventListener("click", () => {
    mesh.material[4].color.set(color)
    mesh.userData.frameColorTemp = color
    deselectAllColorButtons()
    btn.classList.add("selected")
  })
  return btn
}

function createCustomColorPicker(mesh, initialHex) {
  const input = document.createElement("input")
  input.type = "color"
  input.className = "color-pick-btn" // 버튼과 같은 둥근 스타일
  input.style.padding = "0" // 여백 제거
  input.style.cursor = "pointer" // 손가락 커서
  input.value = initialHex

  input.addEventListener("input", (e) => {
    const hex = e.target.value
    mesh.material[4].color.set(hex)
    mesh.userData.frameColorTemp = hex
    input.style.background = hex
    deselectAllColorButtons()
    input.classList.add("selected")
  })

  return input
}

function deselectAllColorButtons() {
  document
    .querySelectorAll(".color-pick-btn")
    .forEach((btn) => btn.classList.remove("selected"))
}

// 외부에서 상태 체크 필요시 getter export
export function getIsColorPicking() {
  return isColorPicking;
}