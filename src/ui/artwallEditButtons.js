// ui/artwallEditButtons.js
// -------------------------------------------------------------
// [ARTWALL] 편집 시 표시되는 삭제 버튼 UI 처리 모듈
// -------------------------------------------------------------

/**
 * 아트월 삭제 버튼을 생성하고 버튼 div에 표시
 *
 * @param {THREE.Mesh} mesh - 현재 선택된 아트월 mesh
 * @param {THREE.Scene} scene - three.js scene 객체
 * @param {HTMLElement} editingButtonsDiv - 버튼을 표시할 div 요소
 * @param {Function} getArtwalls - 현재 아트월 배열을 반환하는 함수
 * @param {Function} endEditingArtwall - 편집 종료 처리 함수
 */
export function showArtwallButtons(mesh, scene, editingButtonsDiv, getArtwalls, endEditingArtwall) {
  // 기존 버튼 제거
  editingButtonsDiv.innerHTML = "";

  // 삭제 버튼 생성
  // 삭제 버튼 생성
  const del = document.createElement("button");
  del.classList.add("icon-btn", "md");
  del.innerHTML = `<img src="icons/editDelete.svg" alt="삭제" />`;


  // 삭제 버튼 클릭 핸들러
  del.onclick = () => {
    scene.remove(mesh); // 씬에서 제거

    // getArtwalls()로 배열 가져와서 splice 수행
    const arr = getArtwalls();
    const idx = arr.indexOf(mesh);
    if (idx !== -1) arr.splice(idx, 1); // 배열에서 제거

    endEditingArtwall(scene, editingButtonsDiv); // 편집 종료 처리
  };

  // 버튼 표시
  editingButtonsDiv.appendChild(del);
  editingButtonsDiv.style.display = "block";
}
