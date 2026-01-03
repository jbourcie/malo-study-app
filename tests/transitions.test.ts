import { afterEach, describe, expect, it } from 'vitest'
import { buildPageTransitionConfig } from '../src/components/PageTransition'
import { computeCameraPan, consumeNavAnchor, setNavAnchor } from '../src/world/transitions/navAnchors'

function createStorage(initial: Record<string, string> = {}): Storage {
  let data = { ...initial }
  return {
    get length() {
      return Object.keys(data).length
    },
    clear() {
      data = {}
    },
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null
    },
    key(index: number) {
      return Object.keys(data)[index] || null
    },
    removeItem(key: string) {
      delete data[key]
    },
    setItem(key: string, value: string) {
      data[key] = value
    },
  }
}

describe('computeCameraPan', () => {
  it('returns zero when data is missing', () => {
    const pan = computeCameraPan({ anchorPx: null, mapSize: null, viewport: null, panFactor: 0.12, maxPan: 80 })
    expect(pan).toEqual({ x: 0, y: 0 })
  })

  it('clamps pan based on viewport', () => {
    const pan = computeCameraPan({
      anchorPx: { x: 100, y: 50 },
      mapSize: { w: 2000, h: 1000 },
      viewport: { w: 700, h: 1200 },
      panFactor: 0.12,
      maxPan: 120,
    })
    expect(pan.x).toBe(50)
    expect(pan.y).toBe(50)
  })
})

describe('PageTransition config', () => {
  it('neutralizes animation when reduced motion is preferred', () => {
    const { variants, transition } = buildPageTransitionConfig(true, { anchorPx: { x: 12, y: -8 }, mapSize: { w: 1000, h: 1000 } }, { w: 1200, h: 800 })
    expect(transition.duration).toBe(0)
    expect(variants.initial.scale).toBe(1)
    expect(variants.exit.scale).toBe(1)
    expect(variants.initial.opacity).toBe(1)
    expect(variants.exit.opacity).toBe(1)
    expect(variants.initial.filter).toBe('none')
    expect(variants.initial.x).toBe(0)
    expect(variants.initial.y).toBe(0)
  })
})

describe('navigation anchors', () => {
  const originalWindow = (global as any).window

  afterEach(() => {
    ;(global as any).window = originalWindow
  })

  it('expires stale anchors', () => {
    const now = Date.now()
    const storage = createStorage({
      mc_nav_from: 'biome',
      mc_nav_anchor: JSON.stringify({ x: 100, y: 200 }),
      mc_nav_mapSize: JSON.stringify({ w: 1900, h: 1000 }),
      mc_nav_ts: (now - 6000).toString(),
    })
    ;(global as any).window = { sessionStorage: storage }
    const intent = consumeNavAnchor()
    expect(intent).toBeNull()
  })

  it('returns anchor and map size when present', () => {
    const storage = createStorage()
    ;(global as any).window = { sessionStorage: storage }
    setNavAnchor('biome', { x: 10, y: 20 }, { w: 1000, h: 800 })
    const intent = consumeNavAnchor()
    expect(intent?.from).toBe('biome')
    expect(intent?.anchorPx).toEqual({ x: 10, y: 20 })
    expect(intent?.mapSize).toEqual({ w: 1000, h: 800 })
  })
})
