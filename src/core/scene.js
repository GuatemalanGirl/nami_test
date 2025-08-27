// core/scene.js

import * as THREE from 'three';

/**
 * scene 생성
 * @returns {THREE.Scene}
 */
export function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    return scene;
}