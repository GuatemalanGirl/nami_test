# NAMI

**v5.4** – 통합 포인터 처리 및 터치 UX 개선

## Changelog

### v5.4
- **interaction/pointerManager.js**
  - 포인터 멀티 터치/캡처/중복 click 억제 등을 중앙집중 관리하려면 본 모듈에 통합
- **core/pointer.js**
  - Mouse/Pointer/Touch 모두 지원하도록 updatePointer 범용화(NDC 계산 기준을 renderer.domElement로 일원화)
- **core/controls.js**
  - 컨트롤 옵션 정리 및 외부에서 enable/disable 제어 일관화(편집/드래그 중 잠금 전제)
- **interaction/paintingDragHandlers.js**
  - 멀티터치 집계(Set)로 핀치 시 드래그 차단, pointer capture/해제 처리
  - 드래그 시작 시 OrbitControls 잠금 -> 종료 시 "이전 상태"로 복원(패널이 잠갔던 상태 유지)
  - 클릭/드래그 판정 안정화, intro parent 치환 유지, 엣지 네비와 동작 충돌 제거
- **interaction/artwallDragHandlers.js**
  - painting과 동일한 포인터 가드/엣지 네비 패턴 적용, controls 의존성 주입 누락 보완
- **interaction/edgeWallNavigator.js**
  - 상/하 데드존 옵션, dwell/cooldown 보정, passive 리스너 적용 및 destroy 시 리스너 해제 수정
- **interaction/resizeHandles.js**
  - null-safe, intersectObject, pointer capture 흐름 보강; intro-plane 실시간 업데이트 유지
- **interaction/zoomControls.js**
  - 트윈 완료 시 controls를 무조건 켜지 않도록 가드(작품설정 모드/편집 중엔 계속 잠금 유지)
- **ui/resizeHandle.js**
  - HandlesRoot 그룹 도입, 로컬 AABB 우상단→월드 변환으로 핸들 위치 정밀화, renderOrder/깊이테스트 조정
- **ui/globalInputBlocker.js**
  - 리사이즈/스토리/컬러피커/정보모달 등 상태별 입력 화이트리스트 및 passive 옵션 정리
- **script.js**
  - touchend→onClick 중복 경로 제거(합성 click 중복 방지), pointer 좌표 계산 통일(updatePointer 사용)
  - 리사이즈 종료 시 releasePointerCapture, pixelRatio 상한(≤2)로 모바일 발열/배터리 보호
  - 패널 전환 시 OrbitControls 잠금 상태 즉시 동기화
- **src/styles/base.css**
  - canvas/스테이지에 touch-action:none, 탭 하이라이트 제거; 오버레이 overscroll-behavior: contain 추가

## Quick Start

```bash
npm install      # 의존성 설치
npm run dev      # http://localhost:5173
npm run build    # 프로덕션 빌드 (dist/)
npm run deploy   # GitHub Pages 배포 (gh-pages 브랜치로 dist push)