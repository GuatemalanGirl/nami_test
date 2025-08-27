// ui/exhibitionPanel.js

import {
  loadExhibitionInfo,
  saveExhibitionInfo,
  validateExhibitionPeriod,
} from "../domain/exhibition.js"

import { updateGalleryInfo } from "./galleryInfo.js"

/**
 * 전시 설정 패널의 input 필드를 초기화하고
 * 저장 버튼 클릭 시 전시 정보를 저장합니다.
 */
export function setupExhibitSettings() {
  const titleInput = document.getElementById("exhibitTitle")
  const startInput = document.getElementById("exhibitStart")
  const endInput = document.getElementById("exhibitEnd")
  const saveBtn = document.getElementById("saveExhibitButton")

  if (!titleInput || !startInput || !endInput || !saveBtn) {
    console.warn("전시 설정 요소를 찾을 수 없습니다.")
    return
  }

  // 1. 기존 저장된 정보로 UI 초기화
  const { title, startDate, endDate } = loadExhibitionInfo()
  titleInput.value = title || ""
  startInput.value = startDate || ""
  endInput.value = endDate || ""

  // 2. 저장 버튼 이벤트 바인딩
  saveBtn.addEventListener("click", () => {
    const info = {
      title: titleInput.value.trim(),
      startDate: startInput.value,
      endDate: endInput.value,
    }

    // 저장 전에 먼저 기간 유효성 검증
    if (!validateExhibitionPeriod(info.startDate, info.endDate)) {
      alert("전시 시작일이 종료일보다 앞서야 합니다.")
      return
    }

    // 검증 통과 -> 저장 및 UI 업데이트
    saveExhibitionInfo(info)
    updateGalleryInfo() 
  })

  // 3. 초기 진입 시 전시정보 UI 갱신
  updateGalleryInfo() // setupExhibitSettings 끝날 때도 초기 갤러리 정보 업데이트
}
