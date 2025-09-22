// ui/introGrid.js

import { isCoarsePointer, dispatchSyntheticDrop } from "./touchDropFallback.js"; // ★ 터치 폴백 유틸

const introOptions = [
  { type: 'frame',  title: '캔버스형<br>전시 글 쓰기', bg: '#ffffff' },
  { type: 'plane',  title: '투명필름형<br>전시 글 쓰기', bg: '#b3b3b3' },
  { type: 'poster', title: '포스터<br>붙이기',        bg: '#d1ecff'  },
];

// ───────────────────────────────────────────────────────────────
// ★ 드래그 고스트(미리보기) 상태/유틸
let _ghostEl = null;
let _dragging = false;
let _dragStartX = 0, _dragStartY = 0;
const _DRAG_THRESHOLD = 4; // 픽셀 (클릭과 드래그 구분)
const GHOST_ANCHOR = 'center';
let _anchorX = 0, _anchorY = 0;

function makeGhost(nodeForSize, startX = 0, startY = 0) {
  const rect = nodeForSize?.getBoundingClientRect?.() || { width: 72, height: 72, left: startX, top: startY };
  const w = Math.max(48, rect.width);
  const h = Math.max(48, rect.height);

  // 앵커(커서 중앙)로 붙이기
  _anchorX = (GHOST_ANCHOR === 'center') ? w / 2 : Math.max(0, startX - rect.left);
  _anchorY = (GHOST_ANCHOR === 'center') ? h / 2 : Math.max(0, startY - rect.top);

  const el = document.createElement('div');
  el.className = 'drag-ghost';
  el.style.position = 'fixed';
  el.style.left = '0';
  el.style.top = '0';
  el.style.width = w + 'px';
  el.style.height = h + 'px';
  el.style.pointerEvents = 'none';
  el.style.opacity = '0.9';
  el.style.transform = 'translate(-9999px,-9999px)';
  el.style.willChange = 'transform';
  el.style.zIndex = '999999';
  el.style.borderRadius = '10px';   // ★ 둥근 모서리 인라인 강제
  el.style.overflow = 'hidden';     // ★ 내부 복제 노드를 모서리로 클립

  // ★ painting/artwall과 동일: 내부 래퍼를 두고 그 안에 클론을 넣는다
  const innerWrap = document.createElement('div');
  innerWrap.className = 'drag-ghost__inner';
  innerWrap.style.width = '100%';
  innerWrap.style.height = '100%';
  innerWrap.style.pointerEvents = 'none';
  innerWrap.style.borderRadius = 'inherit'; // ★ 부모 둥근 모서리 상속

  // 간단히 내부 마크업 복제(텍스트 라벨 보이게)
  try {
    const clone = nodeForSize.cloneNode(true);
    clone.removeAttribute('id');
    clone.style.pointerEvents = 'none';
    clone.style.margin = '0';
    clone.style.width = '100%';
    clone.style.height = '100%';
    innerWrap.appendChild(clone);
  } catch {
    innerWrap.textContent = nodeForSize?.textContent || '';
  }

  el.appendChild(innerWrap);
  document.body.appendChild(el);
  return el;
}

function posGhost(x, y) {
  if (!_ghostEl) return;
  _ghostEl.style.transform = `translate(${x - _anchorX}px, ${y - _anchorY}px)`;
}

function setDraggingUI(on) {
  document.body.classList.toggle('is-dragging', !!on);
  _dragging = !!on;
}

// ★ 포인터 기반 드래그(고스트) + 드롭 디스패치(유틸+전역 커스텀 이벤트)
// - painting/artwall과 동일한 사용자감 유지
function startPointerDragFromIntroGrid(eStart, introType, previewEl) {
  // 중복 드롭 방지 플래그 (이 요소가 폴백 click/touchend로 또 쏘지 않도록)
  eStart.currentTarget._usingPointerDrag = true; // ★

  if (!eStart.isPrimary && eStart.pointerType) return;
  if (eStart.cancelable) eStart.preventDefault();
  try { eStart.target.setPointerCapture?.(eStart.pointerId); } catch {}

  _dragStartX = eStart.clientX;
  _dragStartY = eStart.clientY;
  let moved = false;

  const move = (ev) => {
    if (ev.cancelable) ev.preventDefault();
    const dx = ev.clientX - _dragStartX;
    const dy = ev.clientY - _dragStartY;
    const passed = (Math.abs(dx) > _DRAG_THRESHOLD || Math.abs(dy) > _DRAG_THRESHOLD);

    if (!moved && passed) {
      setDraggingUI(true);
      _ghostEl = makeGhost(previewEl, _dragStartX, _dragStartY);
      posGhost(ev.clientX, ev.clientY);
    }
    if (moved) posGhost(ev.clientX, ev.clientY);
    moved = moved || passed;
  };

  const up = (ev) => {
    try { eStart.target.releasePointerCapture?.(eStart.pointerId); } catch {}
    window.removeEventListener('pointermove', move, { passive:false });
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);

    const x = ev.clientX, y = ev.clientY;

    if (_ghostEl) { _ghostEl.remove(); _ghostEl = null; }
    setDraggingUI(false);

    // 드래그 여부와 무관하게 드롭(탭 배치도 허용)
    try { dispatchSyntheticDrop('intro', { type: introType }, x, y); } catch {}
    window.dispatchEvent(new CustomEvent('touchdrop', {
      detail: { kind:'intro', payload:{ type:introType }, clientX:x, clientY:y }
    }));

    // ★ 짧은 지연 후 플래그 해제(연속 탭 대비)
    setTimeout(() => { eStart.currentTarget._usingPointerDrag = false; }, 0);
  };

  window.addEventListener('pointermove', move, { passive:false });
  window.addEventListener('pointerup', up, { once:true });
  window.addEventListener('pointercancel', up, { once:true });
}
// ───────────────────────────────────────────────────────────────

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
  const coarse = isCoarsePointer(); // ★ 포인터 특성 감지

  introOptions.forEach(({ type, title, bg }) => {
    // 컨테이너(드래그 소스)
    const box = document.createElement('div');
    box.classList.add('thumbnail'); // 공용 썸네일 스타일 재사용
    box.id = `intro${capitalize(type)}Thumb`;
    box.draggable = !coarse;           // ★ coarse(모바일/태블릿)에선 네이티브 DnD 비활성화
    box.style.background = bg;
    box.style.cursor = 'grab';
    // 터치에서 길게 눌러 드래그 전환 시 스크롤 과민도 완화
    box.style.touchAction = 'none';    // ★ 드래그 중 스크롤 억제(안정성 ↑)
    box.style.userSelect  = 'none';    // ★ 텍스트 선택 방지

    // 접근성/데이터
    box.setAttribute('tabindex', '0');         // 키보드 포커스 가능
    box.setAttribute('role', 'button');        // 의미 힌트
    box.dataset.introType = type;

    // 텍스트 라벨
    const label = document.createElement('span');
    label.innerHTML = title;
    label.classList.add('intro-label');
    label.style.pointerEvents = 'none';        // ★ 자식이 이벤트 가로채지 않도록
    box.appendChild(label);

    if (!coarse) {
      // ── 데스크톱: 네이티브 Drag & Drop
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
        document.body.classList.add('is-dragging');        // ★ paintingGrid처럼 바디 클래스 ON
      });

      // 드래그 종료/드롭: 시각 상태 정리
      const cleanup = () => {
        box.classList.remove('dragging');
        document.body.classList.remove('is-dragging');     // ★ paintingGrid처럼 바디 클래스 OFF
      };
      box.addEventListener('dragend', cleanup);
      box.addEventListener('drop', cleanup);

      // ★ 보강: 네이티브 DnD가 막히는 환경(크롬북 등)에서는 포인터 폴백 + 고스트 사용
      box.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return; // 좌클릭만
        startPointerDragFromIntroGrid(e, type, box);
      }, { passive:false });

    } else {
      // ── Android 등 터치 환경: 폴백(가짜 drop 캔버스로 디스패치)
      box.addEventListener('touchend', (e) => {
        if (box._usingPointerDrag) return; // ★ 포인터 드래그 중 중복 방지
        if (e.cancelable) e.preventDefault();
        const t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        // 유틸 + 전역 커스텀 이벤트 병행
        try { dispatchSyntheticDrop('intro', { type }, t.clientX, t.clientY); } catch {}
        window.dispatchEvent(new CustomEvent('touchdrop', {
          detail: { kind:'intro', payload:{ type }, clientX: t.clientX, clientY: t.clientY }
        }));
      }, { passive: false });

      // (선택) 탭으로도 배치 가능
      box.addEventListener('click', (e) => {
        if (box._usingPointerDrag) return; // ★ 포인터 드래그 중 중복 방지
        try { dispatchSyntheticDrop('intro', { type }, e.clientX, e.clientY); } catch {}
        window.dispatchEvent(new CustomEvent('touchdrop', {
          detail: { kind:'intro', payload:{ type }, clientX: e.clientX, clientY: e.clientY }
        }));
      });

      // ★ 터치/펜/크롬북: 포인터 폴백 + 고스트
      box.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        startPointerDragFromIntroGrid(e, type, box);
      }, { passive:false });
    }

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

    // ★★★ Android 등 터치 환경 폴백 DnD는 위에서 dispatchSyntheticDrop 사용으로 대체

    grid.appendChild(box);
  });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
