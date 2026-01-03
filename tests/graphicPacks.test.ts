import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { loadGraphicPack } from '../src/world/graphicPacks/loadGraphicPack'
import { injectCssUrls } from '../src/world/graphicPacks/injectCss'

class MockLinkElement {
  rel = ''
  href = ''
  dataset: Record<string, string> = {}
  parent: MockHeadElement | null = null

  setAttribute(name: string, value: string) {
    if (name === 'rel') this.rel = value
    if (name === 'href') this.href = value
  }

  remove() {
    this.parent?.removeChild(this)
  }
}

class MockHeadElement {
  children: MockLinkElement[] = []

  appendChild(el: MockLinkElement) {
    el.parent = this
    this.children.push(el)
    return el
  }

  removeChild(el: MockLinkElement) {
    this.children = this.children.filter(c => c !== el)
  }

  querySelector(selector: string) {
    return this.querySelectorAll(selector)[0] || null
  }

  querySelectorAll(selector: string) {
    return this.children.filter((child) => matchesSelector(child, selector))
  }
}

class MockDocument {
  head = new MockHeadElement()

  createElement(name: string) {
    if (name.toLowerCase() !== 'link') throw new Error('Unsupported element in mock document')
    return new MockLinkElement()
  }

  querySelector(selector: string) {
    if (selector === 'head') return this.head as any
    return this.head.querySelector(selector) as any
  }

  querySelectorAll(selector: string) {
    if (selector === 'head') return [this.head as any]
    return this.head.querySelectorAll(selector) as any
  }
}

function matchesSelector(link: MockLinkElement, selector: string) {
  if (!selector.startsWith('link')) return false
  const hrefMatch = selector.match(/href="([^"]+)"/)
  if (hrefMatch && link.href !== hrefMatch[1]) return false
  const packMatch = selector.match(/data-mc-pack="([^"]+)"/)
  if (packMatch && link.dataset.mcPack !== packMatch[1]) return false
  return true
}

describe('loadGraphicPack', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('builds baseLayerUrl and cssUrls relative to manifest', async () => {
    const manifest = {
      id: 'pack-1',
      label: 'Pack test',
      grade: '5e',
      version: '1.0.0',
      map: { baseLayer: 'base/map.svg', width: 1920, height: 1080 },
      css: ['theme.css', 'effects/glow.css'],
    }
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => manifest,
    })))

    const pack = await loadGraphicPack('/assets/graphic-packs/pack-1/pack.json')

    expect(pack.packRootUrl).toBe('/assets/graphic-packs/pack-1')
    expect(pack.baseLayerUrl).toBe('/assets/graphic-packs/pack-1/base/map.svg')
    expect(pack.cssUrls).toEqual([
      '/assets/graphic-packs/pack-1/theme.css',
      '/assets/graphic-packs/pack-1/effects/glow.css',
    ])
    expect(pack.manifest.id).toBe('pack-1')
  })

  it('throws when required fields are missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: 'pack-bad',
        label: 'Bad pack',
        grade: '5e',
        version: '0.0.0',
        map: { baseLayer: '', width: 0, height: 0 },
        css: [],
      }),
    })))

    await expect(loadGraphicPack('/packs/pack-bad/pack.json')).rejects.toThrow()
  })
})

describe('injectCssUrls', () => {
  let doc: MockDocument

  beforeEach(() => {
    doc = new MockDocument()
    ;(globalThis as any).document = doc as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('adds link tags with data-mc-pack and deduplicates per href', () => {
    const cleanup = injectCssUrls(['https://cdn.example.com/theme.css', '/local/effects.css'], 'pack-a')
    const links = document.querySelectorAll('link[data-mc-pack="pack-a"]')
    expect(links.length).toBe(2)

    injectCssUrls(['https://cdn.example.com/theme.css'], 'pack-a')
    const deduped = document.querySelectorAll('link[data-mc-pack="pack-a"]')
    expect(deduped.length).toBe(2)

    cleanup()
    expect(document.querySelectorAll('link[data-mc-pack="pack-a"]').length).toBe(0)
  })

  it('cleanup only removes links for the given pack key', () => {
    const globalLink = document.createElement('link')
    globalLink.rel = 'stylesheet'
    globalLink.href = '/styles/global.css'
    document.head.appendChild(globalLink)

    const cleanup = injectCssUrls(['/packs/a.css'], 'pack-b')
    expect(document.querySelectorAll('link').length).toBe(2)

    cleanup()

    expect(document.querySelector('link[href="/styles/global.css"]')).not.toBeNull()
    expect(document.querySelector('link[data-mc-pack="pack-b"]')).toBeNull()
  })
})
