// ui/paintingStoryEditor.js

// 필요한 외부 함수/상태 import
import { updatePaintingInfo } from './infoModal.js'
import { showPaintingEditButtons } from './paintingEditButtons.js'
import { showInfo } from './infoModal.js'
import { setSelectedPainting } from '../domain/painting.js'

let isStoryEditing = false

/**
 * "작품이야기" 버튼을 눌렀을 때 호출되는 함수
 * @param {THREE.Mesh} mesh
 */
export function showPaintingStoryEditor(mesh, scene, camera, controls, quill) {
  // 이미 열린 오버레이가 있으면 중복 생성 방지
  if (document.getElementById("paintingStoryEditorOverlay")) return
  isStoryEditing = true

  // 버튼 숨기기
  const editingButtonsDiv = document.getElementById('paintingEditButtons')
  if (editingButtonsDiv) editingButtonsDiv.style.display = 'none'

  // === 오버레이 패널 생성 ===
  const overlay = document.createElement('div')
  overlay.className = 'overlay-panel'
  overlay.id = 'paintingStoryEditorOverlay'

  // 오버레이 클릭시 닫히지 않도록(e.stopPropagation)
  overlay.addEventListener('click', (e) => {
    e.stopPropagation()
  })

  // === 타이틀/설명 ===
  // === 타이틀/설명 ===
const data = mesh.userData.data || {}

const titleKor = data.title_kor || "(제목 없음)"
const titleEng = data.title_eng ? ` (${data.title_eng})` : ""
const artistKor = data.artist_kor || ""
const artistEng = data.artist_eng || ""
const mediumYear = data.medium_year || ""
const dimensions = data.dimensions || ""

// 타이틀 + 작가 + 기타 정보 DOM 구성
const title = document.createElement("div")
title.textContent = `${titleKor}${titleEng}`
title.style.fontWeight = "bold"
title.style.fontSize = "20px"
title.style.marginBottom = "8px"
overlay.appendChild(title)

const meta = document.createElement("div")
meta.style.fontSize = "14px"
meta.style.color = "#555"
meta.style.marginBottom = "14px"
meta.innerHTML = `
  ${artistKor} ${artistEng ? `(${artistEng})` : ""}<br>
  ${mediumYear}<br>
  ${dimensions}
`
overlay.appendChild(meta)


  // === Quill 에디터 컨테이너 생성 ===
  const editorDiv = document.createElement('div')
  editorDiv.id = 'paintingStoryQuill'
  editorDiv.style.width = '280px'
  editorDiv.style.height = '150px'
  editorDiv.style.background = '#fff'
  /*editorDiv.style.marginBottom = '16px';*/
  overlay.appendChild(editorDiv)

  // === 기존 작품설명(기본값) 불러오기 ===
  // json에서 넘어온 설명: mesh.userData.data.description 등에서 가져옴
  // (설명이 저장되어 있다면 최신값, 없으면 "")
  let prevText = ''
  if (mesh.userData.story) {
    // 이미 사용자가 입력한 값이 있으면
    prevText = mesh.userData.story
  } else if (mesh.userData.data && mesh.userData.data.description) {
    // 최초에는 json에서 온 설명 사용
    prevText = mesh.userData.data.description
  } else {
    prevText = ''
  }

  // === Quill 에디터 실제 생성 ===
  // 기존 intro/서문에서 쓰던 옵션 복붙 가능
  const storyQuill = new Quill(editorDiv, {
    theme: 'snow',
    modules: {
      toolbar: false,
    },
  })

  // 초기값 채우기
  storyQuill.root.innerHTML = prevText

  // === 버튼 영역 (확인/취소) ===
  const buttonRow = document.createElement('div')
  buttonRow.style.display = 'flex'
  buttonRow.style.justifyContent = 'center'
  buttonRow.style.gap = '10px'
  buttonRow.style.marginTop = '18px'

  // 확인 버튼
  const okBtn = document.createElement('button')
  okBtn.classList.add('icon-btn', 'sm')
  okBtn.innerHTML = `<img src="icons/apply.svg" alt="확인" />`
  okBtn.onclick = function () {
    // 텍스트 저장(HTML)
    const html = storyQuill.root.innerHTML
    mesh.userData.story = html

    setSelectedPainting(mesh)

    // 필요하다면 mesh.userData.data.description = html; 도 가능
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay)
    }
    // 외부클릭차단 해제 / 오버레이 제거
    isStoryEditing = false

    // 필요하면 작품정보(info) 새로고침/업데이트 함수 호출
    updatePaintingInfo(mesh)

    // infoModal을 여기서 띄움
    const modal = document.getElementById("infoModal")
    if (modal) {
      modal.classList.add("story-finished") // ✅ 스토리 편집 완료 전용 위치 클래스 추가
    }
    showInfo(mesh.userData.data, mesh) // infoModal 오픈
  }
  buttonRow.appendChild(okBtn)

  // 취소 버튼
  const cancelBtn = document.createElement('button')
  cancelBtn.classList.add('icon-btn', 'sm')
  cancelBtn.innerHTML = `<img src="icons/back.svg" alt="취소" />`
  cancelBtn.onclick = function () {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay)
    }
    // 외부 클릭 차단 해제 & 오버레이 제거
    isStoryEditing = false

    showPaintingEditButtons(mesh, scene, camera, controls, quill)
  }
  buttonRow.appendChild(cancelBtn)

  overlay.appendChild(buttonRow)

  // === 오버레이를 body에 추가 ===
  document.body.appendChild(overlay)
  // === 필요시 에디터 자동 포커스 ===
  setTimeout(() => {
    storyQuill.focus()

    // 1) 에디터 실제 렌더된 컨테이너 폭 측정
    const editorWidth = overlay
      .querySelector('.ql-container')
      .getBoundingClientRect().width

    // 2) infoModal의 컨텐츠 영역에도 똑같이 설정
    const infoContent = document.querySelector('#infoModal .info-content')
    if (infoContent) {
      infoContent.style.width = `${editorWidth}px`
      infoContent.style.boxSizing = 'border-box'
    }
  }, 0)
}

// 필요하면 현재 편집중 여부 반환
export function getIsStoryEditing() {
  return isStoryEditing
}
