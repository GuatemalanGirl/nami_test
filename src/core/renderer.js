import * as THREE from 'three';

/**
 * 렌더러를 만들고, 화면 크기 변경 리스너를 등록합니다.
 * @param {Function} onResize 콜백 (resize 이벤트 핸들러)
 * @returns {THREE.WebGLRenderer}
 */
export function createRenderer(onResize) {
  const renderer = new THREE.WebGLRenderer({ antialias: true }); // 랜더러 생성
  renderer.setPixelRatio(window.devicePixelRatio); // 픽셀 비율 설정
  renderer.setSize(window.innerWidth, window.innerHeight); // 캔버스 크기 설정
  document.body.appendChild(renderer.domElement); // DOM에 붙이기
  window.addEventListener('resize', onResize, false); // 리사이즈 핸들러 등록
  return renderer;
}
