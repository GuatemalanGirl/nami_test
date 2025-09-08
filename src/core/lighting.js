// lighting.js

import * as THREE from 'three';
import { PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * 씬에 기본 조명(Ambient + Hemi + Directional)을 추가합니다.
 * renderer.physicallyCorrectLights 여부에 따라 강도 스케일을 맞춥니다.
 */
export function addDefaultLights(scene, renderer) {
  const physically = !!renderer?.physicallyCorrectLights;

  // Ambient: 살짝만
  const ambientLight = new THREE.AmbientLight(0xffffff, physically ? 0.2 : 0.4);
  scene.add(ambientLight);

  // Hemisphere: 실내 상하광 느낌
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, physically ? 0.6 : 0.5);
  hemi.position.set(0, 1, 0);
  scene.add(hemi);

  // Directional: 메인 라이트 (physically 모드면 강도를 충분히 키움)
  const dir = new THREE.DirectionalLight(0xffffff, physically ? 3.0 : 1.2);
  dir.position.set(10, 20, 10);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.bias = -0.0005;     // 그림자 얼룩 방지
  dir.shadow.normalBias = 0.02;  // 접촉면 밴딩 감소
  scene.add(dir);
}

export function setupEnvironment(scene, renderer) {
  const pmrem = new PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environment = envTex;     // 표준/피지컬 머티리얼의 기본 반사/간접광
  scene.background = null;        // 배경색은 별도 유지
}