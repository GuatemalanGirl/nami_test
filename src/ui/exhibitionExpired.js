// ui/exhibitionExpired.js

import {
  isExhibitionExpired,
  resetExhibition,
  loadExhibitionInfo,
} from "../domain/exhibition.js"

import { updateGalleryInfo } from "./galleryInfo.js"

/**
 * 전시 기간이 끝났는지 확인하고,
 * 종료되었을 경우 안내 메시지와 초기화 버튼을 표시합니다.
 */
const isDevMode = false // 개발 중엔 true, 배포 시 false로 변경

export function checkExhibitPeriod() {
  if (isDevMode) return // 개발 모드에서는 만료 체크 생략

  const { endDate } = loadExhibitionInfo()
  if (!endDate) return

  if (isExhibitionExpired()) {
    document.body.innerHTML = `
      <div style="text-align:center; margin-top:50px;">
        <h1>전시가 종료되었습니다</h1>
        <button id="resetExhibitButton" style="
          margin-top:20px; padding:10px 20px;
          background-color:#ff6666; color:white;
          font-size:18px; border:none; border-radius:20px;
          cursor:pointer;
        ">
          X
        </button>
      </div>
    `

    const resetBtn = document.getElementById("resetExhibitButton")
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        resetExhibition()
        updateGalleryInfo() // ✅ reset 이후 UI 갱신
        alert("전시 설정이 초기화되었습니다! 새로고침됩니다.")
        location.reload()
      })
    }
  }
}
