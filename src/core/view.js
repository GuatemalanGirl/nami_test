// core/view.js

import * as THREE from 'three'
import { Tween, Easing } from '@tweenjs/tween.js' // 최신 방식 -> Easing도 import
import { tweenGroup } from '../core/tweenGroup.js' // 그룹 import
import { getCurrentWall } from '../domain/wall.js'
import { updateAllWallLabels } from '../ui/wallNavigation.js'
import { ROOM_WIDTH, ROOM_DEPTH, PAINTING_Y_OFFSET } from '../core/constants.js'

/**
 * 현재 wall 상태에 따라 카메라 시점을 애니메이션으로 회전시킵니다.
 * - 카메라 position 이동
 * - controls.target 이동
 * - 벽 레이블 갱신
 */
export function updateWallView(camera, controls) {
  const currentWall = getCurrentWall()
  updateAllWallLabels(currentWall) // 레이블 먼저

  // 카메라 시점 고정
  const pos = new THREE.Vector3()
  const look = new THREE.Vector3(0, PAINTING_Y_OFFSET, 0)

  switch (currentWall) {
    case "front":
      pos.set(0, PAINTING_Y_OFFSET, -ROOM_DEPTH * 0.1)
      break
    case "right":
      pos.set(ROOM_WIDTH * 0.1, PAINTING_Y_OFFSET, 0)
      break
    case "back":
      pos.set(0, PAINTING_Y_OFFSET, ROOM_DEPTH * 0.1)
      break
    case "left":
      pos.set(-ROOM_WIDTH * 0.1, PAINTING_Y_OFFSET, 0)
      break
  }

  const hasControls = !!(controls && controls.target)

  // 최신 Tween Group 방식 적용
  new Tween(camera.position, tweenGroup)
    .to(pos, 600)
    .easing(Easing.Cubic.InOut)
    .onUpdate(() => {
      if (hasControls) camera.lookAt(controls.target)
      else             camera.lookAt(look)
    })
    .start()

  if (hasControls) {  
    new Tween(controls.target, tweenGroup)
      .to(look, 600)
      .easing(Easing.Cubic.InOut)
      .onUpdate(() => {
        controls.update()
        camera.lookAt(controls.target)
      })
      .start()
  }    
}