import * as THREE from 'three';

/**
 * 씬에 기본 조명(Ambient + Directional)을 추가합니다.
 * @param {THREE.Scene} scene
 */
export function addDefaultLights(scene) {
    
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(10, 20, 10);
  directionalLight.castShadow = true;
  scene.add(directionalLight);
}
