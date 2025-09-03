// ui/introGrid.js

const introOptions = [
  { type: 'frame',  title: '캔버스형<br>전시 글 쓰기', bg: '#ffffff' },
  { type: 'plane',  title: '투명필름형<br>전시 글 쓰기', bg: '#b3b3b3' },
  { type: 'poster', title: '포스터<br>붙이기',        bg: '#d1ecff'  },
];

/**
 * 전시서문 썸네일을 introGrid에 동적으로 렌더링하고,
 * dragstart 이벤트를 등록한다.
 */
export function populateIntroGrid() {
  const grid = document.getElementById('introGrid');
  if (!grid) {
    console.warn('introGrid 요소를 찾을 수 없습니다.');
    return;
  }

  grid.innerHTML = ''; // 초기화

  introOptions.forEach(({ type, title, bg }) => {
    // 컨테이너(드래그 소스)
    const box = document.createElement('div');
    box.classList.add('thumbnail'); // 공용 썸네일 스타일 재사용
    box.id = `intro${capitalize(type)}Thumb`;
    box.draggable = true;
    box.style.background = bg;
    box.style.cursor = 'grab';
    // 터치에서 길게 눌러 드래그 전환 시 스크롤 과민도 완화
    box.style.touchAction = 'manipulation';

    // 접근성/데이터
    box.setAttribute('tabindex', '0');         // 키보드 포커스 가능
    box.setAttribute('role', 'button');        // 의미 힌트
    box.dataset.introType = type;

    // 텍스트 라벨
    const label = document.createElement('span');
    label.innerHTML = title;
    label.classList.add('intro-label');
    box.appendChild(label);

    // 드래그 시작
    box.addEventListener('dragstart', (e) => {
      try {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('intro-type', type);

        // 드래그 고스트: 박스 자체를 사용(시야 방해 줄이도록 오프셋)
        if (typeof e.dataTransfer.setDragImage === 'function') {
          // 라벨이 여러줄일 수 있어 살짝 좌상단 오프셋
          const offX = Math.min(32, box.clientWidth / 4);
          const offY = Math.min(32, box.clientHeight / 4);
          e.dataTransfer.setDragImage(box, offX, offY);
        }
      } catch (_) { /* 구형/제한 환경 무시 */ }

      box.classList.add('dragging');
      box.setAttribute('aria-grabbed', 'true');
    });

    // 드래그 종료/드롭: 시각 상태 정리
    const cleanup = () => {
      box.classList.remove('dragging');
      box.removeAttribute('aria-grabbed');
    };
    box.addEventListener('dragend', cleanup);
    box.addEventListener('drop', cleanup);

    // 모바일 Safari 등에서 길게 눌렀을 때 컨텍스트 메뉴 억제
    box.addEventListener('contextmenu', (e) => {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    // (선택) 터치 시작: 드래그로 이어질 가능성 있을 때만 살짝 억제
    box.addEventListener('touchstart', (e) => {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    // 키보드 보조(Enter/Space → 드래그 시작 유사 피드백)
    // 실제 DnD는 마우스/터치 기반이므로 시각 피드백만 제공
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        // 클릭처럼 보이게 가벼운 피드백(필요시 패널 여는 동작으로 확장 가능)
        e.preventDefault();
        box.classList.add('active');
        setTimeout(() => box.classList.remove('active'), 120);
      }
    });

    grid.appendChild(box);
  });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
