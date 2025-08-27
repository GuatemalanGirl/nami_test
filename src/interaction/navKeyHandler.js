// interaction/navKeyHandler.js

export function handleNavKeyDown(e) {
   const socialPanel = document.querySelector(".social-panel")

  // 소셜 패널이 열려 있으면 ───
  if (socialPanel && socialPanel.classList.contains("open")) {
    const active = document.activeElement

    // 댓글/답글 입력창이면 아무 제한 없이 통과
    const isTyping =
      active.tagName === "INPUT" ||
      active.tagName === "TEXTAREA" ||
      active.classList.contains("ql-editor")

    if (!isTyping) {
      // 입력창이 아닐 때만 네비게이션 관련 키 차단
      const navKeys = [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
        " ",
        "a",
        "A",
        "d",
        "D",
        "w",
        "W",
        "s",
        "S",
      ]
      if (navKeys.includes(e.key)) {
        e.preventDefault()
        e.stopPropagation()
        return // ⇦ 여기서 조기 종료 → navButtons 클릭 로직까지 안 내려감
      }
    }
  }

  // ─── 입력란 포커스일 땐 네비 off ───
  const active = document.activeElement
  if (
    active.tagName === "INPUT" ||
    active.tagName === "TEXTAREA" ||
    active.classList.contains("ql-editor")
  ) {
    return
  }

  // ─── navButtons 단축키 처리 ───
  switch (e.key) {
    case "ArrowLeft":
    case "a":
    case "A":
      document.getElementById("leftButton")?.click()
      break
    case "ArrowRight":
    case "d":
    case "D":
      document.getElementById("rightButton")?.click()
      break
    case "ArrowUp":
    case "w":
    case "W":
      document.getElementById("infoButton")?.click()
      break
    case "ArrowDown":
    case "s":
    case "S":
      document.getElementById("homeButton")?.click()
      break
  }
}
