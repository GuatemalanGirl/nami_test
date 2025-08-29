# NAMI

**v5.2** – 작품(서문),아트월이미지 드래그로 벽 전환 및 배치

## Changelog

### v5.2
- **interaction/edgeWallNavigator.js**
  - 드래그 중 화면 좌/우 엣지 체류 감지 유틸. `isActive / isDragging / isResizing / isMoving` 게이트와 `edgePct / dwellMs / cooldownMs` 옵션 지원
- **interaction/paintingDragHandlers.js**
  - 엣지-드래그 벽 전환 도입(선택된 타깃이 있을 때만 활성). 전환 중 드래그 연속성 유지(`suppressNextPointerUp`)
  - `intersectObjects(..., true)`로 자식까지 피킹
  - 드래그 중 현재 벽 노멀에 맞춰 작품(또는 서문) 회전(`slerp ~0.35`), 위치는 벽 경계 내 클램프
  - 작품 모드에서만 정렬 동기화(`updatePaintingOrderByPosition`)
- **interaction/artwallDragHandlers.js**
  - 회전/연속성/게이트/포인터 캡처 로직을 painting과 동일 패턴으로 이식
  - 드래그 대상이 있을 때만 엣지-전환 활성(`hasDragTargetArt`), 전환 후에도 드래그 지속
  - 벽 노멀 정렬 회전(`slerp ~0.35`), 위치 클램프
- **ui/wallNavigation.js**
  - `goToLeftWall(camera, controls)`, `goToRightWall(camera, controls)` 래퍼 추가
  - `addWallNavListeners`가 `controls`를 전달하도록 보완
- **core/view.js**
  - `updateWallView`에서 `controls` 미전달 상황 가드 / 트윈 onUpdate에서 `controls.target` 안전 처리(크래시 방지)

**Tuning (기본값)**
- `edgePct: 0.08` (좌/우 8% 영역)
- `dwellMs: 100` (엣지에 100ms 머물면 전환)
- `cooldownMs: 500` (연속 전환 딜레이)

**Behavior**
- 선택된 작품/서문/아트월을 드래그하여 화면 좌우 엣지에 100ms 머무르면 인접 벽으로 빠르게 전환
- 빈 화면 드래그로는 전환되지 않음(실제 드래그 타깃 필요)
- 전환 중에도 드래그가 끊기지 않고, 오브젝트가 카메라 회전에 맞춰 새 벽에 자연스럽게 붙고 방향이 정렬됨
  
## Quick Start

```bash
npm install      # 의존성 설치
npm run dev      # http://localhost:5173
npm run build    # 프로덕션 빌드 (dist/)
npm run deploy   # GitHub Pages 배포 (gh-pages 브랜치로 dist push)