# NAMI

**v5.3** – 현재 시점의 벽에서 편집패널 시작 / shorcut버튼을 showPanel로 라우팅

## Changelog

### v5.3
- **core/facingWall.js**
  - getFacingWallName 구현, wallNavigation.alignToCameraWall에서 시작 벽 계산에 사용
- **ui/wallNavigation.js**
  - alignToCameraWall: getFacingWallName(camera, scene)로 현재 바라보는 벽 추정
  - setCurrentWall → updateWallView → 라벨 갱신 순으로 일관 처리
  - 좌/우 전환 래퍼(goToLeft/RightWall)에서도 라벨 동기화 유지
- **script.js**
  - 패널 상단 shortcut 버튼의 .active 직접 토글 로직 제거
  - 모든 shortcut 클릭을 showPanel(panelId, camera, controls, scene) 경유로 통일
  - 편집 패널(작품/서문/아트월)에서 시점 고정, 비편집 패널에서 즉시 해제 보장

## Quick Start

```bash
npm install      # 의존성 설치
npm run dev      # http://localhost:5173
npm run build    # 프로덕션 빌드 (dist/)
npm run deploy   # GitHub Pages 배포 (gh-pages 브랜치로 dist push)