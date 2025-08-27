import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * OrbitControls를 생성하고 기본 옵션을 설정합니다.
 * @param {THREE.Camera} camera
 * @param {HTMLCanvasElement} canvas
 * @param {Object} opts 옵션 객체
 * @returns {OrbitControls}
 */
export function createControls(camera, canvas, opts = {}) {
  const controls = new OrbitControls(camera, canvas);

  // 타겟 설정
  controls.target.set(0, opts.targetOffsetY ?? 0, 0);

  // 댐핑 및 속도 설정
  controls.enableDamping  = opts.enableDamping  ?? true;
  controls.dampingFactor   = opts.dampingFactor   ?? 0.1;
  controls.rotateSpeed     = opts.rotateSpeed     ?? 0.5;
  controls.zoomSpeed       = opts.zoomSpeed       ?? 1.0;
  controls.panSpeed        = opts.panSpeed        ?? 0.4;

  controls.update();
  return controls;
}
