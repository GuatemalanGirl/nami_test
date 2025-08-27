// core/loop.js

// 최신 방식: TWEEN 대신 Group 사용
import { tweenGroup } from './tweenGroup.js'; // 반드시 core/tweenGroup.js에 그룹 생성
import { getZoomedPainting,
    setZoomedPainting,
    setZoomLevel,
    setZoomedInState,
    getCameraMovingState
} from '../domain/zoomState.js';
import { getPaintingMode } from '../domain/paintingMode.js';
import { getOutlineLine } from '../ui/outline.js';
import { getEditingPainting } from '../domain/paintingEditing.js';
import { ZOOM_DISTANCE } from './constants.js';
import { setCurrentPaintingIndex } from '../domain/currentPainting.js';

export function animate(scene, camera, renderer, controls) {
  // 프레임 루프 실행
  requestAnimationFrame((time) => animate(scene, camera, renderer, controls));

  // 최신 Tween 그룹 기반으로 변경
  tweenGroup.update(performance.now());

  // 카메라가 멀어지면 선택 해제
  const zoomed = getZoomedPainting();
  if (zoomed && !getCameraMovingState()) {
    const dist = camera.position.distanceTo(zoomed.position);
    if (dist > ZOOM_DISTANCE + 1) {
      setZoomedPainting(null);
      setZoomLevel(0);
      setZoomedInState(false);
      setCurrentPaintingIndex(-1); // 혹은 상태 모듈화
    }
  }

  // 카메라 컨트롤 (painting 모드 아닐 때만)
  if (!getPaintingMode() && controls) {
    controls.update();
  }

  // 편집 중인 그림을 따라 아웃라인 위치 갱신
  const outlineLine = getOutlineLine();
  const editingPainting = getEditingPainting();
  if (outlineLine && editingPainting) {
    outlineLine.position.copy(editingPainting.position);
    outlineLine.quaternion.copy(editingPainting.quaternion);
  }

  renderer.render(scene, camera);
}
