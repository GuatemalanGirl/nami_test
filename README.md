# NAMI

**v5.1** – Vite 기반 빌드, GitHub Pages 배포 지원 / sRGB 색관리 적용

## Changelog

### v5.1
- **프로젝트 구조**
- nami_test/
  ├─ index.html
  ├─ script.js
  ├─ public/
  │  ├─ icons/                 # UI 아이콘(svg)  → 코드에서는 "icons/xxx.svg" 로 참조
  │  └─ logo/                  # 로고 등
  ├─ src/
  │  ├─ core/
  │  │  ├─ renderer.js         # WebGLRenderer 설정 (sRGB, toneMapping)
  │  │  ├─ colorManagement.js  # markAsColorTexture 헬퍼
  │  │  └─ ...                 # camera, scene, lighting, etc.
  │  ├─ domain/                # 비즈니스 로직(painting, room, artwall, intro...)
  │  ├─ ui/                    # UI 레이어(패널, 그리드, 버튼 등)
  │  └─ styles/                # tokens/base/components/utilities.css
  ├─ package.json
  └─ vite.config.js
- **vite.config.js**
  - vite.config.js의 base를 /nami_test/로 설정
- **public/icons**
  - 기존 src/assets의 아이콘을 public/icons로 이관
- **core/renderer.js**
  - outputColorSpace=SRGB 설정
- **core/colorManagement.js**
  - nav/social toggle 로직 개선 (class 적용 방식 보완)
- **domain/room.js**
  - 텍스처 onLoad 시점에 sRGB/wrap/repeat 설정
- **domain/painting.js, domain/intro.js, ui/paintingEditButtons.js**
  - 업로드/포스터 텍스처 sRGB 지정, toneMapped=false 적용, 스케일 보정 및 핸들/아웃라인 갱신
- **ui/dropHandlers**
  - 드롭 좌표 계산에 이벤트 객체 전달 (전역 window.event 의존 제거)
- **domain/artwall.js**
  - 편집/확정 정리 로직 다듬기 (렌더 상태 일관성)
- **script.js**
  - TextureLoader.load를 래핑하여 모든 로드 텍스처에 sRGB 표시
  
## Quick Start

```bash
npm install      # 의존성 설치
npm run dev      # http://localhost:5173
npm run build    # 프로덕션 빌드 (dist/)
npm run deploy   # GitHub Pages 배포 (gh-pages 브랜치로 dist push)