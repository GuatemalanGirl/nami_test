// core/controls.js

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/**
 * OrbitControls를 생성하고 기본 옵션을 설정합니다.
 * - 데스크톱/터치 공통으로 "말이 되는" 기본값 제공
 * - 터치 제스처 매핑(ONE: rotate, TWO: dolly+pan, THREE: pan)
 * - 화폭 제스처 권한 확보(touch-action)
 *
 * @param {THREE.Camera} camera
 * @param {HTMLElement} canvas   // 보통 renderer.domElement
 * @param {Object} opts          // 세부 옵션 덮어쓰기
 * @returns {OrbitControls}
 */
export function createControls(camera, canvas, opts = {}) {
  const controls = new OrbitControls(camera, canvas)

  // ── 타겟(초기 시점) ────────────────────────────────────────────────
  if (opts.target instanceof THREE.Vector3) {
    controls.target.copy(opts.target)
  } else {
    controls.target.set(0, opts.targetOffsetY ?? 0, 0)
  }

  // ── 화폭 제스처 권한 확보: 터치 입력을 우리가 직접 처리 ─────────────
  // CSS에서 .app__stage { touch-action:none }를 이미 썼다면
  // opts.touchActionNone=false 로 비활성화해도 됩니다.
  if (opts.touchActionNone !== false) {
    canvas.style.touchAction = 'none'
    canvas.style.userSelect = 'none'
    canvas.style.webkitUserSelect = 'none'
  }

  // ── 공통 동작(회전/줌/팬 + 댐핑) ───────────────────────────────────
  controls.enableDamping   = opts.enableDamping   ?? true
  controls.dampingFactor   = opts.dampingFactor   ?? 0.08

  controls.enableRotate    = opts.enableRotate    ?? true
  controls.enableZoom      = opts.enableZoom      ?? true
  controls.enablePan       = opts.enablePan       ?? true
  controls.screenSpacePanning = opts.screenSpacePanning ?? false

  controls.rotateSpeed     = opts.rotateSpeed     ?? 0.5
  controls.zoomSpeed       = opts.zoomSpeed       ?? 0.9
  controls.panSpeed        = opts.panSpeed        ?? 0.4

  // ── 카메라 이동/각도 제한(뒤집힘 방지 & 과도한 줌 방지) ─────────────
  controls.minDistance     = opts.minDistance     ?? 2
  controls.maxDistance     = opts.maxDistance     ?? 80
  controls.minPolarAngle   = opts.minPolarAngle   ?? Math.PI * 0.05   // ~9°
  controls.maxPolarAngle   = opts.maxPolarAngle   ?? Math.PI * 0.48   // ~86°

  // ── 입력 매핑(마우스/터치) ────────────────────────────────────────
  // 터치 환경 감지(필요 시 opts.forceTouch=true/false로 강제)
  const isTouch = opts.forceTouch ?? (typeof window !== 'undefined'
    && window.matchMedia?.('(hover: none) and (pointer: coarse)')?.matches)

  // 터치 제스처: 1손가락 회전, 2손가락 줌+팬, 3손가락 팬
  controls.touches = {
    ONE:    opts.touchOne   ?? THREE.TOUCH.ROTATE,
    TWO:    opts.touchTwo   ?? THREE.TOUCH.DOLLY_PAN,
    THREE:  opts.touchThree ?? THREE.TOUCH.PAN
  }

  // 마우스 버튼: 기본 매핑 유지(원하면 덮어쓰기)
  controls.mouseButtons = {
    LEFT:   opts.mouseLeft   ?? THREE.MOUSE.ROTATE,
    MIDDLE: opts.mouseMiddle ?? THREE.MOUSE.DOLLY,
    RIGHT:  opts.mouseRight  ?? THREE.MOUSE.PAN
  }

  // 필요할 때 쉽게 켜/끄기 위한 헬퍼(편집 모드 전환 등)
  controls.setEnabled = (on) => { controls.enabled = !!on }

  controls.update()
  return controls
}