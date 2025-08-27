// ui/galleryInfo.js

import { loadExhibitionInfo } from "../domain/exhibition.js";

/**
 * # 갤러리 정보 패널 업데이트 함수
 * - 도메인 모듈의 loadExhibitionInfo()로부터 상태를 읽고
 * - #galleryInfo 영역에 전시명/기간을 표시함
 */
export function updateGalleryInfo() {
  const infoDiv = document.getElementById("galleryInfo");
  if (!infoDiv) return;

  const { title, startDate, endDate } = loadExhibitionInfo();

  if (title || (startDate && endDate)) {
    infoDiv.innerHTML = `
      <div class="title">${title || "전시명 없음"}</div>
      <div class="period">${startDate || "?"} ~ ${endDate || "?"}</div>
    `;
  } else {
    infoDiv.innerHTML = "";
  }
}
