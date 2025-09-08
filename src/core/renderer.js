// core/renderer.js

import * as THREE from 'three';

/**
 * 렌더러를 만들고, 화면 크기 변경 리스너를 등록합니다.
 * @param {Function} onResize 콜백 (resize 이벤트 핸들러)
 * @returns {THREE.WebGLRenderer}
 */
export function createRenderer(onResize) {
  const renderer = new THREE.WebGLRenderer({ antialias: true }); // 랜더러 생성

  renderer.setClearColor(0xffffff, 1);

  // 최신 three
  if ('SRGBColorSpace' in THREE) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  } else {
    // 구버전 호환
    renderer.outputEncoding = THREE.sRGBEncoding;
  }

  // PBR에 적합한 톤매핑/노출 (권장)
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // 원본 대비 자연스러운 대비/하이라이트
  renderer.toneMappingExposure = 0.4;                 // 1.2 ~ 1.5 사이에서 취향에 맞게 조절

  // 물리 기반 광원 스케일 사용
  renderer.physicallyCorrectLights = true;

  // 부드러운 실시간 그림자
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 과도한 해상도 방지
  renderer.setSize(window.innerWidth, window.innerHeight);      // 캔버스 크기 설정
  document.body.appendChild(renderer.domElement);               // DOM에 붙이기

  window.addEventListener('resize', onResize, false);           // 리사이즈 핸들러 등록
  return renderer;
}