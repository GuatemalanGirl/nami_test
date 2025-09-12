// ui/infoModal.js

import { showPaintingEditButtons, hidePaintingEditButtons } from './paintingEditButtons.js'
import { globalInputBlocker } from './globalInputBlocker.js';
import { getPaintingMode } from '../domain/paintingMode.js';
import { getIntroMode } from '../domain/introMode.js';
import { getSelectedPainting } from '../domain/painting.js';

/* 렌더/에디터 컨텍스트(전역 대체) 주입용 */
let renderCtx = null;
/**
 * 앱 초기화 시 한 번 호출해서 scene/camera/controls/quill을 주입한다.
 * 기대 형태: { scene, camera, controls, quill }
 */
export function initInfoModal(ctx) {
  renderCtx = ctx || null;
}

/** -----------------------------------------------------------------------
 * 내부 컨테이너 보장:
 * - #infoContent : flex 컨텍스트 (min-height:0)
 * - .description : 스크롤 컨테이너 (div로 고정)
 * 기존 주석/기능 유지하면서, 편집 후에도 스크롤이 항상 살아있도록 보강.
 * ---------------------------------------------------------------------- */
function ensureInfoContainers() {
  const modal = document.getElementById('infoModal');
  if (!modal) return { infoContent: null, desc: null, metaWrap: null };

  // #infoContent 보장
  let infoContent = modal.querySelector('#infoContent');
  if (!infoContent) {
    infoContent = document.createElement('div');
    infoContent.id = 'infoContent';
    // CSS 로드 순서가 꼬여도 안전하게 동작하도록 인라인 보강(있어도 무해)
    infoContent.style.display = 'flex';
    infoContent.style.flexDirection = 'column';
    infoContent.style.flex = '1 1 auto';
    infoContent.style.minHeight = '0';
    modal.appendChild(infoContent);
  }

  // .description 보장 (p가 있을 경우 div로 교체)
  let desc = infoContent.querySelector('.description');
  if (!desc) {
    desc = document.createElement('div');
    desc.className = 'description';
    infoContent.appendChild(desc);
  } else if (desc.tagName !== 'DIV') {
    const newDesc = document.createElement('div');
    newDesc.className = 'description';
    newDesc.innerHTML = desc.innerHTML; // 기존 내용 보존
    infoContent.replaceChild(newDesc, desc);
    desc = newDesc;
  }

  // 메타 전용 래퍼 (.info-meta-wrap) 보장 — 본문(.description) 앞에 위치
  let metaWrap = infoContent.querySelector('.info-meta-wrap');
  if (!metaWrap) {
    metaWrap = document.createElement('div');
    metaWrap.className = 'info-meta-wrap';
    infoContent.insertBefore(metaWrap, desc);
  }

  return { infoContent, desc, metaWrap };
}

/**
 * 그림 정보 모달(infoModal)을 열고, 데이터를 채움
 * @param {Object} data - 그림 메타데이터
 * @param {THREE.Mesh} mesh - 선택된 그림의 3D 객체
 * @param {boolean} isPaintingMode - 그림선택 모드 여부
 */
export function showInfo(data, mesh) {
  // 초기 간단 표시 (구버전 호환용)
  // (유지하되 동작은 비활성) .description이 날아가지 않도록 전체 innerHTML 교체는 중단
  // const infoContent = document.getElementById("infoContent");
  // if (infoContent) {
  //   infoContent.innerHTML =
  //     `<h2 class="info-title">${(data?.title_kor || data?.title || "(제목 없음)")}
  //        ${data?.title_eng ? `<small>(${data.title_eng})</small>` : ""}</h2>
  //      <div class="info-meta">
  //        <p>${data?.description || ""}</p>
  //      </div>`;
  // }

  // 모달은 flex로 열어야 내부 스크롤/레이아웃이 유지됨
  const modal = document.getElementById("infoModal");
  if (modal) modal.style.display = "flex";

  // 작품선택모드일 때만 전역 클릭 차단 리스너 등록
  if (getPaintingMode()) {
    document.addEventListener("mousedown", globalInputBlocker, true);
    document.addEventListener("touchstart", globalInputBlocker, true);
  }

  updatePaintingInfo(mesh); // 설명창 내부 세부 항목 업데이트
}

/**
 * 그림 정보 모달을 닫고, 필요한 UI 요소 정리
 * @param {boolean} isPaintingMode - 그림선택 모드 여부
 * @param {boolean} isIntroMode - 서문 프레임 모드 여부
 * @param {THREE.Mesh | null} selectedPainting - 선택된 그림 객체
 */
export function closeInfo() {
  const modal = document.getElementById("infoModal");
  if (!modal) return;

  modal.style.display = "none"; // 닫을 때는 none

  // 스토리 편집 완료 전용 위치 클래스 제거 (다음에 열릴 때는 기본 위치)
  modal.classList.remove("story-finished");

  // 리스너 해제(작품선택모드일 때만)
  document.removeEventListener("mousedown", globalInputBlocker, true);
  document.removeEventListener("touchstart", globalInputBlocker, true);

  // 도메인 getter로 상태를 확인
  const isPaintingMode = getPaintingMode();
  const isIntroMode = getIntroMode();
  const selectedPainting = getSelectedPainting();

  // 작품선택모드(또는 서문쓰기모드)일 때만 버튼 복원
  if ((isPaintingMode || isIntroMode) && selectedPainting) {
    if (renderCtx?.scene && renderCtx?.camera && renderCtx?.controls && renderCtx?.quill) {
      showPaintingEditButtons(selectedPainting, renderCtx.scene, renderCtx.camera, renderCtx.controls, renderCtx.quill);
    } else {
      try { showPaintingEditButtons(selectedPainting); } catch (_) {}
    }
  } else {
    hidePaintingEditButtons();
  }
}

/**
 * 그림 정보 모달의 내부 콘텐츠를 업데이트
 * @param {THREE.Mesh} mesh - 선택된 그림의 3D 객체
 */
export function updatePaintingInfo(mesh) {
  // 컨테이너/스크롤 구조 보장 (#infoContent / .info-meta-wrap / .description)
  const { infoContent, desc, metaWrap } = ensureInfoContainers();
  if (!infoContent || !desc || !metaWrap) return;

  const data = mesh?.userData?.data || {}
  const story = (mesh?.userData?.story || "").trim()
    ? mesh.userData.story
    : data.description || "(설명 없음)"

  // 새 메타데이터 구조 반영 (소제목 없이 그대로 출력)
  const titleKor = data.title_kor || "(제목 없음)"
  const titleEng = data.title_eng ? `${data.title_eng}` : ""
  const artistKor = data.artist_kor || ""
  const artistEng = data.artist_eng || ""
  const mediumYear = data.medium_year || ""
  const dimensions = data.dimensions || ""

  // 메타만 갱신: infoContent 전체를 갈아엎지 말 것 (description 유지)
  metaWrap.innerHTML = `
    <h2 class="info-title">${titleKor} <small>${titleEng}</small></h2>
    <div class="info-meta">
      <p class="artist">${artistKor}${artistEng ? `<br>${artistEng}` : ""}</p>
      <p class="year">${mediumYear}</p>
      <p class="size">${dimensions}</p>
    </div>
  `;

  // 본문은 스크롤 컨테이너(.description)에만 주입
  desc.innerHTML = story;
  desc.scrollTop = 0;

  // 필요 시에만 열기: 이미 열려있다면 상태 유지
  const modal = document.getElementById("infoModal")
  if (modal && getComputedStyle(modal).display === "none") {
    modal.style.display = "flex"   // flex로 열어야 모바일 레이아웃 정상
  }
}