// domain/room.js
import * as THREE from "three";
import {
  ROOM_WIDTH,
  ROOM_HEIGHT,
  ROOM_DEPTH,
  PAINTING_Y_OFFSET,
  WALL_OFFSET
} from "../core/constants.js";

/**
 * 갤러리 3D 방 구조(벽, 바닥, 천장)를 생성해 씬에 추가
 * @param {THREE.Scene} scene
 * @param {THREE.TextureLoader} textureLoader
 * @returns {Object} 벽 Mesh 객체들을 반환할 수도 있음
 */
export function createRoom(scene, textureLoader) {
  const textures = {
    floor: textureLoader.load(
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/floor/floor9.png",
    ),
    ceiling: textureLoader.load(
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/ceiling/ceiling4.png",
    ),
    front: textureLoader.load(
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls2.png",
    ),
    back: textureLoader.load(
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls2.png",
    ),
    left: textureLoader.load(
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls2.png",
    ),
    right: textureLoader.load(
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls2.png",
    ),
  }

  textures.floor.wrapS = THREE.RepeatWrapping
  textures.floor.wrapT = THREE.RepeatWrapping
  textures.floor.repeat.set(5, 5)

  textures.ceiling.wrapS = THREE.RepeatWrapping
  textures.ceiling.wrapT = THREE.RepeatWrapping
  textures.ceiling.repeat.set(1, 1)
  ;["front", "back", "left", "right"].forEach((side) => {
    textures[side].wrapS = THREE.RepeatWrapping
    textures[side].wrapT = THREE.RepeatWrapping
    textures[side].repeat.set(2, 1)
  })

  const makeWall = (
    geometry,
    material,
    position,
    rotation,
    name,
    shouldFlipNormal = false,
  ) => {
    if (shouldFlipNormal) geometry.scale(-1, 1, 1)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.copy(position)
    mesh.rotation.copy(rotation)
    mesh.name = name // 이름설정
    scene.add(mesh)
    return mesh // 나중에 필요하면 mesh 반환 가능
  }

  makeWall(
    new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH),
    new THREE.MeshStandardMaterial({ map: textures.floor }),
    new THREE.Vector3(0, -ROOM_HEIGHT / 2, 0),
    new THREE.Euler(-Math.PI / 2, 0, 0),
    "floor",
  )
  makeWall(
    new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH),
    new THREE.MeshStandardMaterial({ map: textures.ceiling }),
    new THREE.Vector3(0, ROOM_HEIGHT / 2, 0),
    new THREE.Euler(-Math.PI / 2, 0, 0),
    "ceiling",
    true,
  )
  makeWall(
    new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_HEIGHT),
    new THREE.MeshStandardMaterial({ map: textures.front }),
    new THREE.Vector3(0, PAINTING_Y_OFFSET, ROOM_DEPTH / 2),
    new THREE.Euler(0, 0, 0), // 회전은 그대로
    "front",
    true, // 법선 뒤집기
  )

  makeWall(
    new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_HEIGHT),
    new THREE.MeshStandardMaterial({ map: textures.back }),
    new THREE.Vector3(0, PAINTING_Y_OFFSET, -ROOM_DEPTH / 2),
    new THREE.Euler(0, 0, 0),
    "back",
  )

  makeWall(
    new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT),
    new THREE.MeshStandardMaterial({ map: textures.left }),
    new THREE.Vector3(ROOM_WIDTH / 2, PAINTING_Y_OFFSET, 0),
    new THREE.Euler(0, Math.PI / 2, 0),
    "left",
    true, // 실내를 보도록 뒤집기
  )

  makeWall(
    new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT),
    new THREE.MeshStandardMaterial({ map: textures.right }),
    new THREE.Vector3(-ROOM_WIDTH / 2, PAINTING_Y_OFFSET, 0),
    new THREE.Euler(0, Math.PI / 2, 0),
    "right",
  )
}
