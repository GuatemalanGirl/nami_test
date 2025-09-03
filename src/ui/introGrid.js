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
    });

    // 드래그 종료/드롭: 시각 상태 정리
    const cleanup = () => {
      box.classList.remove('dragging');
    };
    box.addEventListener('dragend', cleanup);
    box.addEventListener('drop', cleanup);

    // 모바일 Safari 등에서 길게 눌렀을 때 컨텍스트 메뉴 억제
    box.addEventListener('contextmenu', (e) => {
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

    // ★★★ Android 등 터치 환경 폴백 DnD 활성화 (pointer 기반 커스텀 드래그)
    enableTouchDragSource(box, 'intro', { type }, { ghostSize: 80 });

    grid.appendChild(box);
  });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
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
    const g = document.createElement('div');
    Object.assign(g.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: `${ghostSize}px`,
      height: `${ghostSize}px`,
      borderRadius: '10px',
      boxShadow: '0 6px 16px rgba(0,0,0,0.25)',
      pointerEvents: 'none',
      zIndex: 999999,
      opacity: '0.9',
      background: getComputedStyle(el).background || 'rgba(255,255,255,0.9)',
      color: '#000',
      display: 'grid',
      placeItems: 'center',
      fontSize: '11px',
      padding: '6px',
      textAlign: 'center',
      transform: 'translate(-50%, -50%)',
      willChange: 'transform'
    });
    g.textContent = (el.textContent || '').replace(/\s+/g, ' ').trim();
    document.body.appendChild(g);
    return g;
  };

  const onDown = (e) => {
    if (e.pointerType === 'mouse') return; // 마우스는 네이티브 DnD 사용
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
      el.classList.add('dragging');
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
      window.dispatchEvent(new CustomEvent('touchdrop', {
        detail: { kind, payload, clientX: e.clientX, clientY: e.clientY },
        bubbles: true,
      }));
    }
    el.classList.remove('dragging');
  };

  el.addEventListener('pointerdown', onDown, { passive: true });
  el.addEventListener('pointermove', onMove, { passive: false });
  el.addEventListener('pointerup', finish, { passive: true });
  el.addEventListener('pointercancel', finish, { passive: true });
}
