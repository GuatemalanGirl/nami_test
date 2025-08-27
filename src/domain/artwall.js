// domain/artwall.js

import * as THREE from 'three';
import { ROOM_WIDTH, ROOM_HEIGHT, ROOM_DEPTH } from '../core/constants.js';
import { safeUpdatePaintingOrder } from '../core/order.js';
import { setArtwallMode } from './artwallMode.js';
import { removeOutline } from '../ui/outline.js';

let artwalls = []; // 확정된 아트월들
let tempArtwalls = []; // 편집 중 아트월들
let originalArtwallsState = []; // 롤백용 백업

/**
 * 아트월 PlaneGeometry 생성 및 scene에 추가
 * @param {Object} data - 아트월 메타데이터 (filename, title 등)
 * @param {THREE.Vector3} position - 배치 위치
 * @param {number} rotationY - 회전값 (radian)
 * @param {THREE.Scene} scene
 * @param {THREE.TextureLoader} textureLoader
 * @returns {Promise<THREE.Mesh>}
 */
export function loadAndAddArtwall(data, position, rotationY, scene, textureLoader) {
  return new Promise((resolve, reject) => {
    const url = `https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/artwalls/${data.filename}`;
    textureLoader.load(
      url,
      (texture) => {
        const aspect = texture.image.width / texture.image.height;
        const height = ROOM_HEIGHT; // 항상 바닥에서 천장까지 채우기
        let width = height * aspect;

        const maxWidth = ["left", "right"].includes(data.wall || "front")
          ? ROOM_DEPTH
          : ROOM_WIDTH;
        width = Math.min(width, maxWidth);

        const geo = new THREE.PlaneGeometry(width, height);
        const mat = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: 0.8,
        }); // 아트월 이미지에 투명도 적용
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(position);
        mesh.rotation.y = rotationY;

        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);
        mesh.position.add(forward.multiplyScalar(0.01)); // Z-파이팅 방지

        mesh.userData = {
          isArtwall: true,
          data
        };

        scene.add(mesh);
        artwalls.push(mesh);
        resolve(mesh);
      },
      undefined,
      reject
    );
  });
}

// ───────── 상태 관리 함수들 ─────────

export function getArtwalls() {
  return artwalls;
}

export function getTempArtwalls() {
  return tempArtwalls;
}

export function clearTempArtwalls(scene) {
  tempArtwalls.forEach((mesh) => scene.remove(mesh));
  tempArtwalls = [];
}

export function markArtwallAsEditing(mesh) {
  if (!tempArtwalls.includes(mesh)) {
    tempArtwalls.push(mesh);
  }
}

export function clearEditingArtwalls() {
  tempArtwalls = [];
}

// 적용 버튼 필요시 사용할 함수들
export function commitArtwallState() {
  originalArtwallsState = artwalls.map((m) => ({
    position: m.position.clone(),
    rotation: m.rotation.clone(),
    scale: m.scale.clone(),
    data: { ...m.userData.data }
  }));
}

export function restoreArtwallChanges(scene) {
  artwalls.forEach((m) => scene.remove(m));
  artwalls = [];

  originalArtwallsState.forEach((info) => {
    const geo = new THREE.PlaneGeometry(1, 1); // 더미, 실제 geometry는 다시 load 필요
    const mat = new THREE.MeshBasicMaterial({ color: 0xcccccc });
    const mesh = new THREE.Mesh(geo, mat);

    mesh.position.copy(info.position);
    mesh.rotation.copy(info.rotation);
    mesh.scale.copy(info.scale);
    mesh.userData = {
      isArtwall: true,
      data: info.data
    };

    scene.add(mesh);
    artwalls.push(mesh);
  });
}

//
// 자동 저장용 커밋 함수
//
export function commitArtwallChanges(scene) {
  setArtwallMode(false); // 설정창 '아트월선택 모드' 해제
  clearEditingArtwalls();
  removeOutline(scene);
  safeUpdatePaintingOrder();
}