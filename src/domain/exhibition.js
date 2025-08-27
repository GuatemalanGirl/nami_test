// domain/exhibition.js
/**
 * 전시 정보 관리 모듈
 * - 기간 유효성 검사 및 만료 판정
 */

import {
  loadRawExhibitionInfo,
  saveRawExhibitionInfo,
  clearRawExhibitionInfo,
} from "../data/exhibition.js"

let exhibitInfo = {
  title: "",
  startDate: null,
  endDate: null,
}

/**
 * 저장된 전시 정보를 불러와 내부 상태 갱신 후 반환
 * @returns {{ title:string, startDate:string|null, endDate:string|null }}
 */
export function loadExhibitionInfo() {
  const saved = loadRawExhibitionInfo()
  if (saved) exhibitInfo = saved
  return { ...exhibitInfo }
}

/**
 * 입력받은 전시 정보를 내부 상태와 localStorage에 저장
 * @param {{ title:string, startDate:string, endDate:string }} info
 */
export function saveExhibitionInfo(info) {
  exhibitInfo = { ...exhibitInfo, ...info }
  saveRawExhibitionInfo(exhibitInfo)
}

/**
 * 전시 기간 유효성 검사 (시작일 < 종료일)
 * @param {string|Date} start
 * @param {string|Date} end
 * @returns {boolean}
 */
export function validateExhibitionPeriod(start, end) {
  return new Date(start) < new Date(end)
}

/**
 * 현재 날짜가 종료일을 지났는지 여부 반환
 * @returns {boolean}
 */
export function isExhibitionExpired() {
  if (!exhibitInfo.endDate) return false
  return new Date() > new Date(exhibitInfo.endDate)
}

/**
 * 전시 설정 초기화 (state & localStorage)
 */
export function resetExhibition() {
  clearRawExhibitionInfo()
  exhibitInfo = { title: "", startDate: null, endDate: null }
}
