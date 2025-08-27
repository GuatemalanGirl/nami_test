// ui/updateIntroTextPlane.js

import * as THREE from 'three';
import { wrapStyledText, parseParagraphToSpans } from './textParseUtils.js'
import { updateIntroWallPlaneOpacity } from './introWallPlaneUtils.js'

/**
 * 대상 mesh의 표면에 텍스트(주로 전시서문)를 캔버스 텍스처로 그려서 붙임
 * 기존 텍스트 Plane이 있으면 메모리 해제 후 새로 생성/삽입
 * (intro뿐 아니라 다양한 텍스트 오브젝트에도 재사용할 수 있음)
 *
 * @param {THREE.Mesh} mesh - 텍스트를 표시할 대상 Three.js Mesh
 * @param {string} text - 표시할 텍스트(줄바꿈 포함 가능)
 * @param {object} style - { fontFamily, fontSize, color } 등 스타일 오버라이드
 */

// 배율값과 폰트크기/줄간격을 매핑
export const FONT_SIZE_TABLE = {
  0.5: 32, // 6호
  0.67: 40, // 12호
  1: 54, // 25호(기본)
  1.5: 72, // 50호
  2: 96, // 100호
}
export const LINE_HEIGHT_TABLE = {
  0.5: 40,
  0.67: 48,
  1: 66,
  1.5: 84,
  2: 120,
}

export function updateIntroTextPlane(mesh, text, style = {}) {
  // 기존 텍스트 plane이 있으면 삭제/메모리 해제
  if (mesh.userData.textPlane) {
    mesh.remove(mesh.userData.textPlane);
    mesh.userData.textPlane.material.map.dispose();
    mesh.userData.textPlane.material.dispose();
    mesh.userData.textPlane.geometry.dispose();
    mesh.userData.textPlane = null;
  }
  if (!text || text.trim() === "") return;

  // 1. geometry 비율 기반 canvas 사이즈 산출
  const geom = mesh.geometry.parameters;
  const DPI = 2;
  const w = geom.width || 3;
  const h = geom.height || 3;
  const RATIO = w / h;
  const BASE = 1024;
  const canvasW = Math.round(BASE * RATIO) * DPI;
  const canvasH = BASE * DPI;
  const marginY = canvasH * 0.1; // 상하 여백
  const marginX = canvasW * 0.12; // 좌우 여백
  const textAreaHeight = canvasH - marginY * 2;
  const textAreaWidth = canvasW - marginX * 2;
  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // 2. 스타일 파라미터 적용
  const baseFontSize = style.fontSize || mesh.userData.fontSize || 26;
  const fontSize = baseFontSize * DPI; // 고해상도
  const fontFamily =
    style.fontFamily || mesh.userData.fontFamily || "Nanum Gothic";
  const color = style.color || mesh.userData.fontColor || "#222";
  const lineHeight = fontSize + 8 * DPI;

  ctx.font = `bold ${fontSize}px "${fontFamily}", sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // 3. 텍스트 중앙에 줄별로 그리기
  const lines = text.split("\n");
  const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, canvas.width / 2, startY + i * lineHeight);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });

  // plane geometry도 크기별 고정값 사용 (0.9는 여백)
  let planeWidth = mesh.geometry.parameters.width * 0.9;
  let planeHeight = mesh.geometry.parameters.height * 0.9;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(planeWidth, planeHeight),
    mat,
  );

  // plane 위치 - 박스 표면에 살짝
  let z = 0.001;
  if (geom.depth !== undefined) z = geom.depth / 2 + 0.001;
  plane.position.set(0, 0, z);

  mesh.add(plane);
  mesh.userData.textPlane = plane;
}

/**
 * --- Quill의 HTML을 3D plane/canvas에 그리는 함수(기본 구조) ---
 * Quill 등에서 작성된 리치텍스트(HTML)을 스타일 유지하며 3D plane에 표시
 */
export function updateIntroTextPlaneFromHTML(mesh, html) {
  // 벽면서문 배경 투명도 업데이트
  updateIntroWallPlaneOpacity(mesh, html);

  // 기존 텍스트 plane 제거
  if (mesh.userData.textPlane) {
    mesh.remove(mesh.userData.textPlane);
    mesh.userData.textPlane.material.map.dispose();
    mesh.userData.textPlane.material.dispose();
    mesh.userData.textPlane.geometry.dispose();
    mesh.userData.textPlane = null;
  }
  if (!html || html.trim() === "") return;

  // 플레인의 실측(width, height, scale)로 캔버스/텍스트 계산
  const geom = mesh.geometry.parameters;
  const DPI = 2;
  // 스케일이 곱해진 '월드' 크기를 계산
  const w = (geom.width || 3) * mesh.scale.x;
  const h = (geom.height || 3) * mesh.scale.y;
  const RATIO = w / h;
  const BASE = 1024;
  const canvasW = Math.round(BASE * RATIO) * DPI;
  const canvasH = BASE * DPI;
  const marginY = canvasH * 0.1; // 상하 여백
  const marginX = canvasW * 0.12; // 좌우 여백
  const textAreaHeight = canvasH - marginY * 2;
  const textAreaWidth = canvasW - marginX * 2;
  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 폰트크기 자동 조정: 플레인에 꽉 맞게!
  const minFontPx = 24 * DPI;
  const maxFontPx = Math.round(canvasH * 0.13);
  let fontRatio = maxFontPx;
  let allLineHeights = [],
    linesAll = [],
    totalTextHeight;
  let paragraphs, maxTextWidth;

  while (fontRatio > minFontPx) {
    allLineHeights = [];
    linesAll = [];
    // html 파싱
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    paragraphs = tempDiv.querySelectorAll("p, div");
    maxTextWidth = canvasW * 0.8;

    paragraphs.forEach((para) => {
      // ── 빈 단락(<p><br></p>)도 한 줄로 취급 ──
      if (para.innerHTML === "<br>" || para.innerHTML.trim() === "") {
        linesAll.push({ lineArr: [], align: "left" });
        allLineHeights.push(Math.round(fontRatio * 1.35)); // 기본 행간
        return; // 다음 단락으로
      }
      let styledSpans = parseParagraphToSpans(para, DPI, fontRatio);
      let lines = wrapStyledText(ctx, styledSpans, maxTextWidth);
      lines.forEach((lineArr) => {
        let maxFontPx = Math.max(
          ...lineArr.map((span) => {
            const m = span.font.match(/(\d+)px/);
            return m ? parseInt(m[1]) : fontRatio;
          }),
        );
        let thisLineHeight = Math.round(maxFontPx * 1.35);
        allLineHeights.push(thisLineHeight);
        linesAll.push({
          lineArr,
          align: (() => {
            let align = "left";
            if (para.style.textAlign) align = para.style.textAlign;
            if (para.classList && para.classList.contains("ql-align-center"))
              align = "center";
            if (para.classList && para.classList.contains("ql-align-right"))
              align = "right";
            return align;
          })(),
        });
      });
    });

    totalTextHeight = allLineHeights.reduce((a, b) => a + b, 0);
    if (totalTextHeight <= canvasH - marginY * 2) break;
    fontRatio -= 4; // 조금씩 줄여가며 반복
  }

  let curY = (canvasH - totalTextHeight) / 2;

  // 출력
  for (let i = 0; i < linesAll.length; ++i) {
    let { lineArr, align } = linesAll[i];
    let thisLineHeight = allLineHeights[i];
    let lineWidth = lineArr.reduce((sum, span) => {
      ctx.font = span.font;
      return sum + ctx.measureText(span.text).width;
    }, 0);
    let x = canvasW / 2;
    if (align === "left") x = canvasW * 0.1;
    if (align === "right") x = canvasW * 0.9 - lineWidth;
    if (align === "center") x = (canvasW - lineWidth) / 2;
    let curX = x;
    lineArr.forEach((span) => {
      ctx.font = span.font;
      ctx.fillStyle = span.color;
      ctx.textBaseline = "top";
      ctx.fillText(span.text, curX, curY);
      // 밑줄
      if (span.textDecoration && span.textDecoration.includes("underline")) {
        let textWidth = ctx.measureText(span.text).width;
        let fontPx = parseInt(span.font.match(/(\d+)px/)[1]) || 28;
        // 윗줄이 아니라 "글씨 아래"에!
        let y = curY + fontPx * 1; // 폰트에 따라 0.90~ 조정 가능
        ctx.save();
        ctx.strokeStyle = span.color;
        ctx.lineWidth = Math.max(2, fontPx / 20); // 굵게! (DPI에 따라 조절)
        ctx.beginPath();
        ctx.moveTo(curX, y);
        ctx.lineTo(curX + textWidth, y);
        ctx.stroke();
        ctx.restore();
      }
      curX += ctx.measureText(span.text).width;
    });
    curY += thisLineHeight;
  }

  // plane 텍스처로 적용
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
  });

  let planeWidth = geom.width * 0.9;
  let planeHeight = geom.height * 0.9;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(planeWidth, planeHeight),
    mat,
  );
  // plane 위치(박스 표면 살짝 앞에)
  let z = 0.001;
  if (geom && geom.depth !== undefined) {
    z = geom.depth / 2 + 0.001;
  }
  plane.position.set(0, 0, z);
  mesh.add(plane);
  mesh.userData.textPlane = plane;
}