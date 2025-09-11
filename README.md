# NAMI

**v5.6** – 모바일 대응 스타일시트 (1180px 이하) 

## Changelog

### v5.6
- styles/components.mobile.css 추가
  - 모바일 대응 스타일시트 (1180px 이하) 추가
- styles/components.css
  - navButtonsToggle도 숨김 애니메이션 지원
  - 불필요한 스타일 정리
- styles/tokens.css
  - 모바일 레이아웃 보조 토큰 추가
- ui/infoModal.js
  - initInfoModal 컨텍스트 주입 및 안정성 보강
- ui/panel.js
  - showPanel에서 nav 토글 제거하고 autoClose 시 복구
- script.js
  - settingsPanel 열림/닫힘과 navButtons 동기화
- index.html
  - 모바일 스타일 연결 및 설정 패널 마크업 정리

## Quick Start

```bash
npm install      # 의존성 설치
npm run dev      # http://localhost:5173
npm run build    # 프로덕션 빌드 (dist/)
npm run deploy   # GitHub Pages 배포 (gh-pages 브랜치로 dist push)