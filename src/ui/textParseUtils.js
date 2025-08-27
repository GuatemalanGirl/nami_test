// ui/textParseUtils.js

/**
 * 여러 스타일 span 배열을 자동 줄바꿈으로 2차원 배열로 변환 (긴 단어까지 처리)
 * @param {CanvasRenderingContext2D} ctx - canvas 2D 컨텍스트
 * @param {Array} styledSpans - 스타일이 적용된 span 배열
 * @param {number} maxWidth - 한 줄 최대 너비(px)
 * @returns {Array[]} 2차원 배열(줄별로 스타일 span 배열)
 */
export function wrapStyledText(ctx, styledSpans, maxWidth) {
  let lines = []
  let curLine = []
  let curLineWidth = 0
  styledSpans.forEach((span) => {
    ctx.font = span.font
    let words = span.text.split(/(\s+)/)
    words.forEach((word) => {
      if (!word) return
      let wordWidth = ctx.measureText(word).width
      // 긴 단어(띄어쓰기 없는 긴 한글 등)도 줄바꿈 처리
      if (wordWidth > maxWidth) {
        let chars = word.split("")
        chars.forEach((char) => {
          let charWidth = ctx.measureText(char).width
          if (curLineWidth + charWidth > maxWidth && curLine.length > 0) {
            lines.push(curLine)
            curLine = []
            curLineWidth = 0
          }
          curLine.push({ ...span, text: char })
          curLineWidth += charWidth
        })
      } else {
        if (curLineWidth + wordWidth > maxWidth && curLine.length > 0) {
          lines.push(curLine)
          curLine = []
          curLineWidth = 0
        }
        curLine.push({ ...span, text: word })
        curLineWidth += wordWidth
      }
    })
  })
  if (curLine.length > 0) lines.push(curLine)
  return lines
}

/**
 * Quill 등 리치텍스트의 paragraph DOM을 스타일 span 배열로 변환
 * @param {Element} para - paragraph(dom node)
 * @param {number} DPI - 캔버스 해상도 배율
 * @param {number} fontRatio - 폰트 기준 크기(px)
 * @returns {Array} 스타일이 적용된 span 배열
 */
export function parseParagraphToSpans(para, DPI, fontRatio) {
  let spans = []
  para.childNodes.forEach((node) => {
    let text = node.textContent || ""
    let style = node.nodeType === 1 ? node.style : {}
    let color = style.color || "#222"
    let fontWeight = style.fontWeight || "normal"
    let fontStyle = style.fontStyle || "normal"
    let fontSize
    let fontFamily = '"Nanum Gothic", sans-serif' // 기본값

    // Quill class 기준 크기 동적으로 조정
    if (node.classList && node.classList.contains("ql-size-small"))
      fontSize = Math.round(fontRatio * 0.6)
    if (node.classList && node.classList.contains("ql-size-large"))
      fontSize = Math.round(fontRatio * 1.5)
    if (node.classList && node.classList.contains("ql-size-huge"))
      fontSize = Math.round(fontRatio * 2.0)
    if (!fontSize) fontSize = fontRatio // 기본(normal)

    // Quill font 클래스 -> 실제 fontFamily 매핑
    if (node.classList) {
      if (node.classList.contains("ql-font-noto-sans-kr"))
        fontFamily =
          "'Noto Sans KR', 'Apple SD Gothic Neo', '맑은 고딕', Arial, sans-serif"
      if (node.classList.contains("ql-font-nanum-gothic"))
        fontFamily =
          "'Nanum Gothic', 'Apple SD Gothic Neo', '맑은 고딕', Arial, sans-serif"
      if (node.classList.contains("ql-font-nanum-myeongjo"))
        fontFamily =
          "'Nanum Myeongjo', 'Apple SD Gothic Neo', '맑은 고딕', Arial, sans-serif"
      if (node.classList.contains("ql-font-nanum-pen-script"))
        fontFamily =
          "'Nanum Pen Script', 'Apple SD Gothic Neo', '맑은 고딕', Arial, sans-serif"
      if (node.classList.contains("ql-font-serif")) fontFamily = "serif"
      if (node.classList.contains("ql-font-sans-serif"))
        fontFamily = "sans-serif"
      if (node.classList.contains("ql-font-monospace")) fontFamily = "monospace"
    }

    if (style.fontFamily) fontFamily = style.fontFamily

    if (node.nodeType === 1 && node.tagName === "STRONG") fontWeight = "bold"
    if (node.nodeType === 1 && node.tagName === "EM") fontStyle = "italic"
    let textDecoration = style.textDecoration || ""
    if (node.nodeType === 1 && node.tagName === "U")
      textDecoration += " underline"
    let font = `${fontWeight} ${fontStyle} ${fontSize}px ${fontFamily}`
    spans.push({ text, color, font, textDecoration })
  })
  return spans
}

/**
 * Quill 등 HTML이 "실제로 비어있는지" 판단(공백, <br>, <p></p>, &nbsp; 포함)
 * @param {string} html
 * @returns {boolean}
 */
export function isActuallyEmpty(html) {
  if (!html) return true
  const stripped = html
    .replace(/<br\s*\/?>/gi, "")
    .replace(/<(p|div)>\s*<\/\1>/gi, "")
    .replace(/&nbsp;/gi, "")
    .replace(/\s+/g, "")
  return stripped === ""
}
