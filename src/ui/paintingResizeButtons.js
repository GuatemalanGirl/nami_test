// ui/paintingResizeButtons.js

// 상태 플래그를 모듈 범위로 이동 (전역 변수 대신)
let isResizingPainting = false; // 크기조절 모드 여부

// 필요한 외부 함수/상수 import
import { getPaintingMode } from '../domain/paintingMode.js'; // 작품선택 모드 여부
import { showOutline } from './outline.js'; // 테두리 표시
import { showPaintingEditButtons } from './paintingEditButtons.js'; // 편집 버튼 표시
import { updateIntroTextScale } from '../domain/intro.js'; // 텍스트 크기 갱신
import { createResizeHandle, removeResizeHandle } from './resizeHandle.js';
import { updateIntroTextPlane, updateIntroTextPlaneFromHTML } from './updateIntroTextPlane.js';

// 하단 버튼 영역 DOM (필요하다면 인자로 넘길 수도 있음)
const editingButtonsDiv = document.getElementById('paintingEditButtons');

/* ──────────────────────────────────────────────
 * 유틸: 확인 직후 mesh가 교체되어도 최신 대상/scene 확보
 * ────────────────────────────────────────────── */
function resolveFreshTarget(mesh, scene) {
  if (mesh?.parent) return mesh;
  // 이름을 보존하는 흐름이라면 name으로 우선 탐색
  const byName = scene?.getObjectByName?.(mesh?.name);
  if (byName) return byName;
  // userData.id를 보존한다면 이것도 시도 가능
  if (mesh?.userData?.id && typeof scene?.getObjectByProperty === 'function') {
    const byId = scene.getObjectByProperty('userData.id', mesh.userData.id);
    if (byId) return byId;
  }
  return mesh; // 그래도 못 찾으면 원본 리턴(내부 가드들이 방어)
}

/**
 * 작품(페인팅) 편집 모드에서만 사용되는
 * 리사이즈 버튼 UI 및 관련 로직을 관리합니다.
 * (전시서문, intro에는 사용되지 않습니다.)
 */
export function showPaintingResizeButtons(mesh, scene, camera, controls, quill) {
  setIsResizingPainting(true);

  // 5가지 고정 배율값
  const scaleList = [
    { label: "6호", value: 0.5 },
    { label: "12호", value: 0.67 },
    { label: "25호", value: 1 },
    { label: "50호", value: 1.5 },
    { label: "100호", value: 2 },
  ];

  // mesh의 원본스케일을 userData에 보관 (최초 진입시에만)
  if (!mesh.userData.originalScale) {
    mesh.userData.originalScale = mesh.scale.clone();
  }
  // 현재 배율 값도 없으면 1로
  if (mesh.userData.scaleValue === undefined) {
    mesh.userData.scaleValue = 1;
  }

  const orig = mesh.userData.originalScale;
  let currentScaleValue = mesh.scale.x / orig.x;

  // "작품(그림)이면서 intro 아님"일 때만 크기버튼 생성
  const isArtwork =
    mesh.userData.isPainting &&
    !mesh.userData.type?.startsWith("intro") &&
    mesh.userData.type !== 'poster'; // ← 포스터는 프리셋 버튼 숨김(핸들러로만 조절)
  let html = "";

  if (isArtwork && getPaintingMode()) {
    html += `
      <div class="preset-row" style="display:flex;gap:8px;justify-content:center;margin-bottom:12px;">
        ${scaleList
          .map(
            (s) =>
              `<button class="icon-btn md" data-scale="${s.value}">${s.label}</button>`
          )
          .join("")}
      </div>
    `;
  }

  html += `
    <div class="action-row" style="display:flex;gap:8px;justify-content:center;">
      <button id="resizeOkBtn" class="icon-btn md">
        <img src="/icons/apply.svg" alt="확인" />
      </button>
      <button id="resizeCancelBtn" class="icon-btn md">
        <img src="/icons/back.svg" alt="취소" />
      </button>
    </div>
  `;

  editingButtonsDiv.innerHTML = html;
  editingButtonsDiv.style.display = "block"; // 버튼 영역 보이기

  // 크기버튼이 존재할 때만 (작품일 때만)
  if (isArtwork && getPaintingMode()) {
    mesh.userData.tempScaleValue = currentScaleValue; // 임시 선택값

    // 각 배율 버튼 클릭시
    document.querySelectorAll("[data-scale]").forEach((btn) => {
      if (parseFloat(btn.getAttribute("data-scale")) === currentScaleValue) {
        btn.classList.add("active");
      }

      btn.onclick = () => {
        // 클릭 시점마다 최신 대상 보장
        const target = resolveFreshTarget(mesh, scene);

        target.userData.tempScaleValue = parseFloat(btn.getAttribute("data-scale"));
        // 원본스케일 x 선택배율
        const orig = target.userData.originalScale;
        target.scale.set(
          orig.x * target.userData.tempScaleValue,
          orig.y * target.userData.tempScaleValue,
          orig.z,
        );

        updateIntroTextScale(target);

        // 버튼 하이라이트 효과 (active 클래스 토글)
        document.querySelectorAll("[data-scale]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        // outline도 배율 바뀔 때마다 갱신
        createResizeHandle(target, scene);
        showOutline(target, scene);
      };
    });
  }

  // 확인 버튼
  document.getElementById("resizeOkBtn").onclick = () => {
    // 클릭 시점마다 최신 대상 보장
    const target = resolveFreshTarget(mesh, scene);

    // mesh에 최종값 저장
    target.userData.scaleValue = target.userData.tempScaleValue;

    updateIntroTextScale(target);

    // 크기조절 시 텍스트 크기도 비율에 맞게 갱신
    if (target.userData.text && target.userData.html) {
      updateIntroTextPlaneFromHTML(target, target.userData.html);
    } else if (target.userData.text) {
      updateIntroTextPlane(target, target.userData.text, {
        fontFamily: target.userData.fontFamily,
        fontSize: target.userData.fontSize,
        color: target.userData.fontColor,
      });
    }
    // 이미 scale 적용됨
    setIsResizingPainting(false);

    removeResizeHandle(scene); // 핸들 제거

    showPaintingEditButtons(target, scene, camera, controls, quill);
  };

  // 취소 버튼
  document.getElementById("resizeCancelBtn").onclick = () => {
    // 클릭 시점마다 최신 대상 보장
    const target = resolveFreshTarget(mesh, scene);

    // 원래 크기로 복귀
    const orig = target.userData.originalScale;
    target.scale.set(
      orig.x * currentScaleValue,
      orig.y * currentScaleValue,
      orig.z,
    );

    // outline 복구 (removeOutline가 내부에서 안전 가드)
    showOutline(target, scene);

    setIsResizingPainting(false);

    removeResizeHandle(scene); // 핸들 제거

    showPaintingEditButtons(target, scene, camera, controls, quill);
  };
}

/**
 * 현재 리사이즈 중 상태 반환 (외부에서 필요시)
 */
export function getIsResizingPainting() {
  return isResizingPainting;
}

export function setIsResizingPainting(val) {
  isResizingPainting = val;
}
