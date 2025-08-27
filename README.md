# NAMI

**v5.0** – UI 스타일 시스템 리팩터링 및 통일성 개선

## Changelog

### v5.0
- **index.html**
  - nav/social/settings 버튼 구조 변경 -> SVG 아이콘 기반으로 교체
- **script.js**
  - nav/social toggle 로직 개선 (class 적용 방식 보완)
- **base.css**
  - 전역 button 스타일 충돌 방지
  - toggle 버튼에 투명 배경 적용
- **components.css**
  - nav-toggle, social-toggle 등 커스텀 버튼 스타일 추가
  - settings-panel 스타일 개선 (border-radius, opacity, border animation 통일)
- **tokens.css**
  - 버튼 크기 및 여백 관련 토큰 값 조정
  - settings panel 및 overlay에서 공통 적용할 수 있도록 radius/opacity 토큰 확장
  
## Quick Start

```bash
npm install      # 의존성 설치
npm run dev      # http://localhost:5173
npm run build    # 배포용 번들 생성
