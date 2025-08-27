// core/colorManagement.js

import * as THREE from 'three';

export function markAsColorTexture(tex) {
  if (!tex) return;
  if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;  // r152+
  else tex.encoding = THREE.sRGBEncoding;                           // r151 이하
  // 이미지가 이미 붙어있는 경우에만 업데이트 플래그
  const img = tex.image;
  if (img && (img.complete !== false)) {
    tex.needsUpdate = true;
  }
 }