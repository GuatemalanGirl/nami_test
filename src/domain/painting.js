// domain/painting.js

import * as THREE from "three";
import {
  ROOM_WIDTH,
  ROOM_DEPTH,
  PAINTING_Y_OFFSET,
  WALL_OFFSET,
  PAINTING_WIDTH_LIMIT,
  PAINTING_HEIGHT_LIMIT
} from "../core/constants.js";
import { setPaintingMode } from "./paintingMode.js";
import { updatePaintingOrderByPosition } from "../core/order.js";
import { hidePaintingEditButtons } from "../ui/paintingEditButtons.js";
import { endEditingPainting } from "./paintingEditing.js";
import { removeResizeHandle } from "../ui/resizeHandle.js"; // 리사이즈 핸들 정리용

/* === 내부 상태 배열 (외부에서 직접 export하지 않음) === */
let paintings = [];              // 전체 그림(작품) mesh 배열
let originalPaintings = [];      // 이전 상태 저장(undo/취소 등)
let originalPaintingsState = []; // 작품선택 모드 진입 시 위치/회전 등 상세 백업
let tempPaintings = [];          // 임시 배치 그림(적용 전 상태)
let selectedPainting = null;     // 현재 선택된 그림(mesh) 상태


/* === paintings 관련 getter/setter === */
// 전체 그림 리스트 반환
export function getPaintings() { return paintings; }
// 그림 추가
export function addPainting(mesh) { paintings.push(mesh); }
// 그림 삭제
export function removePainting(mesh) {
  const idx = paintings.indexOf(mesh);
  if (idx !== -1) paintings.splice(idx, 1);
}
// 전체 비우기
export function clearPaintings() { paintings.length = 0; }

/* === originalPaintings 관련 getter/setter === */
export function getOriginalPaintings() { return originalPaintings; }
export function setOriginalPaintings(arr) {
  originalPaintings.length = 0;
  originalPaintings.push(...arr);
}
export function clearOriginalPaintings() { originalPaintings.length = 0; }

/* === originalPaintingsState 관련 getter/setter === */
export function getOriginalPaintingsState() { return originalPaintingsState; }
export function setOriginalPaintingsState(arr) {
  originalPaintingsState.length = 0;
  originalPaintingsState.push(...arr);
}
export function clearOriginalPaintingsState() { originalPaintingsState.length = 0; }

/* === tempPaintings 관련 getter/setter === */
export function getTempPaintings() { return tempPaintings; }
export function addTempPainting(mesh) { tempPaintings.push(mesh); }
export function removeTempPainting(mesh) {
  const idx = tempPaintings.indexOf(mesh);
  if (idx !== -1) tempPaintings.splice(idx, 1);
}
export function clearTempPaintings() { tempPaintings.length = 0; }

/* === 주요 그림/상태 처리 함수 === */

/**
 * 벽 정의에 맞춰 모든 그림 자동 배치
 */
export async function placePaintings({
  scene,
  textureLoader,
  paintings,
  paintingsData // 이미 fetch 로 받아 둔 배열
}) {
  const wallDefs = [
    { axis: "x", constVal:  ROOM_DEPTH / 2 - WALL_OFFSET, width: ROOM_WIDTH, rotY:  Math.PI,    reverse: false },
    { axis: "z", constVal:  ROOM_WIDTH / 2 - WALL_OFFSET, width: ROOM_DEPTH, rotY: -Math.PI/2,  reverse: true  },
    { axis: "x", constVal: -ROOM_DEPTH / 2 + WALL_OFFSET, width: ROOM_WIDTH, rotY:  0,          reverse: true  },
    { axis: "z", constVal: -ROOM_WIDTH / 2 + WALL_OFFSET, width: ROOM_DEPTH, rotY:  Math.PI/2,  reverse: false }
  ];

  const paintingsPerWall = Math.ceil(paintingsData.length / 4); // 유동적 계산
  let globalIndex = 0;

  for (const wall of wallDefs) {
    const start = -wall.width / 2 + wall.width / (paintingsPerWall * 2);
    const spacing = wall.width / paintingsPerWall;

    for (let i = 0; i < paintingsPerWall; i++) {
      if (globalIndex >= paintingsData.length) return; // 남은 데이터 없으면 중단

      const pos = new THREE.Vector3();
      const localIndex = wall.reverse ? paintingsPerWall - 1 - i : i;

      if (wall.axis === "x") {
        pos.x = start + localIndex * spacing;
        pos.z = wall.constVal;
      } else {
        pos.z = start + localIndex * spacing;
        pos.x = wall.constVal;
      }
      pos.y = PAINTING_Y_OFFSET;

      await loadAndAddPainting({
        scene,
        textureLoader,
        paintings,
        data: paintingsData[globalIndex],
        position: pos,
        rotationY: wall.rotY
      });

      globalIndex++;
    }
  }
}

/**
 * 단일 그림(작품) 로드 및 scene, paintings에 추가
 */
export async function loadAndAddPainting({
  scene,
  textureLoader,
  paintings,
  data, // { filename, title, … }
  position, // THREE.Vector3
  rotationY // number (rad)
}) {
  return new Promise((resolve, reject) => {
    const url =
      `https://raw.githubusercontent.com/GuatemalanGirl/mygallery/refs/heads/main/paintings/${data.filename}`;

    textureLoader.load(
      url,
      (texture) => {
        /* ── 크기 계산 ───────────────────────────── */
        const aspect  = texture.image.width / texture.image.height;
        let   width   = PAINTING_WIDTH_LIMIT;
        let   height  = width / aspect;
        if (height > PAINTING_HEIGHT_LIMIT) {
          height = PAINTING_HEIGHT_LIMIT;
          width  = height * aspect;
        }

        const depth = 0.1; // 그림의 두께
        const geo  = new THREE.BoxGeometry(width, height, depth);

        const matFront = new THREE.MeshBasicMaterial({ map: texture }); // 앞면
        const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const materials = [
          whiteMat, whiteMat, whiteMat, whiteMat, matFront, whiteMat
        ];

        const mesh = new THREE.Mesh(geo, materials);

        /* ── 위치 ‧ 회전 & 살짝 앞쪽으로 ───────────── */
        mesh.position.copy(position);
        mesh.rotation.y = rotationY;

        // 그림을 정면으로 밀어주기
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);
        mesh.position.add(forward.multiplyScalar(depth / 2));

        /* ── userData & scene 등록 ───────────────── */
        mesh.userData = { isPainting: true, data };
        mesh.userData.originalScale = mesh.scale.clone(); // 원래 크기 저장 (크기조절 핸들러)

        scene.add(mesh);
        addPainting(mesh); // paintings 배열 대신 addPainting() 사용
        resolve(mesh);
      },
      undefined,
      reject
    );
  });
}

/**
 * 그림(작품) 전체 상태 스냅샷 (undo/편집취소/롤백용)
 */
export function snapshotPaintingState() {
  const paints = getPaintings();
  if (!paints) return;

  setOriginalPaintings(paints);

  clearTempPaintings();
  clearOriginalPaintingsState();

  paints.forEach((mesh) => {
    originalPaintingsState.push({
      mesh,
      position: mesh.position.clone(),
      rotation: mesh.rotation.clone(),
      scale: mesh.scale.clone(),
      story:
        mesh.userData.story || // 사용자가 작성한 그림이야기
        mesh.userData.data?.description || // 그림이야기 metadata.json 원본
        '',
    });
  });
}

// ─────────────────────────────────────────────────────────────
// 작품 캡션 생성/부착 유틸
// 우측-중하단에 상대 좌표로 붙는다. 부모가 이동/회전/스케일 시 자동 추종.
// BoxGeometry인 작품에만 생성한다.
// ─────────────────────────────────────────────────────────────
export function attachCaptionBox(parentMesh) {
  try {
    // 이미 붙어있으면 중복 생성 방지
    if (!parentMesh || parentMesh.getObjectByName?.('captionBox')) return;
    if (!parentMesh.geometry || parentMesh.geometry.type !== 'BoxGeometry') return;

    // 부모 지오메트리 원본 파라미터 (폭·높이·깊이)
    const g = parentMesh.geometry.parameters || {};
    const baseW = g.width  ?? 1;
    const baseH = g.height ?? 1;
    const baseD = g.depth  ?? 0.2;

    // 고정 크기(월드 좌표 기준)
    const CAPTION_W = 0.20;  
    const CAPTION_H = 0.35;
    const CAPTION_D = 0.03;

    // 월드에서의 간격 (부모 스케일 무관)
    const MARGIN_SIDE   = 0.2; // 작품과의 가로 간격
    const MARGIN_BOTTOM = 0.3; // 하단 간격
    const WALL_EPS      = 0.001; // 벽면과 겹침 방지 여유

    // 자식 박스는 항상 "고정 크기"로 생성
    const childW = CAPTION_W;
    const childH = CAPTION_H;
    const childD = CAPTION_D;

    const geom = new THREE.BoxGeometry(childW, childH, childD);
    const mat  = new THREE.MeshBasicMaterial({ color: 0xf6f6f6 }); // 캡션 색상
    const child = new THREE.Mesh(geom, mat);
    child.name = 'captionBox';
    child.userData = {
      ...(child.userData || {}),
      type: 'caption', // 캡션 타입
      parentPaintingId: parentMesh.uuid,
      actsAsInfoProxy: true, // 클릭 시 info 모달 프록시
      blocksEditing: true // 편집용 선택 차단 플래그
    };

    // 부모 현재 스케일
    const sx = parentMesh.scale.x || 1;
    const sy = parentMesh.scale.y || 1;
    const sz = parentMesh.scale.z || 1;

    // 위치: "오른쪽-하단" + "벽면(뒷면) 기준으로 배치"
    // 월드 간격을 로컬로 환산하려면 부모 스케일로 나눠준다
    const offX = (baseW * 0.5) + ((childW * 0.5) + MARGIN_SIDE)   / sx;
    const offY = -(baseH * 0.5) + ((childH * 0.5) + MARGIN_BOTTOM) / sy;
    const offZ = -(baseD * 0.5) - (childD * 0.5) / sz + (WALL_EPS / sz);

    // 자식은 부모의 로컬 스페이스로 배치 → 스케일/회전 자동 추종
    child.position.set(offX, offY, offZ);

    // 부모 스케일을 상쇄 → 자식은 월드에서 항상 같은 크기
    child.scale.set(1 / sx, 1 / sy, 1 / sz);

    // 부모 스케일이 바뀔 때도 크기·간격 유지
    child.onBeforeRender = () => {
      const _sx = parentMesh.scale.x || 1;
      const _sy = parentMesh.scale.y || 1;
      const _sz = parentMesh.scale.z || 1;

      child.scale.set(1 / _sx, 1 / _sy, 1 / _sz);

      child.position.set(
        (baseW * 0.5) + ((childW * 0.5) + MARGIN_SIDE)   / _sx,
        -(baseH * 0.5) + ((childH * 0.5) + MARGIN_BOTTOM) / _sy,
        -(baseD * 0.5) - (childD * 0.5) / _sz + (WALL_EPS / _sz)
      );
    };

    parentMesh.add(child); // 부모-자식 결합(삭제/이동/회전/스케일 자동 추종)
    return child;
  } catch (e) {
    console.error('[attachCaptionBox] failed:', e);
  }
}

/* ──────────────────────────────────────────────────────────────
 * 유틸: scene 역추적 / 안전 dispose
 * ────────────────────────────────────────────────────────────── */

// scene 인자가 없거나 끊어진 경우 mesh로부터 THREE.Scene을 역추적
function resolveSceneFrom(mesh, scene) {
  if (scene && typeof scene.add === "function") return scene;
  let p = mesh;
  while (p) {
    if (p.isScene) return p;
    p = p.parent;
  }
  return null;
}

// 재귀 dispose: 지오메트리/머티리얼/텍스처 해제
function disposeObject3D(obj) {
  obj.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose?.();
    }
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((m) => {
        Object.keys(m).forEach((k) => {
          const v = m[k];
          if (v && v.isTexture && typeof v.dispose === "function") {
            v.dispose();
          }
        });
        m.dispose?.();
      });
    }
  });
}

/**
 * mesh를 Three.js scene, paintings, tempPaintings에서 안전하게 제거
 */
export function deletePaintingFromAll(mesh, scene) {
  const resolvedScene = resolveSceneFrom(mesh, scene);
  if (!resolvedScene) {
    console.warn("deletePaintingFromAll: cannot resolve THREE.Scene");
    return;
  }
  // parent가 있으면 parent에서 제거, 없으면 scene에서 제거
  const parent = mesh.parent;
  if (parent && typeof parent.remove === "function") {
    parent.remove(mesh);
  } else {
    resolvedScene.remove(mesh);
  }
  removePainting(mesh);        // paintings에서 제거
  removeTempPainting(mesh);    // tempPaintings에서 제거(있을 때만)
}

/**
 * 작품(그림) 오브젝트/데이터 삭제 및 편집 UI/상태 정리
 * @param {THREE.Mesh} mesh 삭제할 그림 mesh
 * @param {THREE.Scene} scene Three.js 씬(상위에서 파라미터로 전달)
 */
export function deletePainting(mesh, scene) {
  // 3D 씬에서 mesh 제거 / paintings 배열에서 삭제 / 편집 상태 종료 / 편집버튼 UI 숨김
  // scene.remove(mesh)                    // 3D 씬에서 mesh 제거
  // removePainting(mesh)                  // paintings 배열에서 삭제
  // endEditingPainting(scene)             // 편집 상태 종료
  // hidePaintingEditButtons()             // 편집버튼 UI 숨김

  if (!mesh) {
    console.warn("deletePainting: mesh is required");
    return;
  }

  const resolvedScene = resolveSceneFrom(mesh, scene);
  if (!resolvedScene) {
    console.warn("deletePainting: cannot resolve THREE.Scene");
    return;
  }

  // 1) 리사이즈 핸들/오버레이 제거 (존재 시)
  removeResizeHandle?.(resolvedScene);

  // 2) scene/parent에서 안전 제거
  const parent = mesh.parent;
  if (parent && typeof parent.remove === "function") {
    parent.remove(mesh);
  } else {
    resolvedScene.remove(mesh);
  }

  // 3) 데이터 컬렉션에서 제거
  removePainting(mesh);
  removeTempPainting(mesh);

  // 4) 리소스 해제
  disposeObject3D(mesh);

  // 5) 편집 상태 종료 + UI 정리
  endEditingPainting(resolvedScene); // 편집 상태 종료
  hidePaintingEditButtons();         // 편집버튼 UI 숨김
}

/**
 * 현재 선택된 그림(mesh) 상태
 */
export function getSelectedPainting() {
  return selectedPainting;
}

export function setSelectedPainting(mesh) {
  selectedPainting = mesh;
}

export function clearSelectedPainting() {
  selectedPainting = null;
}

//
// 자동 저장용 커밋 함수
//
export function commitPaintingChanges(scene, controls) {
  setPaintingMode(false); // 설정창 '작품선택 모드' 해제
  if (controls) controls.enabled = true; // OrbitControls 재활성화
  clearTempPaintings(); // 임시 작품 비우기
  updatePaintingOrderByPosition();
  hidePaintingEditButtons();
  endEditingPainting(scene);
}
