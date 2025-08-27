// core/renderer.js

import * as THREE from 'three';

/**
 * 렌더러를 만들고, 화면 크기 변경 리스너를 등록합니다.
 * @param {Function} onResize 콜백 (resize 이벤트 핸들러)
 * @returns {THREE.WebGLRenderer}
 */
export function createRenderer(onResize) {
  const renderer = new THREE.WebGLRenderer({ antialias: true }); // 랜더러 생성
  // 최신 three
  if ('SRGBColorSpace' in THREE) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  } else {
    // 구버전 호환
    renderer.outputEncoding = THREE.sRGBEncoding;
  }

  // 색 왜곡 줄이고 원본에 가깝게
  renderer.toneMapping = THREE.NoToneMapping;        // 가장 원본에 충실
  renderer.toneMappingExposure = 1.0;

  // PBR 사용 시
  renderer.physicallyCorrectLights = true;
  renderer.setPixelRatio(window.devicePixelRatio); // 픽셀 비율 설정
  renderer.setSize(window.innerWidth, window.innerHeight); // 캔버스 크기 설정
  document.body.appendChild(renderer.domElement); // DOM에 붙이기
  window.addEventListener('resize', onResize, false); // 리사이즈 핸들러 등록
  return renderer;
}