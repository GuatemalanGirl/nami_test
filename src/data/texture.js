// data/texture.js

let textureSetsData = [] // [{ set, thumb, floor, ceiling, walls }]
let currentTexturePage = 0
const texturesPerPage = 9 // 페이지당 9개 (3×3)

// ─────────────────────────────────────────────────────────────
// [개선] 외부/내부 경로 교체를 위한 베이스 URL 분리
// 필요 시 동일 오리진/CDN으로 교체: setTextureBase('<your-origin>/textures/')
let _texturesBase = "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/"

/** [개선] 텍스처 베이스 경로 설정 */
export function setTextureBase(url) {
  if (!url) return
  _texturesBase = url.endsWith("/") ? url : url + "/"
}

// [개선] 유틸: 절대 URL 판단
function isAbsUrl(u) {
  return /^https?:\/\//i.test(u) || u?.startsWith("data:") || u?.startsWith("//")
}

// [개선] 유틸: 베이스 + 파일명(상대경로) → 절대 URL(인코딩/슬래시 정리)
function buildUrl(relOrAbs) {
  if (!relOrAbs) return relOrAbs
  if (isAbsUrl(relOrAbs)) return relOrAbs
  // 파일명/상대경로 내 공백/한글 대응
  return _texturesBase + encodeURIComponent(relOrAbs)
}

// [개선] 메타 아이템 정규화: thumb/floor/ceiling/walls를 절대 URL로 변환
function normalizeTextureItem(item) {
  const v = Date.now() // 캐시 버스트(특히 썸네일)
  const out = { ...item }

  if (item.thumb) out.thumb = buildUrl(item.thumb) + `?v=${v}`

  if (item.floor) out.floor = buildUrl(item.floor)
  if (item.ceiling) out.ceiling = buildUrl(item.ceiling)

  if (item.walls) {
    if (Array.isArray(item.walls)) {
      out.walls = item.walls.map(w => (typeof w === "string" ? buildUrl(w) : w))
    } else if (typeof item.walls === "object") {
      out.walls = {}
      for (const k of Object.keys(item.walls)) {
        const v = item.walls[k]
        out.walls[k] = typeof v === "string" ? buildUrl(v) : v
      }
    }
  }
  return out
}

// metadata_textures.json에서 texture set 정보를 불러옴
export async function fetchTextureSets() {
  // [개선] 캐시/에러/CORS 명시 + 베이스 URL 사용
  const url = _texturesBase + "metadata_textures.json?v=" + Date.now()

  let res
  try {
    res = await fetch(url, { cache: "no-store", mode: "cors" })
  } catch (e) {
    throw new Error(`texture metadata request failed (network/CORS): ${e?.message || e}`)
  }

  if (!res.ok) {
    throw new Error(`texture metadata HTTP ${res.status} ${res.statusText}`)
  }

  let json
  try {
    json = await res.json()
  } catch (e) {
    throw new Error(`texture metadata parse failed: ${e?.message || e}`)
  }

  if (!Array.isArray(json)) {
    throw new Error("texture metadata is not an array")
  }

  // [개선] 불러온 항목들을 절대 URL로 정규화
  textureSetsData = json.map(normalizeTextureItem)
  return textureSetsData
}

export function getTextureSets() {
  return textureSetsData
}

export function getTextureSetByName(name) {
  return textureSetsData.find((t) => t.set === name)
}

// 현재 페이지 반환
export function getTexturePage() {
  return currentTexturePage
}

// 페이지 설정
export function setTexturePage(page) {
  currentTexturePage = page
}

// 현재 페이지의 텍스처셋 반환
export function getTextureSetsByPage(page = currentTexturePage) {
  const start = page * texturesPerPage
  return textureSetsData.slice(start, start + texturesPerPage)
}

// 전체 페이지 수 반환
export function getTotalTexturePages() {
  return Math.ceil(textureSetsData.length / texturesPerPage)
}

// ─────────────────────────────────────────────────────────────
// [개선] 필요 시 개별 파일 경로를 절대 URL로 만들 때 사용 가능
export function getTextureAssetUrl(relOrAbs) {
  return buildUrl(relOrAbs)
}
