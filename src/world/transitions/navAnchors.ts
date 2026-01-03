type NavFrom = 'world' | 'biome'

export type AnchorPx = { x: number; y: number }
export type MapSize = { w: number; h: number }

export type NavAnchorIntent = {
  from: NavFrom
  anchorPx?: AnchorPx
  mapSize?: MapSize
}

const NAV_FROM_KEY = 'mc_nav_from'
const NAV_ANCHOR_KEY = 'mc_nav_anchor'
const NAV_MAPSIZE_KEY = 'mc_nav_mapSize'
const NAV_TS_KEY = 'mc_nav_ts'
const MAX_NAV_AGE_MS = 5000
const FALLBACK_MAP_SIZE: MapSize = { w: 1920, h: 1080 }

function getSessionStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.sessionStorage
  } catch {
    return null
  }
}

export function setNavAnchor(from: NavFrom, anchorPx?: AnchorPx | null, mapSize?: MapSize | null) {
  const storage = getSessionStorage()
  if (!storage) return
  try {
    storage.setItem(NAV_FROM_KEY, from)
    if (anchorPx) {
      storage.setItem(NAV_ANCHOR_KEY, JSON.stringify({ x: anchorPx.x, y: anchorPx.y }))
      if (mapSize?.w && mapSize?.h) {
        storage.setItem(NAV_MAPSIZE_KEY, JSON.stringify({ w: mapSize.w, h: mapSize.h }))
      } else {
        storage.removeItem(NAV_MAPSIZE_KEY)
      }
      storage.setItem(NAV_TS_KEY, Date.now().toString())
    } else {
      storage.removeItem(NAV_ANCHOR_KEY)
      storage.removeItem(NAV_MAPSIZE_KEY)
      storage.removeItem(NAV_TS_KEY)
    }
  } catch {
    // Ignore storage failures silently to avoid blocking navigation.
  }
}

export function consumeNavAnchor(): NavAnchorIntent | null {
  const storage = getSessionStorage()
  if (!storage) return null
  try {
    const from = storage.getItem(NAV_FROM_KEY) as NavFrom | null
    const rawTs = storage.getItem(NAV_TS_KEY)
    const rawAnchor = storage.getItem(NAV_ANCHOR_KEY)
    const rawMapSize = storage.getItem(NAV_MAPSIZE_KEY)
    storage.removeItem(NAV_FROM_KEY)
    storage.removeItem(NAV_ANCHOR_KEY)
    storage.removeItem(NAV_MAPSIZE_KEY)
    storage.removeItem(NAV_TS_KEY)
    if (!from) return null
    const ts = rawTs ? parseInt(rawTs, 10) : null
    if (ts && Date.now() - ts > MAX_NAV_AGE_MS) return null
    const anchor = rawAnchor ? safeParse(rawAnchor) : null
    const mapSize = rawMapSize ? safeParse(rawMapSize) : null
    if (!anchor || typeof anchor.x !== 'number' || typeof anchor.y !== 'number') {
      return { from, anchorPx: undefined, mapSize: undefined }
    }
    const parsedMap = mapSize && typeof mapSize.w === 'number' && typeof mapSize.h === 'number'
      ? { w: mapSize.w, h: mapSize.h }
      : FALLBACK_MAP_SIZE
    return { from, anchorPx: { x: anchor.x, y: anchor.y }, mapSize: parsedMap }
  } catch {
    return null
  }
}

function safeParse<T = any>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function computeCameraPan({
  anchorPx,
  mapSize,
  viewport,
  panFactor,
  maxPan,
}: {
  anchorPx: { x: number; y: number } | null
  mapSize: { w: number; h: number } | null
  viewport: { w: number; h: number } | null
  panFactor: number
  maxPan: number
}): { x: number; y: number } {
  if (!anchorPx || !mapSize) return { x: 0, y: 0 }
  const width = typeof mapSize.w === 'number' ? mapSize.w || FALLBACK_MAP_SIZE.w : FALLBACK_MAP_SIZE.w
  const height = typeof mapSize.h === 'number' ? mapSize.h || FALLBACK_MAP_SIZE.h : FALLBACK_MAP_SIZE.h
  const center = { x: width / 2, y: height / 2 }
  const dx = anchorPx.x - center.x
  const dy = anchorPx.y - center.y
  const panX = -dx * panFactor
  const panY = -dy * panFactor
  const viewportLimit = viewport && viewport.w && viewport.w < 860 ? 50 : 80
  const limit = Math.min(Math.abs(maxPan), viewportLimit)
  return {
    x: clamp(panX, -limit, limit),
    y: clamp(panY, -limit, limit),
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
