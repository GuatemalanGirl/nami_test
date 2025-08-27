// ui/introWallPlaneUtils.js

import { isActuallyEmpty } from './textParseUtils.js'

/**
 * intro-plane mesh의 배경 투명도를 HTML 내용에 따라 동적으로 업데이트
 * @param {THREE.Mesh} mesh - 대상 intro-plane mesh
 * @param {string} html - 서문 HTML 내용
 */
export function updateIntroWallPlaneOpacity(mesh, html) {
  // intro-plane만 적용
  if (mesh.userData.type === "intro-plane") {
    let hasText = !isActuallyEmpty(html)
    mesh.material.opacity = hasText ? 0 : 0.4
    mesh.material.transparent = true
  }
}
