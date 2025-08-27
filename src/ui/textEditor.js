// ui/textEditor.js

// 모듈 범위에 quill 인스턴스 저장 (여러 곳에서 동일 인스턴스 사용)
// 필요시 selector별로 여러 개 생성하도록 확장 가능
let quill = null; // Quill에디터 인스턴스

/**
 * Quill 기반 텍스트 입력 오버레이 준비 함수
 * 
 * Quill 에디터 준비(최초 한번만)
 * 여러 곳(전시서문, 작품이야기 등)에서 사용할 수 있음
 * 
 * @param {string} selector - 에디터를 붙일 DOM 셀렉터 (기본: #quillEditor)
 * @returns {Quill} - 생성되거나 이미 초기화된 Quill 인스턴스
 */
export function setupQuillEditor(selector = "#quillEditor") {
  if (!quill) {
    // 1) Quill 폰트 Whitelist 선언 (최초 한번만)
    const Font = Quill.import("formats/font");
    Font.whitelist = [
      "noto-sans-kr",
      "nanum-gothic",
      "nanum-myeongjo",
      "nanum-pen-script",
      "serif",
      "sans-serif",
      "monospace",
    ];
    Quill.register(Font, true);

    // 2) 한글 폰트가 포함된 툴바로 생성
    quill = new Quill(selector, {
      modules: {
        toolbar: [
          [{ font: Font.whitelist }, { size: [] }],
          ["bold", "italic", "underline", { color: [] }],
          [{ align: [] }],
        ],
      },
      theme: "snow",
    });

    // 3) 에디터 폰트 CSS도 함께(스타일시트가 이미 있으면 생략)
    const style = document.createElement("style");
    style.innerHTML = `
      .ql-editor {
        font-family:
          'Noto Sans KR', 'Nanum Gothic', 'Nanum Myeongjo', 'Nanum Pen Script',
          'Apple SD Gothic Neo', '맑은 고딕', Arial, sans-serif !important;
      }
      .ql-font-noto-sans-kr {
        font-family: 'Noto Sans KR', 'Apple SD Gothic Neo', '맑은 고딕', Arial, sans-serif;
      }
      .ql-font-nanum-gothic {
        font-family: 'Nanum Gothic', 'Apple SD Gothic Neo', '맑은 고딕', Arial, sans-serif;
      }
      .ql-font-nanum-myeongjo {
        font-family: 'Nanum Myeongjo', 'Apple SD Gothic Neo', '맑은 고딕', Arial, sans-serif;
      }
      .ql-font-nanum-pen-script {
        font-family: 'Nanum Pen Script', 'Apple SD Gothic Neo', '맑은 고딕', Arial, sans-serif;
      }
      .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="noto-sans-kr"]::before,
      .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="noto-sans-kr"]::before {
        content: "Noto Sans KR";
      }
      .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="nanum-gothic"]::before,
      .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="nanum-gothic"]::before {
        content: "나눔고딕";
      }
      .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="nanum-myeongjo"]::before,
      .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="nanum-myeongjo"]::before {
        content: "나눔명조";
      }
      .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="nanum-pen-script"]::before,
      .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="nanum-pen-script"]::before {
        content: "나눔펜";
      }
    `;
    document.head.appendChild(style);
  }
  return quill;
}

/**
 * 이미 초기화된 Quill 인스턴스를 반환
 * 필요에 따라 직접 접근하고 싶을 때 사용
 */
export function getQuillInstance() {
  return quill;
}
