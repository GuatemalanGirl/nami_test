// ui/paintingEditButtons.js

import * as THREE from 'three'
import { getIntroMode } from '../domain/introMode.js'
import { showFrameColorPicker } from './frameColorPicker.js'
import { focusIntroWithEditor } from './introOverlayEditor.js'
import { showPaintingStoryEditor } from './paintingStoryEditor.js'
import { showPaintingResizeButtons } from './paintingResizeButtons.js'
import { updateResizeHandlePosition, createResizeHandle } from './resizeHandle.js'
import { deletePainting } from '../domain/painting.js'
import { showOutline } from './outline.js'

// 편집 버튼 영역 DOM (초기화 시점에 존재해야 함)
const editingButtonsDiv = document.getElementById("paintingEditButtons")

/**
 * 확인(Apply) 직후 mesh가 새 객체로 교체되는 경우가 있어
 * 바인딩 당시 mesh(캡처값)가 stale이 되지 않도록 클릭 시점마다 최신 대상을 찾기
 * 우선순위: parent가 살아있는지 -> userData.id로 찾기 ->? name으로 찾기
 */
function resolveFreshTarget(mesh, scene) {
  if (mesh && mesh.parent) return mesh
  const id = mesh?.userData?.id
  if (id && typeof scene?.getObjectByProperty === 'function') {
    const byId = scene.getObjectByProperty('userData.id', id)
    if (byId) return byId
  }
  if (mesh?.name && typeof scene?.getObjectByName === 'function') {
    const byName = scene.getObjectByName(mesh.name)
    if (byName) return byName
  }
  return null
}

// === 선택된 작품 Mesh 하위에서 캡션 Mesh 찾기(유연 매칭)
function findCaptionChild(paintingMesh) {
  if (!paintingMesh) return null
  // 1) userData.type === 'caption' 우선
  const byType = paintingMesh.getObjectByProperty?.('userData.type', 'caption')
  if (byType) return byType
  // 2) name === 'captionBox' 대체 매칭
  const byName = paintingMesh.getObjectByName?.('captionBox')
  if (byName) return byName
  // 3) 자식들 중 흔한 속성 패턴 스캔(혹시 모를 사용자 정의 네이밍 대응)
  if (paintingMesh.traverse) {
    let found = null
    paintingMesh.traverse(obj => {
      if (found) return
      if (obj?.userData?.type === 'caption' || obj?.name === 'captionBox') {
        found = obj
      }
    })
    if (found) return found
  }
  return null
}

/**
 * 편집 버튼 영역을 mesh의 상태에 맞게 표시
 * @param {THREE.Mesh} mesh 편집할 대상 mesh
 */
export function showPaintingEditButtons(mesh, scene, camera, controls, quill) {
  // 현재 모드(작품선택/서문쓰기)를 구분
  // isPaintingMode, isIntroMode 등 상태 변수는 패널 전환 함수 등에서 반드시 관리!
  // mesh.userData.type === 'intro-frame' 또는 'intro-plane'이면 서문

  // 버튼 영역 비우기
  editingButtonsDiv.innerHTML = ""

  // 캡션은 편집버튼을 절대 띄우지 않음
  if (mesh?.userData?.type === 'caption' || mesh?.userData?.blocksEditing) return;

  // 크기조절 버튼
  const resizeBtn = document.createElement("button")
  resizeBtn.classList.add("icon-btn", "md")
  resizeBtn.innerHTML = `<img src="/icons/editSize.svg" alt="크기조절" />`
  // 여기에 핸들러 모드 진입 트리거 추가
  resizeBtn.onclick = () => {
    // 클릭 시점에 최신 대상 재조회(확인 직후 stale 참조 방지)
    const target = resolveFreshTarget(mesh, scene)
    if (!target) {
      console.warn('[resize] target not found or detached; aborting')
      return
    }
    // 기존 버튼 기반 모드는 그대로 두되, 핸들러 모드도 최신 대상 기준으로 초기화
    showPaintingResizeButtons(target, scene, camera, controls, quill)
    // 프로젝트의 시그니처가 (mesh, scene)인 현재 형태 유지
    createResizeHandle(target, scene)
    // 만약 createResizeHandle이 옵션 객체 시그니처라면:
    // createResizeHandle(target, { scene })
  }
  editingButtonsDiv.appendChild(resizeBtn)

  // 작품선택모드에서 "작품이야기" 버튼 추가
  if (mesh.userData.isPainting && !mesh.userData.type?.startsWith("intro") && mesh.userData.type !== 'poster') {
    const storyBtn = document.createElement("button")
    storyBtn.classList.add("icon-btn", "md")
    storyBtn.innerHTML = `<img src="/icons/editText.svg" alt="작품이야기" />`
    storyBtn.onclick = () => showPaintingStoryEditor(mesh, scene, camera, controls, quill)
    editingButtonsDiv.appendChild(storyBtn)
  }

  // === 작품 개별 "캡션 보이기/숨기기" 토글 버튼
  if (mesh.userData.isPainting && !mesh.userData.type?.startsWith("intro") && mesh.userData.type !== 'poster') {
    const captionToggleBtn = document.createElement("button")
    captionToggleBtn.classList.add("icon-btn", "md")
    
    // 상태별 아이콘 경로
    const ICON_ON  = "/icons/navInfo.svg"
    const ICON_OFF = "/icons/navInfoOff.svg"

    // 최신 대상/캡션 포인터를 클릭 시마다 갱신
    const resolveAndSetIcon = () => {
      const target = resolveFreshTarget(mesh, scene) ?? mesh
      const caption = findCaptionChild(target)
      // 상태 값 우선순위: caption.visible -> mesh.userData.captionVisible (캐시)
      const visible = caption ? caption.visible : (mesh.userData.captionVisible ?? false)

      captionToggleBtn.innerHTML = caption
      ? `<img src="${visible ? ICON_ON : ICON_OFF}" alt="캡션" />`
      : `<img src="${ICON_OFF}" alt="캡션 없음" />`

      captionToggleBtn.disabled = !caption // 캡션이 없으면 비활성화
    }

    // 최초 아이콘 설정
    resolveAndSetIcon()

    captionToggleBtn.onclick = () => {
      const target = resolveFreshTarget(mesh, scene) ?? mesh
      const caption = findCaptionChild(target)
      if (!caption) {
        console.warn('[caption] no caption child found under painting:', target?.name || target)
        resolveAndSetIcon()
        return
      }

      // 토글
      caption.visible = !caption.visible
      // 캐시에 상태도 기록(저장/복구 로직에서 활용 가능)
      target.userData.captionVisible = caption.visible

      // 라벨 업데이트
      resolveAndSetIcon()
    }

    editingButtonsDiv.appendChild(captionToggleBtn)
  }

  // 프레임서문(intro-frame)이면서, 전시서문쓰기 모드일 때만 "프레임색상" 버튼 추가
  if (mesh.userData.type === "intro-frame" && getIntroMode()) {
    const colorBtn = document.createElement("button")
    colorBtn.classList.add("icon-btn", "md")
    colorBtn.innerHTML = `<img src="/icons/editColor.svg" alt="프레임색상" />`
    colorBtn.onclick = () => showFrameColorPicker(mesh, editingButtonsDiv, scene, camera, controls, quill)
    editingButtonsDiv.appendChild(colorBtn)
  }

  // 서문 + 서문쓰기모드라면 텍스트입력 버튼도 추가
  const isIntro =
    mesh.userData.type === "intro-frame" || mesh.userData.type === "intro-plane"
  if (isIntro && getIntroMode()) {
    const editTextBtn = document.createElement("button")
    editTextBtn.classList.add("icon-btn", "md")
    editTextBtn.innerHTML = `<img src="/icons/editText.svg" alt="텍스트입력" />`
    editTextBtn.onclick = () => focusIntroWithEditor(mesh, camera, controls, quill) // 아래 별도 정의
    editingButtonsDiv.appendChild(editTextBtn)
  }

  // 전시 포스터일 때 업로드 버튼 표시
  if (mesh.userData.type === 'poster') {
    const uploadBtn = document.createElement("button")
    uploadBtn.classList.add("icon-btn", "md")
    uploadBtn.innerHTML = `<img src="/icons/editPoster.svg" alt="포스터 올리기" />`
    uploadBtn.onclick = () => openPosterFilePicker(mesh)
    editingButtonsDiv.appendChild(uploadBtn)
  }

  // 버튼 영역 보여주기
  editingButtonsDiv.style.display = "flex"

  // 삭제 버튼
  const deleteBtn = document.createElement("button")
  deleteBtn.classList.add("icon-btn", "md")
  deleteBtn.innerHTML = `<img src="/icons/editDelete.svg" alt="삭제" />`
  deleteBtn.onclick = () => {
    // parent가 없으면 씬에서 이름으로 최신 객체 찾기
    const target = mesh?.parent 
      ? mesh 
      : (scene?.getObjectByName?.(mesh?.name) ?? mesh)

    deletePainting(target, scene)
  }
  editingButtonsDiv.appendChild(deleteBtn)
}

// 포스터 파일 선택 -> 텍스처 적용
function openPosterFilePicker(mesh) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    await applyPosterTextureFromFile(mesh, file)
  }
  input.click()
}

async function applyPosterTextureFromFile(mesh, file) {
  const url = URL.createObjectURL(file)
  const loader = new THREE.TextureLoader()

  loader.load(
    url,
    (tex) => {
      // 기존 텍스처 해제 후 교체
      const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
      if (mat.map && mat.map !== tex) {
        mat.map.dispose?.()
      }
      mat.map = tex
      mat.color.set(0xffffff) // 이미지가 씌워질 때 배경색 영향 제거
      mat.needsUpdate = true

      // 이미지 원본 비율에 맞춰 스케일 보정 (지오메트리 폭/높이 기준)
      const img = tex.image;
      if (img?.width && img?.height) {
        const aspect = img.width / img.height; // w/h
        const baseScale = mesh.userData._baseScale || mesh.scale.clone();
        const scaleValue = mesh.userData.scaleValue ?? 1;
        // 지오메트리의 "기본 폭/높이"(예: 3×3 정사각형)
        const baseW = mesh.geometry?.parameters?.width  ?? 1;
        const baseH = mesh.geometry?.parameters?.height ?? 1;
        // 현재 정책: 높이축(Y)을 기준으로 비율을 맞추고, 폭(X)을 이미지 비율에 맞게 환산
        const targetH = baseH * baseScale.y * scaleValue; // 최종 높이
        const targetW = targetH * aspect;                  // 최종 폭
        // 최종 scale = (실제 목표 / 지오메트리 기본값)
        const sx = targetW / baseW;
        const sy = targetH / baseH;
        mesh.scale.set(sx, sy, mesh.scale.z);
 
        // 스케일 변경에 맞춰 UI 보조물 갱신
        // 기존 핸들이 있으면 위치 갱신, 없으면 생성
        try {
          updateResizeHandlePosition?.(mesh);
        } catch {
          // update 함수가 없는 버전이면 재생성 방식으로 처리
          createResizeHandle?.(mesh, mesh.parent?.isScene ? mesh.parent : undefined);
        }
        // 아웃라인 재생성(내부에서 기존 outline 제거 후 생성)
        showOutline?.(mesh, mesh.parent?.isScene ? mesh.parent : undefined);
      }

      tex.needsUpdate = true
      URL.revokeObjectURL(url)
    },
    undefined,
    (err) => {
      console.error('포스터 텍스처 로드 실패', err)
      URL.revokeObjectURL(url)
    }
  )
}

/**
 * 편집 버튼 영역 숨기기
 */
export function hidePaintingEditButtons() {
  editingButtonsDiv.style.display = "none"
}
