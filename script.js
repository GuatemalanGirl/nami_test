import * as THREE from "three"
import { createCamera } from "./src/core/camera.js"
import {
  PAINTING_Y_OFFSET,
  ROOM_DEPTH,
  ROOM_HEIGHT,
  ROOM_WIDTH
} from './src/core/constants.js'
import { createControls } from "./src/core/controls.js"
import { addDefaultLights, setupEnvironment } from './src/core/lighting.js'
import { createRenderer } from "./src/core/renderer.js"
import { createScene } from "./src/core/scene.js"
import { createRaycaster } from './src/core/raycaster.js';
import { createPointer, updatePointer } from './src/core/pointer.js'; // 캔버스 기준 좌표 계산 유틸 포함
import {
  fetchArtwallsData
} from './src/data/artwall.js'
import {
  fetchPaintingsData
} from "./src/data/painting.js"
import {
  fetchTextureSets, setTexturePage
} from './src/data/texture.js'
import { getArtwalls, commitArtwallChanges } from './src/domain/artwall.js'
import { getArtwallMode } from './src/domain/artwallMode.js'
import { getSkipCancelBackground } from './src/domain/backgroundState.js'
import { commitIntroChanges, getTempIntroMeshes } from './src/domain/intro.js'
import {
  commitPaintingChanges,
  getPaintings,
  getSelectedPainting,
  setSelectedPainting,
  getTempPaintings
} from './src/domain/painting.js'
import {
  endEditingPainting,
  getEditingPainting,
  startEditingPainting
} from './src/domain/paintingEditing.js'
import { getPaintingMode } from './src/domain/paintingMode.js'
import { getIntroMode } from "./src/domain/introMode.js"
import { createRoom } from "./src/domain/room.js"
import {
  getConfirmedTextureSet,
  setConfirmedTextureSet,
  setSelectedTextureSet
} from './src/domain/texture.js'
import { getCurrentWall } from './src/domain/wall.js'
import { getZoomedInState } from './src/domain/zoomState.js'
import { handleNavKeyDown } from './src/interaction/navKeyHandler.js'
import { navigateLeft, navigateRight } from './src/interaction/paintingNavigation.js'
import { moveCameraToHome, onClick, onDoubleClick, attachAutoReturnOnZoomOut } from './src/interaction/zoomControls.js'
import { populateArtwallGrid, setupArtwallPagination, initArtwallGridResponsive } from "./src/ui/artwallGrid.js"
import { checkExhibitPeriod } from './src/ui/exhibitionExpired.js'
import { setupExhibitSettings } from './src/ui/exhibitionPanel.js'
import { updateGalleryInfo } from "./src/ui/galleryInfo.js"
import { closeInfo, showInfo, initInfoModal } from './src/ui/infoModal.js'
import { populateIntroGrid } from "./src/ui/introGrid.js"
import { populatePaintingGrid, setupPaintingPagination, initPaintingGridResponsive } from "./src/ui/paintingGrid.js"
import { getIsResizingPainting } from './src/ui/paintingResizeButtons.js'
import { showPanel, setupPanelAutoClose } from './src/ui/panel.js'
import { initSocialPanel } from './src/ui/socialPanel.js'
import {
  applyPreviewTextureSet,
  onRestoreTextureSet,
  populateTextureGrid,
  setupApplyButton,
  setupTexturePagination,
  initTextureGridResponsive
} from './src/ui/textureGrid.js'
import { addWallNavListeners, alignToCameraWall } from './src/ui/wallNavigation.js'
import {
  startEditingArtwall,
  endEditingArtwall,
  getEditingArtwall
} from './src/domain/artwallEditing.js'
import {
  onResizeHandlePointerDown,
  onResizeHandlePointerMove,
  onResizeHandlePointerUp,
  getIsResizingWithHandle
} from './src/interaction/resizeHandles.js'
import { animate } from './src/core/loop.js'
import { getCurrentPaintingIndex } from './src/domain/currentPainting.js'
import { detectWall } from "./src/core/order.js"
import { registerDropEvents } from './src/ui/dropHandlers.js'
import { registerPaintingDragHandlers } from './src/interaction/paintingDragHandlers.js';
import { registerArtwallDragHandlers } from './src/interaction/artwallDragHandlers.js';
import { setupQuillEditor } from "./src/ui/textEditor.js"
import { registerGlobalInputBlocker } from './src/ui/globalInputBlocker.js'
import { markAsColorTexture } from "./src/core/colorManagement.js"

let scene, camera, renderer, controls, raycaster, pointer, quill;

let editingButtonsDiv = document.getElementById("paintingEditButtons") // 하단 버튼 컨테이너
// 편집버튼 클릭 시, 이벤트 전파 차단 (편집 종료 안 되게)
if (editingButtonsDiv) { // 널 가드
  editingButtonsDiv.addEventListener("mousedown", function (e) {
    e.stopPropagation()
  })
}

const textureLoader = new THREE.TextureLoader()

/* ─────────────────────────────────────────────────────────
 * 글로벌 sRGB 훅: 이 loader로 로드되는 모든 텍스처를 sRGB로 표시
 *  - 색 보정이 onLoad 타이밍에 적용되도록 보장
 *  - 개별 모듈에서 중복 적용되어도 안전
 * ───────────────────────────────────────────────────────── */
;(() => {
  const _origLoad = textureLoader.load.bind(textureLoader);
  textureLoader.load = (url, onLoad, onProgress, onError) => {
    return _origLoad(
      url,
      (tex) => {
        try { markAsColorTexture(tex); } catch {}
        tex.needsUpdate = true; // onLoad라 안전
        onLoad && onLoad(tex);
      },
      onProgress,
      onError
    );
  };
})();

// 일부 버전에서 색관리 플래그가 필요할 수 있음
if (THREE.ColorManagement && 'enabled' in THREE.ColorManagement) {
  THREE.ColorManagement.enabled = true;
}

// 터치 탭 중복 호출 방지용 스로틀 타임스탬프
let __lastTouchTapAt = 0;

async function init() {
  scene = createScene();
  camera = createCamera();
  renderer = createRenderer(onWindowResize);
  window.__galleryCanvas = renderer.domElement; // 폴백 드롭 타겟
  raycaster = createRaycaster();
  pointer = createPointer();
  controls = createControls(camera, renderer.domElement, {
    targetOffsetY: PAINTING_Y_OFFSET,
    enableDamping: true,
    dampingFactor: 0.1,
    rotateSpeed: 0.5,
    zoomSpeed: 1.0,
    panSpeed: 0.4
  });

  // scene 꼭 넘겨주기 + 상대 임계 강화(약간만 뒤로 가도 복귀)
  attachAutoReturnOnZoomOut({
    camera,
    controls,
    scene,
    useRelative: true,
    delta: 0.35,      // 기존 0.7보다 민감
    cooldownMs: 500,
    respectMode: true,
    debug: false,     // 필요시 true로 전환해 로그 확인
  });

  quill = setupQuillEditor('#quillEditor');

  // infoModal이 필요로 하는 컨텍스트 주입 (여기!)
  initInfoModal({ scene, camera, controls, quill });

  // 조명은 renderer 스케일에 맞춰 세기로 보정 가능
  addDefaultLights(scene, renderer);   // renderer 인자 추가
  setupEnvironment(scene, renderer);   // RoomEnvironment/PMREM 기반 IBL 

  // 드래그앤드롭 이벤트 등록
  registerDropEvents(renderer.domElement, {
  scene, renderer, camera, raycaster, textureLoader,
  getTempPaintings, getPaintings, getTempIntroMeshes, getIntroMode
  });

  const start = Date.now()

  createRoom(scene, textureLoader)
  // await placePaintings() // 작품 자동 배치
  
  const elapsed = Date.now() - start
  const minDuration = 1000
  const remaining = Math.max(0, minDuration - elapsed)

  setTimeout(() => {
    document.getElementById("loadingScreen").classList.add("hidden")
    showInstructions()
  }, remaining)

  document.getElementById("instructionOverlay").addEventListener("click", hideInstructions)
  document.getElementById("leftButton").addEventListener("click", () => {
    navigateLeft(getPaintings(), camera, controls)
  })
  document.getElementById("rightButton").addEventListener("click", () => {
    navigateRight(getPaintings(), camera, controls)
  })

  document.getElementById("infoButton").onclick = () => {
    const modal = document.getElementById("infoModal");
    const isVisible = modal && getComputedStyle(modal).display !== "none";

    if (isVisible) {
      closeInfo();
      return;
    }

    const sel = getSelectedPainting();
    if (sel?.userData?.data) {
      // showInfo 안에서 updatePaintingInfo 를 호출하므로 중복 호출 불필요
      showInfo(sel.userData.data, sel);
    } else {
      console.warn("선택된 작품이 없습니다");
    }
  };

  document.getElementById("closeInfoButton").addEventListener("click", closeInfo)

  // 🔧 터치/마우스 분리: 마우스는 click/dblclick 유지, 터치는 pointerup/touchend에서 직접 처리
  const canvas = renderer.domElement;
  canvas.style.touchAction = 'none'; // 브라우저 제스처(더블탭/스크롤) 차단

  // 마우스 전용 click (터치는 pointerup에서 처리)
  canvas.addEventListener("click", (e) => {
    if ('pointerType' in e && e.pointerType !== 'mouse') return;
    onClick(e, camera, controls, raycaster, pointer, getPaintings(), scene, renderer);
  }, { passive: true });
  
  // 마우스 전용 dblclick
  canvas.addEventListener("dblclick", (e) => {
    if ('pointerType' in e && e.pointerType !== 'mouse') return;
    onDoubleClick(e, camera, controls, raycaster, pointer, getPaintings(), scene, renderer);
  });

  // (보강) iOS 등 일부 환경에서 click 합성 누락 대비: touchend에서도 보장
  canvas.addEventListener(
    "touchend",
    (event) => {
      // 멀티터치는 무시
      if (event.touches && event.touches.length > 1) return;

      const now = performance.now();
      if (now - __lastTouchTapAt < 60) return; // pointerup에서 이미 처리
      __lastTouchTapAt = now;

      if (event.cancelable) event.preventDefault(); // cancelable 체크 추가

      // 좌표는 onClick 내부(BCR 기준)에서 처리되도록 event를 그대로 전달
      onClick(event, camera, controls, raycaster, pointer, getPaintings(), scene, renderer);
    },
    { passive: false },
  )

  // 마우스 드래그로 그림 위치 이동
  registerPaintingDragHandlers(renderer.domElement, {
    getIsResizingWithHandle,
    getIsResizingPainting,
    getPaintingMode,
    getSelectedPainting,
    setSelectedPainting,
    getEditingPainting,
    startEditingPainting,
    endEditingPainting,
    getPaintings,
    getCurrentWall,
    ROOM_WIDTH,
    ROOM_HEIGHT,
    ROOM_DEPTH,
    detectWall,
    camera,
    raycaster,
    scene,
    controls,
    quill
  })

  registerArtwallDragHandlers(renderer.domElement, {
    getArtwallMode,
    getCurrentWall,
    getArtwalls,
    detectWall,
    getEditingArtwall,
    startEditingArtwall,
    endEditingArtwall,
    ROOM_WIDTH,
    ROOM_HEIGHT,
    ROOM_DEPTH,
    camera,
    raycaster,
    scene,
    editingButtonsDiv
  })

  renderer.domElement.addEventListener("mousemove", onPointerMove)

  animate(scene, camera, renderer, controls, raycaster, pointer)
}

// 리사이즈 콜백 함수
function onWindowResize() {
  // 카메라 종횡비 업데이트
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()

  // 렌더러 픽셀 비율·사이즈 업데이트
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
}

document.getElementById("settingsToggle").addEventListener("click", () => {
  // socialPanel 이 열려 있으면 먼저 닫기
  if (document.getElementById("socialPanel").classList.contains("open")) {
    document.getElementById("socialToggle").click()
  }

  const panel = document.getElementById("settingsPanel")
  const gear = document.getElementById("settingsToggle")
  const isOpen = panel.classList.contains("open")
  const currentActive = document.querySelector(".settings-slide.active")
  const currentId = currentActive?.id

  if (isOpen) {
    if (currentId === "panel-background" && !getSkipCancelBackground()) {
      onRestoreTextureSet() // 톱니로 닫을 때 롤백
    }

    if (currentId === "panel-paintings") {
      commitPaintingChanges(scene, controls)
    }

    // ───────── panel-intro 롤백 ─────────
    if (currentId === "panel-intro") {
      commitIntroChanges()
    }

    // ───────── panel-artwalls 롤백 (outline 정리 추가) ─────────
    if (currentId === "panel-artwalls") {
      commitArtwallChanges(scene)
    }

    // 슬라이드 상태를 메인으로 되돌린 뒤 패널 닫기
    showPanel("panel-main", camera, controls)
    panel.classList.remove("open")
    gear.classList.remove("moving")

    // 패널 닫을 때 navButtons/Toggle 다시 보이기
    document.getElementById("navButtons")?.classList.remove("slide-down")       
    const _navToggle = document.getElementById("navButtonsToggle")               
    _navToggle?.classList.remove("slide-down")                                   
    _navToggle?.style.removeProperty('display')                                   

  } else {
    if (document.getElementById("infoModal").style.display === "block") {
      closeInfo()
    }
    showPanel("panel-main", camera, controls) // 설정창 열 때 항상 메인 패널부터 시작
    panel.classList.add("open")
    gear.classList.add("moving")

    // 패널 열릴 때 navButtons/Toggle 숨기기
    document.getElementById("navButtons")?.classList.add("slide-down")           
    const _navToggle = document.getElementById("navButtonsToggle")              
    _navToggle?.classList.add("slide-down")                                     
    _navToggle && (_navToggle.style.display = 'none')                             
  }
})

function onPointerMove(event) {
  // 캔버스 기준 정규화 좌표 사용(레이캐스트 정확도 향상)
  updatePointer(event, pointer, renderer)
  raycaster.setFromCamera(pointer, camera)
  const paintings = getPaintings()
  const hits = raycaster.intersectObjects(paintings, true) // 자식까지 감지(캡션 등)
  const canvas = renderer.domElement
  if (
    getZoomedInState() &&
    hits.length > 0 &&
    hits[0].object === paintings[getCurrentPaintingIndex()]
  ) {
    canvas.classList.add("grab")
    canvas.classList.remove("hovering")
  } else if (hits.length > 0) {
    canvas.classList.add("hovering")
    canvas.classList.remove("grab")
  } else {
    canvas.classList.remove("hovering", "grab")
  }
}

const overlay = document.getElementById('instructionOverlay');

function showInstructions() {
  // 보이기: CSS가 opacity/visibility로 페이드 인
  overlay.setAttribute('data-visible', 'true');
}

function hideInstructions() {
  // 숨기기: CSS가 opacity/visibility로 페이드 아웃
  overlay.removeAttribute('data-visible');
}

// 클릭해서 닫기
overlay.addEventListener('click', hideInstructions);


async function initApp() {
  // 먼저 저장된 texture set을 미리 기억해둠
  const savedTextureSet = localStorage.getItem("selectedTextureSet")
  if (savedTextureSet) {
    setConfirmedTextureSet(savedTextureSet) // setter 함수 사용
    setSelectedTextureSet(savedTextureSet)
  }

  try {
    // 외부 데이터 fetch
    await fetchPaintingsData();     // paintingsData 내부에 자동 저장됨
    await fetchTextureSets();       // 배경 textureSets
    await fetchArtwallsData();      // 아트월

    // 초기화
    await init(); // Three.js 초기화

    // === 배경 패널 썸네일 생성 (페이징 적용) ===
    initTextureGridResponsive((name) =>
      applyPreviewTextureSet(name, scene, textureLoader)
    );
    setupTexturePagination((name) =>
      applyPreviewTextureSet(name, scene, textureLoader)
    );
  
    setupApplyButton(scene, textureLoader);

    // 썸네일 그리드 및 페이징 UI
    setupArtwallPagination();       // artwallGrid.js에서 import
    initArtwallGridResponsive();          // artwallGrid.js에서 import

    setupPaintingPagination();      // paintingGrid.js에서 import
    initPaintingGridResponsive();         // paintingGrid.js에서 import

    // 미리 선택된 텍스처 세트 적용
    const confirmedSet = getConfirmedTextureSet()
    if (confirmedSet) {
      applyPreviewTextureSet(confirmedSet, scene, textureLoader)
    }

    // 기타 전시 설정 및 정보 갱신
    setupExhibitSettings();
    checkExhibitPeriod();
    updateGalleryInfo();

    // 패널 외부 클릭 시 닫기 기능 초기화
    setupPanelAutoClose();

     // 전역 입력 차단기 등록
    registerGlobalInputBlocker();

    // 핸들러 드래그 이벤트 바인딩
    const canvas = renderer.domElement;

    canvas.addEventListener("pointerdown", (e) => {
      // 리사이즈 핸들에 실제 히트한 경우에만 기본 제스처 차단
      const engaged = onResizeHandlePointerDown(e, raycaster, pointer, camera, renderer);
      if (engaged && e.cancelable) e.preventDefault();
    }, { passive: false }); // preventDefault 허용

    canvas.addEventListener("pointermove", (e) =>
      onResizeHandlePointerMove(e, raycaster, pointer, camera, renderer, scene),
      { passive: false } // 터치 제스처 충돌 방지
    );

    canvas.addEventListener("pointerup", (e) => {
      try { e.target.releasePointerCapture?.(e.pointerId); } catch {}
      onResizeHandlePointerUp(scene);

      // 터치에서는 click 합성이 누락될 수 있으므로 pointerup에서 직접 onClick 실행
      if (e.pointerType === 'touch') {
        __lastTouchTapAt = performance.now();
        onClick(e, camera, controls, raycaster, pointer, getPaintings(), scene, renderer);
        if (e.cancelable) e.preventDefault();
      }
    }, { passive: false });

    canvas.addEventListener("pointercancel", (e) => {
      try { e.target.releasePointerCapture?.(e.pointerId); } catch {}
      onResizeHandlePointerUp(scene);
    }, { passive: true });

  } catch (err) {
    alert("그림 정보를 불러오는 데 실패했습니다!");
    console.error(err);
  }

  /*updateAllWallLabels() // 처음 레이블 세팅*/
  addWallNavListeners(camera, controls) // 버튼 리스너 등록
  populateIntroGrid() // 이 함수가 썸네일 생성 + dragstart 이벤트까지 담당
  initSocialPanel() // socialPanel(댓글/어워드 패널) 전체 이벤트/렌더 초기화

  document.getElementById('themeBtn').onclick = () => showPanel('panel-theme', camera, controls);
  document.getElementById('bgBtn').onclick = () => showPanel('panel-background', camera, controls);
  document.getElementById('paintingsBtn').onclick = () => { 
    showPanel('panel-paintings', camera, controls, scene)
    requestAnimationFrame(() => alignToCameraWall(camera, controls, scene))
  };
  document.getElementById('introBtn').onclick = () => {
    showPanel('panel-intro', camera, controls, scene)
    requestAnimationFrame(() => alignToCameraWall(camera, controls, scene))
  };
  document.getElementById('artwallsBtn').onclick = () => {
    showPanel('panel-artwalls', camera, controls, scene)
    requestAnimationFrame(() => alignToCameraWall(camera, controls, scene))
  };
  document.getElementById('invitationBtn').onclick = () => showPanel('panel-invitation', camera, controls);

  // <- 뒤로가기 버튼(복수 가능): 모든 .backToMainBtn에 이벤트 부여
  document.querySelectorAll('.backToMainBtn').forEach(btn => {
    btn.onclick = () => showPanel('panel-main', camera, controls, scene);
  });

}

// 홈 버튼 클릭 시 Tween으로 카메라 이동(시선은 유지)
document.getElementById("homeButton").addEventListener("click", () => {
  moveCameraToHome(camera, controls)
})

window.addEventListener('DOMContentLoaded', initApp);


// ===== 네비게이션 버튼 토글 =====
const navToggleBtn = document.getElementById("navButtonsToggle");
const navButtons = document.getElementById("navButtons");

// 토글 버튼 클릭 시 실행
navToggleBtn.addEventListener("click", () => {
   // 설정 패널 열려 있으면 토글 무시 (패널이 열려있을 땐 항상 숨김 유지)
    const panel = document.getElementById("settingsPanel");
    if (panel?.classList.contains("open")) return;
    navButtons.classList.toggle("slide-down");
    navToggleBtn.classList.toggle("active");
});

// 설정 패널 열림/닫힘 ↔ NAV 가시성 자동 동기화 (경로 무관)
(function initNavVisibilitySync() {
  const panel = document.getElementById("settingsPanel");
  if (!panel || !navButtons || !navToggleBtn) return;

  const sync = () => {
    const isOpen = panel.classList.contains("open");
    if (isOpen) {
      // 패널 열림: NAV 강제 숨김
      navButtons.classList.add("slide-down");
      navToggleBtn.classList.add("slide-down", "active"); // 아이콘 눈감김 상태
    } else {
      // 패널 닫힘: NAV 강제 복구
      navButtons.classList.remove("slide-down");
      navToggleBtn.classList.remove("slide-down", "active");
    }
  };

  // 초기 동기화 1회
  sync();

  // settingsPanel의 class 변화 감시 (transitionend 의존 X)
  new MutationObserver((muts) => {
    if (muts.some(m => m.attributeName === "class")) sync();
  }).observe(panel, { attributes: true, attributeFilter: ["class"] });
})();


// 현재 navButtons 숨김 여부 확인
function isNavButtonsHidden() {
  return navButtons?.classList.contains("slide-down");
}


// 키보드 대응
document.addEventListener("keydown", handleNavKeyDown)

// ───────── "전시 패널" 작품 공개/비공개 토글 ─────────
const toggle = document.getElementById('visibilityToggle');
const label = document.getElementById('visibilityLabel');

// 기본값: OFF(체크 해제) = 공개
label.textContent = toggle.checked ? "비공개" : "공개";

toggle.addEventListener('change', (e) => {
  label.textContent = e.target.checked ? "비공개" : "공개";
});

// ─────── 패널 내 shortcut 버튼 클릭 → 항상 showPanel 경유 ─────────
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.shortcut-btn[data-role="panel-shortcut"]');
  if (!btn) return;

  e.preventDefault();
  const targetId = btn.getAttribute('data-panel');

  // 패널 전환은 반드시 showPanel로
  showPanel(targetId, camera, controls, scene);

  // 현재 바라보는 벽으로 패널의 벽 선택 동기화
  //   (벽과 연동되는 패널들에만 적용: paintings / intro / artwalls)
  const needsWallSync = ['panel-paintings', 'panel-intro', 'panel-artwalls'];
  if (needsWallSync.includes(targetId)) {
    // 새 슬라이드가 활성화된 다음 프레임에 동기화
    requestAnimationFrame(() => alignToCameraWall(camera, controls, scene));
  }

  // 새로 활성화된 패널의 상단 바로가기 바에서 active 스타일 갱신
  requestAnimationFrame(() => {
    const activeSlide = document.querySelector('.settings-slide.active');
    if (!activeSlide) return;
    activeSlide.querySelectorAll('.shortcut-btn').forEach(b => b.classList.remove('active'));
    const highlight = activeSlide.querySelector(`.shortcut-btn[data-panel="${targetId}"]`);
    highlight?.classList.add('active');
  });
});