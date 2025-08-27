// ui/socialPanel.js

let comments = [] // award 상태를 변수로 관리 (이후 DB연동시 쿠키/로컬스토리지 등으로 확장 가능) -> 시작시 로컬 스토리지에서 불러오기
let selectedAward = localStorage.getItem("selectedAwardType")

function genId() {
  return "_" + Math.random().toString(36).substr(2, 9)
}

function formatDate(d) {
  const pad = (n) => (n < 10 ? "0" + n : n)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/* ───── social-panel 토글 ───── */
function bindSocialPanelToggle() {
  const socialToggle = document.getElementById("socialToggle")
  const socialPanel = document.getElementById("socialPanel")
  socialToggle.addEventListener("click", () => {
    // settingsPanel 이 열려 있으면 먼저 닫기
    if (document.getElementById("settingsPanel").classList.contains("open")) {
      document.getElementById("settingsToggle").click()
    }
    const isOpen = socialPanel.classList.contains("open") // 클릭 전 상태 기억

    socialPanel.classList.toggle("open")
    socialToggle.classList.toggle("open")

    // 닫히는 순간이면 입력창(댓글/대댓글) 비우기!
    if (isOpen) {
      const commentInput = document.getElementById("comment-input")
      if (commentInput) {
        commentInput.value = ""
        commentInput.style.height = "28px" // 혹시 height 자동조절중이면 min-height로
      }
      document.querySelectorAll(".reply-input").forEach(reply => {
        reply.value = ""
        reply.style.height = "28px"
      })
      // 모든 대댓글창 자체 닫기
      document.querySelectorAll(".reply-input-area").forEach(box => {
        box.remove() // 또는 box.style.display = "none"
      })
    }
  })
}

function bindCommentInputEvents() {
  const commentInput = document.getElementById("comment-input")
  const submitBtn = document.getElementById("submit-btn")
  if (!commentInput || !submitBtn) return
  commentInput.addEventListener("input", function () {
    submitBtn.disabled = commentInput.value.trim() === ""
    commentInput.style.height = "28px"
    commentInput.style.height = commentInput.scrollHeight + "px"
  })

  commentInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter" && !e.shiftKey && commentInput.value.trim() !== "") {
      e.preventDefault()
      addComment(commentInput.value.trim())
      commentInput.value = ""
      submitBtn.disabled = true
      commentInput.style.height = "28px"
    }
  })

  submitBtn.addEventListener("click", function () {
    if (commentInput.value.trim() !== "") {
      addComment(commentInput.value.trim())
      commentInput.value = ""
      submitBtn.disabled = true
      commentInput.style.height = "28px"
    }
  })
}

function addComment(text) {
  comments.push({
    id: genId(),
    text,
    time: new Date(),
    likes: 0,
    liked: false,
    children: [],
  })
  renderComments()
}

function renderComments() {
  const commentsList = document.getElementById("comments-list")
  if (!commentsList) return
  commentsList.innerHTML = "";
  comments.slice().reverse().forEach((comment) => {
    commentsList.appendChild(renderCommentItem(comment));
  });
}

function renderCommentItem(comment) {
  const commentDiv = document.createElement("div")
  commentDiv.className = "comment-item"
  commentDiv.dataset.id = comment.id

  const content = document.createElement("div")
  content.className = "comment-content"

  const textSpan = document.createElement("span")
  textSpan.textContent = comment.text
  content.appendChild(textSpan)

  const meta = document.createElement("span")
  meta.className = "meta-info"
  meta.textContent = formatDate(new Date(comment.time))
  content.appendChild(meta)

  const heartIcon = comment.liked ? "♥" : "♡"
  const heartBtn = document.createElement("button")
  heartBtn.className = "heart-btn" + (comment.liked ? " liked" : "")
  heartBtn.innerHTML = heartIcon

  const heartCount = document.createElement("span")
  heartCount.className = "heart-count"
  heartCount.textContent = comment.likes > 0 ? comment.likes : ""
  heartBtn.appendChild(heartCount)

  heartBtn.addEventListener("click", function () {
    comment.liked = !comment.liked
    if (comment.liked) comment.likes++
    else comment.likes--
    renderComments()
  })

  content.appendChild(heartBtn)

  const replyBtn = document.createElement("button")
  replyBtn.className = "reply-btn"
  replyBtn.textContent = "답글"
  replyBtn.addEventListener("click", function () {
    showReplyInput(commentDiv, comment.id)
  })

  content.appendChild(replyBtn)

  commentDiv.appendChild(content)

  if (comment.children && comment.children.length > 0) {
    const childrenDiv = document.createElement("div")
    childrenDiv.className = "children"
    comment.children.forEach((child) => {
      childrenDiv.appendChild(renderCommentItem(child))
    })
    commentDiv.appendChild(childrenDiv)
  }

  return commentDiv
}

function showReplyInput(parentDiv, commentId) {
  document
    .querySelectorAll(".reply-input-area")
    .forEach((area) => area.remove())

  const replyArea = document.createElement("div")
  replyArea.className = "reply-input-area"

  replyArea.innerHTML = `
        <textarea class="reply-input" rows="1" placeholder="답글 달기..."></textarea>
        <button class="reply-submit-btn" disabled>게시</button>
      `

  parentDiv.appendChild(replyArea)

  const replyInput = replyArea.querySelector(".reply-input")
  const replyBtn = replyArea.querySelector(".reply-submit-btn")
  const commentInput = document.getElementById("comment-input")

  replyInput.focus()

  replyInput.addEventListener("input", function () {
    replyBtn.disabled = replyInput.value.trim() === ""
    if (commentInput) {
      replyInput.style.height = "28px"
      commentInput.style.height = Math.min(commentInput.scrollHeight, 132) + "px"
    }
  })

  replyInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter" && !e.shiftKey && replyInput.value.trim() !== "") {
      e.preventDefault()
      addReply(commentId, replyInput.value.trim())
      replyArea.remove()
    }
  })

  replyBtn.addEventListener("click", function () {
    addReply(commentId, replyInput.value.trim())
    replyArea.remove()
  })
}

function addReply(parentId, text, nodes = comments) {
  for (let node of nodes) {
    if (node.id === parentId) {
      node.children.push({
        id: genId(),
        text,
        time: new Date(),
        likes: 0,
        liked: false,
        children: [],
      })
      renderComments()
      return
    }
    addReply(parentId, text, node.children)
  }
}

function bindAwardBtnEvents() {
  document.querySelectorAll(".award-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      // 이미 선택된 것 스타일 제거
      document
        .querySelectorAll(".award-btn")
        .forEach((b) => b.classList.remove("selected"))
      this.classList.add("selected")
      // 필요시 카운터 증가 등 기능 추가
      // 예: let type = this.dataset.type;
    })
  })

  document.querySelectorAll(".award-btn").forEach((btn) => {
    const type = btn.dataset.type
    if (type === selectedAward) btn.classList.add("selected")
    btn.addEventListener("click", function () {
      const thisCountElem = this.querySelector(".award-count")
      let thisCount = parseInt(thisCountElem.textContent)

      // "취소 허용" 로직
      if (selectedAward === type) {
        this.classList.remove("selected")
        thisCountElem.textContent = Math.max(thisCount - 1, 0)
        selectedAward = null
        localStorage.removeItem("selectedAwardType")
        return
      }

      // 기존 선택 해제
      if (selectedAward) {
        const prevBtn = document.querySelector(
          `.award-btn[data-type="${selectedAward}"]`,
        )
        if (prevBtn) {
          prevBtn.classList.remove("selected")
          const prevCountElem = prevBtn.querySelector(".award-count")
          let prevCount = parseInt(prevCountElem.textContent)
          prevCountElem.textContent = Math.max(prevCount - 1, 0)
        }
      }

      // 새로 선택
      this.classList.add("selected")
      thisCountElem.textContent = thisCount + 1
      selectedAward = type
      localStorage.setItem("selectedAwardType", type)
    })
  })
}

// 실제로 초기화 시 한 번에 실행할 함수
export function initSocialPanel() {
  bindSocialPanelToggle()
  bindCommentInputEvents()
  bindAwardBtnEvents()
  renderComments()
}
