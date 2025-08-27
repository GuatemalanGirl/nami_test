import * as THREE from 'three';
import {
  CAMERA_FOV,
  CAMERA_NEAR,
  CAMERA_FAR,
  INITIAL_CAMERA_POS,
  PAINTING_Y_OFFSET
} from './constants.js';

/**
 * 카메라를 생성하고 초기 위치 및 시점을 설정합니다.
 * @returns {THREE.PerspectiveCamera}
 */
export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    CAMERA_FOV,
    window.innerWidth / window.innerHeight,
    CAMERA_NEAR,
    CAMERA_FAR
  );
  camera.position.copy(INITIAL_CAMERA_POS);
  camera.lookAt(0, PAINTING_Y_OFFSET, 0);
  return camera;
}
