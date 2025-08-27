// domain/introMode.js

let isIntroMode = false // 전시서문쓰기모드 여부

// 모드 상태 토글
export function setIntroMode(enabled) {
  isIntroMode = !!enabled
}

// 모드 여부 확인
export function getIntroMode() {
  return isIntroMode
}
