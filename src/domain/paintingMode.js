// domain/paintingMode.js

let isPaintingMode = false // 설정창 "작품선택" 모드인지 여부

// 설정 모드 상태 토글
export function setPaintingMode(enabled) {
  isPaintingMode = enabled
}

// 설정 모드 여부 확인
export function getPaintingMode() {
  return isPaintingMode
}
