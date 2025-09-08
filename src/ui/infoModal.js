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

/**
 * 그림 정보 모달(infoModal)을 열고, 데이터를 채움
 * @param {Object} data - 그림 메타데이터
 * @param {THREE.Mesh} mesh - 선택된 그림의 3D 객체
 * @param {boolean} isPaintingMode - 그림선택 모드 여부
 */
export function showInfo(data, mesh) {
  // 초기 간단 표시 (구버전 호환용)
  document.getElementById("infoContent").innerHTML =
    `<h2>${(data?.title_kor || data?.title || "(제목 없음)")} ${data?.title_eng ? `<small>(${data.title_eng})</small>` : ""}</h2>
     <p>${data?.description || ""}</p>`;

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

  modal.style.display = "none";

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
    // 주입된 컨텍스트가 있을 때만 전체 인자 전달
    if (renderCtx?.scene && renderCtx?.camera && renderCtx?.controls && renderCtx?.quill) {
      showPaintingEditButtons(selectedPainting, renderCtx.scene, renderCtx.camera, renderCtx.controls, renderCtx.quill);
    } else {
      // 안전 경로: 최소 인자만 (라이브러리 시그니처에 따라 다를 수 있음)
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
  const infoContent = document.getElementById("infoContent")
  if (!infoContent) return

  /* userData.story가 있으면 사용자 설명, 아니면 기본 설명
  const html = mesh.userData.story || (mesh.userData.data && mesh.userData.data.description) || '(설명 없음)';
  infoContent.innerHTML = html;*/

  const data = mesh?.userData?.data || {}
  const story = (mesh?.userData?.story || "").trim()
    ? mesh.userData.story
    : data.description || "(설명 없음)"

  // 새 메타데이터 구조 반영 (소제목 없이 그대로 출력)
  const titleKor = data.title_kor || "(제목 없음)"
  const titleEng = data.title_eng ? `(${data.title_eng})` : ""
  const artistKor = data.artist_kor || ""
  const artistEng = data.artist_eng || ""
  const mediumYear = data.medium_year || ""
  const dimensions = data.dimensions || ""

  infoContent.innerHTML = `
    <h2>${titleKor} <small>${titleEng}</small></h2>
    <p>${artistKor}<br>${artistEng}</p>
    <p>${mediumYear}</p>
    <p>${dimensions}</p>
    <p class="description">${story}</p>
  `

  // 필요 시에만 열기: 이미 열려있다면 상태 유지
  const modal = document.getElementById("infoModal")
  if (modal && getComputedStyle(modal).display === "none") {
    modal.style.display = "flex"   // flex로 열어야 모바일 레이아웃 정상
  }
}
