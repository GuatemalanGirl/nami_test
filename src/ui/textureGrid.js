// ui/textureGrid.js

import {
  getTextureSetsByPage,
  getTextureSetByName,
  getTexturePage,
  getTotalTexturePages,
  setTexturePage
} from '../data/texture.js';

import {
  setSelectedTextureSet,
  getSelectedTextureSet,
  setConfirmedTextureSet,
  restoreTextureSet
} from '../domain/texture.js';

import { showPanel } from './panel.js';
import { setSkipCancelBackground } from '../domain/backgroundState.js';

/** 썸네일 그리드 생성 (페이지 단위 3×3 = 9개) */
export function populateTextureGrid(applyPreviewTextureSet) {
  const grid = document.getElementById("backgroundGrid");
  if (!grid) return;
  grid.innerHTML = ""; // 초기화

  // 현재 페이지에 맞는 9개만 가져오기
  const sets = getTextureSetsByPage();
  sets.forEach((set) => {
    const div = document.createElement("div");
    div.className = "texture-option";
    div.setAttribute("data-set", set.set);

    // 썸네일 + set명 표시 (원하면 title 등도 추가 가능)
    div.innerHTML = `<img src="${set.thumb}" alt="${set.set}">`;

    // 클릭: 미리보기 + 선택 시각화
    div.addEventListener("click", () => {
      setSelectedTextureSet(set.set); // setter 함수 사용
      applyPreviewTextureSet(set.set);

      // 직접 클래스 토글
      document.querySelectorAll(".texture-option").forEach(opt =>
        opt.classList.remove("is-selected")
      );
      div.classList.add("is-selected");
    });

    grid.appendChild(div);
  });

  // 페이지 버튼 상태 업데이트
  updateTexturePageButtons();
}

/** 페이지 버튼 상태 업데이트 */
function updateTexturePageButtons() {
  const prev = document.getElementById("prevBgPageBtn");
  const next = document.getElementById("nextBgPageBtn");
  const current = getTexturePage();
  const maxPage = getTotalTexturePages() - 1;

  if (!prev || !next) return;

  prev.disabled = current === 0;
  next.disabled = current >= maxPage;
}

/** Prev/Next 페이징 이벤트 등록 */
export function setupTexturePagination(applyPreviewTextureSet) {
  const prevBtn = document.getElementById("prevBgPageBtn");
  const nextBtn = document.getElementById("nextBgPageBtn");

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      let page = getTexturePage();
      if (page > 0) {
        setTexturePage(page - 1);
        populateTextureGrid(applyPreviewTextureSet);
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      let page = getTexturePage();
      if (page < getTotalTexturePages() - 1) {
        setTexturePage(page + 1);
        populateTextureGrid(applyPreviewTextureSet);
      }
    });
  }
}

/** 미리보기 적용 */
export function applyPreviewTextureSet(setName, scene, textureLoader) {
  const set = getTextureSetByName(setName);
  if (!set) return;

  // 3개 텍스처를 모두 비동기로 로드 (콜백 내부에서만 적용)
  let loaded = 0;
  let floorTex, ceilingTex, wallsTex;

  textureLoader.load(set.floor, (tex) => {
    floorTex = tex;
    if (++loaded === 3) updateRoomTextures(scene, floorTex, ceilingTex, wallsTex);
  });
  textureLoader.load(set.ceiling, (tex) => {
    ceilingTex = tex;
    if (++loaded === 3) updateRoomTextures(scene, floorTex, ceilingTex, wallsTex);
  });
  textureLoader.load(set.walls, (tex) => {
    wallsTex = tex;
    if (++loaded === 3) updateRoomTextures(scene, floorTex, ceilingTex, wallsTex);
  });
}

/** 실제 텍스처 적용 */
export function updateRoomTextures(scene, floorTex, ceilingTex, wallTex) {
  const targets = [
    { name: "floor",   texture: floorTex },
    { name: "ceiling", texture: ceilingTex },
    { name: "back",    texture: wallTex },
    { name: "front",   texture: wallTex },
    { name: "left",    texture: wallTex },
    { name: "right",   texture: wallTex }
  ];

  targets.forEach(({ name, texture }) => {
    const mesh = scene.getObjectByName(name);
    if (mesh) {
      mesh.material.map = texture;
      mesh.material.needsUpdate = true; // 텍스처 바꿨으면 업데이트 필요
    }
  });
}

/** 롤백 함수 */
export function onRestoreTextureSet(scene) {
  restoreTextureSet(scene, applyPreviewTextureSet);
}

/** “적용” 버튼 클릭 시: 확정 적용 & 저장 & 플래그 */
export function setupApplyButton(scene, textureLoader) {
  const button = document.getElementById("applyBackgroundButton");
  if (!button) return;

  button.addEventListener("click", () => {
    const set = getSelectedTextureSet();
    if (!set) return;

    setConfirmedTextureSet(set); // setter로 확정
    applyPreviewTextureSet(set, scene, textureLoader);
    localStorage.setItem("selectedTextureSet", set);

    setSkipCancelBackground(true); // 롤백 스킵
    showPanel("panel-main", camera, controls); // 메인으로 복귀
    setSkipCancelBackground(false); // 플래그 초기화
  });
}
