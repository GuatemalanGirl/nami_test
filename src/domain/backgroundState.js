// domain/backgroundState.js

/**
 * 백그라운드 패널 롤백(restore) 동작을 건너뛸지 여부를 나타내는 상태 변수
 * - true  : 백그라운드 롤백을 건너뜀 (ex. 특정 상황에서만 예외처리)
 * - false : 패널 닫을 때 항상 롤백 동작 수행 (기본값)
 * 
 * 외부에서는 직접 let 변수로 접근하지 말고 반드시 getter/setter를 통해서만 변경/조회
 */
let skipCancelBackground = false

/**
 * skipCancelBackground 상태를 true/false로 설정
 * @param {boolean} val - 건너뛰기 여부 (true면 롤백 생략)
 */
export function setSkipCancelBackground(val) {
  skipCancelBackground = !!val
}

/**
 * skipCancelBackground 현재값을 반환
 * @returns {boolean}
 */
export function getSkipCancelBackground() {
  return skipCancelBackground
}
