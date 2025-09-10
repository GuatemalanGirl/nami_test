// ui/textureGrid.js

import * as THREE from 'three';

import {
  // 전체 목록 접근(반응형 슬라이싱을 UI 레벨에서 보장)
  getTextureSets,
  getTextureSetByName,
  getTexturePage,
  setTexturePage,

  // 기존 API와도 호환 유지(있으면 사용, 없어도 동작)
  getTextureSetsByPage,
  getTotalTexturePages,
  // 반응형 페이지 크기 제어(있으면 활용)
  setTexturePageSize,
  getTexturePageSize
} from '../data/texture.js';

import {
  setSelectedTextureSet,
  getSelectedTextureSet,
  setConfirmedTextureSet,
  restoreTextureSet
} from '../domain/texture.js';

import { showPanel } from './panel.js';
import { setSkipCancelBackground } from '../domain/backgroundState.js';

import { markAsColorTexture } from '../core/colorManagement.js';

/* =========================================
   반응형(모바일/데스크톱) 페이지 크기 설정
   - 데스크톱: 9개(3×3)
   - 모바일(≤1024px): 4개(4×1)
   ========================================= */

const MOBILE_Q = '(max-width: 1180px)';

/** 현재 뷰포트에서 페이지당 썸네일 개수(4 or 9) */
function getActivePageSize() {
  return window.matchMedia(MOBILE_Q).matches ? 4 : 9;
}

/**
 * 뷰포트에 맞춰 페이지 크기(9↔4) 적용 + 리렌더
 * - 최초 1회 호출 후, 미디어쿼리 변화에도 자동 반영
 */
export function initTextureGridResponsive(applyPreviewTextureSet) {
  const mq = window.matchMedia(MOBILE_Q);

  const apply = () => {
    const nextSize = getActivePageSize();

    // data 모듈이 동적 pageSize를 지원한다면 함께 동기화(선택적)
    if (typeof getTexturePageSize === 'function' &&
        typeof setTexturePageSize === 'function') {
      if (getTexturePageSize() !== nextSize) {
        setTexturePageSize(nextSize);
        setTexturePage(0);
      }
    } else {
      // data 모듈이 9 고정이어도 UI 레벨에서 4/9 슬라이스를 보장하므로 OK
      setTexturePage(0);
    }

    populateTextureGrid(applyPreviewTextureSet);
    updateTexturePageButtons();
  };

  apply();

  // 미디어쿼리 변화 대응
  if (mq.addEventListener) mq.addEventListener('change', apply);
  else if (mq.addListener) mq.addListener(apply); // 구형 폴백
}

/** 썸네일 그리드 생성 (페이지 단위 — 항상 4/9개만 DOM에 렌더) */
export function populateTextureGrid(applyPreviewTextureSet) {
  const grid = document.getElementById("backgroundGrid");
  if (!grid) return;
  grid.innerHTML = ""; // 초기화

  // 항상 UI 레벨에서 4/9개로 슬라이스 — data 모듈이 9 고정이어도 안전
  const all = typeof getTextureSets === 'function' ? getTextureSets() : [];
  const page = getTexturePage();
  const size = getActivePageSize();
  const start = page * size;
  const sets = all.length
    ? all.slice(start, start + size)
    // (호환) 만약 getTextureSets가 없다면 구형 API로 fallback
    : (typeof getTextureSetsByPage === 'function' ? getTextureSetsByPage() : []);

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
  if (!prev || !next) return;

  // 4/9 기준으로 총 페이지 재계산(UI 레벨)
  const total = typeof getTextureSets === 'function' ? getTextureSets().length : 0;
  const size = getActivePageSize();
  const maxPage = Math.max(0, Math.ceil(total / size) - 1);
  const current = getTexturePage();

  const prevDisabled = current <= 0;
  const nextDisabled = current >= maxPage;

  // 기존 disabled 유지(호환), + 이미지는 disabled가 안 먹으니 접근성/스타일로도 처리
  prev.disabled = prevDisabled;
  next.disabled = nextDisabled;

  setNavDisabled(prev, prevDisabled);
  setNavDisabled(next, nextDisabled);
}

function setNavDisabled(el, disabled) {
  if (!el) return;
  // 접근성
  el.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  // 스타일 토글(스타일시트에서 .is-disabled { opacity:.3; pointer-events:none; } 등 적용 가능)
  el.classList.toggle('is-disabled', !!disabled);
  // 방어: CSS가 없더라도 동작 보장
  el.style.pointerEvents = disabled ? 'none' : '';
  el.style.opacity = disabled ? '0.35' : '';
}

/** Prev/Next 페이징 이벤트 등록 */
export function setupTexturePagination(applyPreviewTextureSet) {
  const prevBtn = document.getElementById("prevBgPageBtn");
  const nextBtn = document.getElementById("nextBgPageBtn");

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      // aria-disabled 방어
      if (prevBtn.getAttribute('aria-disabled') === 'true') return;

      let page = getTexturePage();
      if (page > 0) {
        setTexturePage(page - 1);
        populateTextureGrid(applyPreviewTextureSet);
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (nextBtn.getAttribute('aria-disabled') === 'true') return;

      // 4/9 기준으로 총 페이지 재계산(UI 레벨)
      const total = typeof getTextureSets === 'function' ? getTextureSets().length : 0;
      const size = getActivePageSize();
      const maxPage = Math.max(0, Math.ceil(total / size) - 1);

      let page = getTexturePage();
      if (page < maxPage) {
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
    // floor는 색상 텍스처 -> sRGB 지정
    markAsColorTexture(tex);
    floorTex = tex;
    if (++loaded === 3) updateRoomTextures(scene, floorTex, ceilingTex, wallsTex);
  });

  textureLoader.load(set.ceiling, (tex) => {
    // ceiling도 색상 텍스처
    markAsColorTexture(tex);
    ceilingTex = tex;
    if (++loaded === 3) updateRoomTextures(scene, floorTex, ceilingTex, wallsTex);
  });

  textureLoader.load(set.walls, (tex) => {
    // walls(앞/뒤/좌/우 공통)도 색상 텍스처
    markAsColorTexture(tex);
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
    if (mesh && texture) {
      // 이전 텍스처 정리(메모리 누수 방지)
      const old = mesh.material?.map;
      if (old && old !== texture && typeof old.dispose === 'function') {
        try { old.dispose(); } catch {}
      }

      // 색상 텍스처 안전망(혹시 빠졌을 경우)
      markAsColorTexture(texture);

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
  // 🔧 보너스: id/클래스 둘 다 지원(패널별로 다를 때 대비)
  const button =
    document.querySelector('#panel-background .saveExhibitButton')
    || document.getElementById("applyBackgroundButton");
  if (!button) return;

  button.addEventListener("click", () => {
    const set = getSelectedTextureSet();
    if (!set) return;

    setConfirmedTextureSet(set); // setter로 확정
    applyPreviewTextureSet(set, scene, textureLoader);
    localStorage.setItem("selectedTextureSet", set);

    setSkipCancelBackground(true); // 롤백 스킵
    // 주의: camera, controls는 상위 스코프/모듈에서 관리되는 것으로 가정
    showPanel("panel-main", camera, controls); // 메인으로 복귀
    setSkipCancelBackground(false); // 플래그 초기화
  });
}