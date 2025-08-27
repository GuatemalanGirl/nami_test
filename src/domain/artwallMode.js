// domain/artwallMode.js

let isArtwallMode = false // 아트월 편집모드 진입 여부

// 모드 상태 토글
export function setArtwallMode(enabled) {
  isArtwallMode = !!enabled
}

// 모드 여부 확인
export function getArtwallMode() {
  return isArtwallMode
}
