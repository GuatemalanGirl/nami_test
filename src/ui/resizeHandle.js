// ui/resizeHandle.js

import * as THREE from 'three';

let resizeHandleMesh = null; // 핸들러 메쉬

// ───────────────────────────────────────────────────────────────
// scene 보장 유틸: 전달된 scene이 없을 때 mesh로부터 역추적
function resolveScene(mesh, scene) {
  // 외부에서 scene을 제대로 넘겨준 경우 그대로 사용
  if (scene && typeof scene.add === 'function') return scene;

  // mesh 기준으로 상위 트리를 타고 올라가서 THREE.Scene 찾기
  let p = mesh;
  while (p) {
    if (p.isScene) return p;
    p = p.parent;
  }
  return null;
}

// 핸들 그룹 보장: 씬에 공용 핸들 루트가 없으면 생성
function getHandlesRoot(scene) {
  if (!scene || typeof scene.add !== 'function') return null;
  let g = scene.getObjectByName('HandlesRoot');
  if (!g) {
    g = new THREE.Group();
    g.name = 'HandlesRoot';
    scene.add(g);
  }
  return g;
}
// ───────────────────────────────────────────────────────────────

// 공통 유틸: 로컬 바운딩박스의 우상단 코너를 월드 좌표로 변환
function getTopRightWorldCorner(mesh, outwardOffset = 0.02) {
  if (!mesh || !mesh.geometry) return null;

  // 지오메트리 바운딩박스 확보(로컬 기준)
  const geom = mesh.geometry;
  if (!geom.boundingBox) {
    geom.computeBoundingBox();
  }
  const bb = geom.boundingBox; // THREE.Box3 (로컬좌표계)

  // 로컬 우상단 코너: (max.x, max.y, max.z)
  const localCorner = new THREE.Vector3(bb.max.x, bb.max.y, bb.max.z);

  // 로컬→월드 변환 (회전/스케일/부모변환 모두 반영)
  const worldCorner = mesh.localToWorld(localCorner.clone());

  // 표면 바깥으로 살짝 띄우기: 메쉬의 +Z 노멀 방향
  if (outwardOffset) {
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);
    worldCorner.addScaledVector(normal, outwardOffset);
  }

  return worldCorner;
}

/** 터치 친화적인 보이지 않는 히트 프록시를 핸들에 부착 */
export function addHitProxyToResizeHandle(handle, opts = {}) {
  if (!handle || handle.getObjectByName('hitProxy')) return;

  const scale = opts.scale ?? 2.0;           // 히트 영역 배수 (1.5~2.5 추천)
  // 핸들의 가시 크기를 기준으로 대략 반경 추정
  const bbox = new THREE.Box3().setFromObject(handle);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const baseRadius = Math.max(size.x, size.y, size.z) * 0.5 || 0.03;

  const geo = new THREE.SphereGeometry(baseRadius * scale, 16, 16);
  const mat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.0,                 // 보이지 않음
    depthTest: false,
    depthWrite: false
  });
  const proxy = new THREE.Mesh(geo, mat);
  proxy.name = 'hitProxy';

  // 드래그 대상(mesh)을 그대로 전달
  proxy.userData.targetMesh = handle.userData?.targetMesh ?? null;

  // 핸들과 동일한 위치/회전
  proxy.position.set(0, 0, 0);
  proxy.quaternion.identity();

  handle.add(proxy);
}

export function createResizeHandle(mesh, scene, options = {}) {
  // 핸들러가 이미 있으면 삭제
  // (기존: scene.remove(resizeHandleMesh) -> [개선] 부모가 누군지 몰라도 안전하게 제거)
  if (resizeHandleMesh) {
    resizeHandleMesh.parent?.remove(resizeHandleMesh);
    resizeHandleMesh = null;
  }

  // 방어: mesh가 유효한지
  if (!mesh) {
    console.warn('createResizeHandle: mesh is required');
    return null;
  }

  // 방어: geometry가 없는 경우 대비
  if (!mesh.geometry) {
    console.warn('createResizeHandle: target mesh has no geometry');
    return null;
  }

  // scene이 undefined여서 `.add`에서 터지던 문제를 해결
  const resolvedScene = resolveScene(mesh, scene);
  if (!resolvedScene) {
    console.warn('createResizeHandle: cannot resolve THREE.Scene');
    return null;
  }

  // 옵션(선택): 핸들 크기/색상/히트프록시 배수 조절
  const handleWidth  = options.width  ?? 0.5;
  const handleHeight = options.height ?? 0.5;
  const color        = options.color  ?? 0xffff00;
  let handleDepth, geom;

  if (mesh.geometry.type === "BoxGeometry") {
    const baseDepth = mesh.geometry.parameters?.depth ?? 0.1; // 기본 두께 0.1
    handleDepth = baseDepth * mesh.scale.z;
    geom = new THREE.BoxGeometry(handleWidth, handleHeight, handleDepth);
  } else if (mesh.geometry.type === "PlaneGeometry") {
    handleDepth = 0.01; // 평면 핸들러라면
    geom = new THREE.PlaneGeometry(handleWidth, handleHeight);
  } else {
    // 지원하지 않는 지오메트리 타입 방어
    console.warn(`createResizeHandle: unsupported geometry type "${mesh.geometry.type}"`);
    geom = new THREE.PlaneGeometry(handleWidth, handleHeight);
  }

  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    depthTest: false // 항상 보이도록(다른 오브젝트 뒤에 가려지지 않게)
  });
  resizeHandleMesh = new THREE.Mesh(geom, mat);
  resizeHandleMesh.userData.targetMesh = mesh;

  // scene에 바로 붙이지 말고, 공용 핸들 루트에 부착(없으면 생성)
  const parentForHandle = getHandlesRoot(resolvedScene) ?? resolvedScene;
  parentForHandle.add(resizeHandleMesh);

  // 최초 위치는 대상의 로컬 우상단 코너(월드 변환)로 시작
  // 월드 AABB가 아니라 로컬 바운딩박스 + localToWorld 사용
  const initialPos = getTopRightWorldCorner(mesh, /* outwardOffset */ options.outwardOffset ?? 0.02);
  if (initialPos) resizeHandleMesh.position.copy(initialPos);

  // 오브젝트의 회전을 따라가도록 정렬
  resizeHandleMesh.quaternion.copy(mesh.quaternion);
  resizeHandleMesh.visible = true;

  // 항상 최상단 렌더링(시각/선택 용이)
  resizeHandleMesh.renderOrder = 9999;

  // 터치 히트박스 확장: 보이지 않는 프록시 자식 추가(옵션으로 끌 수 있음)
  if (options.hitProxy !== false) {
    addHitProxyToResizeHandle(resizeHandleMesh, { scale: options.hitProxyScale ?? 2.0 });
  }

  return resizeHandleMesh;
}

export function updateResizeHandlePosition(mesh, options = {}) {
  if (!mesh) return;
  if (!resizeHandleMesh) return;

  // 이전 버전은 월드 AABB(Box3.setFromObject) + 벽면 스위치(getCurrentWall)로 계산
  // 회전/스케일/벽 방향에 따라 코너가 어긋났음.
  // -> 로컬 바운딩박스 우상단을 localToWorld로 변환하여 항상 동일 기준으로 위치 계산.
  const outwardOffset = options.outwardOffset ?? 0.02;

  const pos = getTopRightWorldCorner(mesh, outwardOffset);
  if (pos) resizeHandleMesh.position.copy(pos);

  // 회전도 대상과 일치
  resizeHandleMesh.quaternion.copy(mesh.quaternion);
  resizeHandleMesh.visible = true;
}

// 필요하다면 외부에서 핸들러 객체 직접 접근하는 함수도 export
export function getResizeHandleMesh() {
  return resizeHandleMesh;
}

export function removeResizeHandle(scene) {
  if (resizeHandleMesh) {
    // scene 인자 없이도 안전 제거
    resizeHandleMesh.parent?.remove(resizeHandleMesh);
    resizeHandleMesh = null;
  }
}