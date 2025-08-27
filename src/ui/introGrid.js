// ui/introGrid.js

const introOptions = [
  {
    type: 'frame',
    title: '캔버스형<br>전시 글 쓰기',
    bg: '#ffffff'
  },
  {
    type: 'plane',
    title: '투명필름형<br>전시 글 쓰기',
    bg: '#b3b3b3'
  },
  {
    type: 'poster',
    title: '포스터<br>붙이기',
    bg: '#d1ecff'
  }
]

/**
 * 전시서문 썸네일을 introGrid에 동적으로 렌더링하고,
 * dragstart 이벤트를 등록한다.
 */
export function populateIntroGrid() {
  const grid = document.getElementById('introGrid')
  if (!grid) {
    console.warn('introGrid 요소를 찾을 수 없습니다.')
    return
  }

  grid.innerHTML = '' // 초기화

  introOptions.forEach(({ type, title, bg }) => {
    // <div> 박스 생성
    const box = document.createElement('div')
    box.classList.add('thumbnail')   // CSS 적용 대상
    box.id = `intro${capitalize(type)}Thumb`
    box.draggable = true
    box.style.background = bg
    box.style.cursor = 'grab'

    // 텍스트 라벨 추가
    const label = document.createElement('span')
    label.innerHTML = title
    label.classList.add('intro-label')
    box.appendChild(label)

    // 드래그 시작 이벤트
    box.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('intro-type', type) // drop 이벤트에서 직접 읽음
    })

    grid.appendChild(box)
  })
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
