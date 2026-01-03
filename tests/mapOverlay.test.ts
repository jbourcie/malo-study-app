import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { anchorToCss, clampAnchorToSafeArea } from '../src/world/map/MapOverlayLayout'
import { getWorldMapConfig } from '../src/world/mapConfig/registry'
import { resolveBiomeAnchor } from '../src/world/map/resolveBiomeAnchor'
import { resolveZoneAnchors } from '../src/world/map/resolveZoneAnchors'
import { computeZoneProgress } from '../src/world/map/zoneProgress'
import { ZoneMonumentChip } from '../src/world/map/ZoneMonumentChip'
import { ZoneTile } from '../src/world/map/ZoneTile'
import { BlockTile } from '../src/world/map/BlockTile'
import { resolveBiomeMap, resolveWorldMap } from '../src/world/map/resolveMap'
import { getTagsForZone } from '../src/world/map/getTagsForZone'

describe('anchorToCss', () => {
  it('converts absolute coords to percentage with centering', () => {
    const css = anchorToCss({ x: 960, y: 540 }, 1920, 1080)
    expect(css.left).toBe('50%')
    expect(css.top).toBe('50%')
    expect(css.transform).toContain('translate(-50%, -50%)')
  })

  it('clamps coordinates with safeArea', () => {
    const css = anchorToCss({ x: 10, y: 20 }, 100, 100, { left: 30, top: 40, right: 10, bottom: 5 })
    expect(css.left).toBe('30%')
    expect(css.top).toBe('40%')
  })

  it('keeps anchors unchanged inside safe area', () => {
    const anchor = clampAnchorToSafeArea({ x: 60, y: 60 }, 100, 100, { left: 10, top: 10, right: 10, bottom: 10 })
    expect(anchor).toEqual({ x: 60, y: 60 })
  })
})

describe('getWorldMapConfig', () => {
  it('returns config for 5e', () => {
    const cfg = getWorldMapConfig('5e')
    expect(cfg?.grade).toBe('5e')
    expect(cfg?.biomes.length).toBeGreaterThan(0)
  })

  it('returns null for unsupported grade', () => {
    expect(getWorldMapConfig('6e')).toBeNull()
  })
})

describe('resolveBiomeAnchor', () => {
  const mapConfig = getWorldMapConfig('5e')!
  const biome = { id: 'biome_fr_foret_langue', subject: 'fr' } as any

  it('prefers pack anchors over map config', () => {
    const anchor = resolveBiomeAnchor(biome, {
      id: 'p', label: 'p', grade: '5e', version: '1', map: { baseLayer: 'a', width: 1, height: 1 }, css: [],
      anchors: { world: { biomes: { fr: { x: 10, y: 20, radius: 5 } } } },
    }, mapConfig)
    expect(anchor).toEqual({ x: 10, y: 20, radius: 5 })
  })

  it('falls back to mapConfig anchor', () => {
    const anchor = resolveBiomeAnchor(biome, undefined, mapConfig)
    expect(anchor).not.toBeNull()
  })

  it('returns null when nothing available', () => {
    const anchor = resolveBiomeAnchor(biome, { id: 'p', label: 'p', grade: '5e', version: '1', map: { baseLayer: 'a', width: 1, height: 1 }, css: [] }, null)
    expect(anchor).toBeNull()
  })
})

describe('resolveZoneAnchors', () => {
  const manifest = {
    id: 'p', label: 'p', grade: '5e', version: '1', map: { baseLayer: 'a', width: 1920, height: 1080 }, css: [],
    anchors: {
      biomes: {
        fr: {
          zones: {
            'Compréhension': { x: 10, y: 20 },
            'Inconnue': { x: 5, y: 5 },
          },
        },
      },
    },
  }

  it('returns only zones known for subject', () => {
    const zones = resolveZoneAnchors('fr', manifest as any)
    expect(zones.find(z => z.themeLabel === 'Compréhension')).toBeTruthy()
    expect(zones.find(z => z.themeLabel === 'Inconnue')).toBeUndefined()
  })
})

describe('computeZoneProgress', () => {
  const zone = { subjectId: 'fr', themeLabel: 'Compréhension', anchor: { x: 0, y: 0 }, zoneKey: 'fr__Compréhension', tagIds: ['fr_comprehension_idee_principale'] } as any

  it('uses rebuild progress when available', () => {
    const res = computeZoneProgress(zone, { blockProgress: {}, zoneRebuildProgress: { 'fr__Compréhension': { correctCount: 120, target: 100 } } } as any)
    expect(res.progressPct).toBe(100)
    expect(res.state).toBe('rebuilt')
  })

  it('sums blockProgress correct when rebuild data missing', () => {
    const res = computeZoneProgress(zone, { blockProgress: { fr_comprehension_idee_principale: { correct: 30 } }, zoneRebuildProgress: {} } as any)
    expect(res.progressPct).toBe(30)
    expect(res.state).toBe('rebuilding')
  })
})

describe('ZoneMonumentChip aria', () => {
  it('renders aria-label with progress', () => {
    const element = ZoneMonumentChip({ label: 'Test', progress0to100: 42, state: 'rebuilding' } as any)
    expect((element as any).props['aria-label']).toContain('42')
  })
})

describe('ZoneTile aria', () => {
  it('renders aria-label with progress', () => {
    const html = renderToStaticMarkup(React.createElement(ZoneTile as any, { label: 'Test', state: 'rebuilding', progressPct: 42 }))
    expect(html).toContain('aria-label="Ouvrir la zone Test, progression 42%"')
  })
})

describe('BlockTile aria', () => {
  it('renders aria-label with tag', () => {
    const element = BlockTile({ tagId: 'tag1', label: 'Bloc', state: 'repairing', masteryPct: 15 } as any)
    expect((element as any).props['aria-label']).toContain('Bloc')
    expect((element as any).props['data-tag-id']).toBe('tag1')
  })
})

describe('resolveMap', () => {
  const manifest = {
    id: 'p', label: 'p', grade: '5e', version: '1',
    map: { baseLayer: 'legacy.svg', width: 100, height: 50 },
    css: [],
    maps: {
      world: { baseLayer: 'world.svg', width: 200, height: 100 },
      biomes: {
        fr: { baseLayer: 'fr.svg', width: 300, height: 150 },
      },
    },
    anchors: {
      world: { biomes: {} },
      biomes: {},
    },
  } as any

  it('resolves world map with maps.world first', () => {
    const res = resolveWorldMap(manifest, '/root')
    expect(res.baseLayerUrl).toBe('/root/world.svg')
    expect(res.width).toBe(200)
  })

  it('resolves biome map or returns null', () => {
    expect(resolveBiomeMap(manifest, '/root', 'fr', 'fr')?.baseLayerUrl).toBe('/root/fr.svg')
    expect(resolveBiomeMap(manifest, '/root', 'math', 'math')).toBeNull()
  })
})

describe('getTagsForZone', () => {
  it('filters tags by subject and theme', () => {
    const tags = getTagsForZone('fr', 'Compréhension')
    expect(tags.length).toBeGreaterThan(0)
    expect(tags.every(t => t.subject === 'fr' && t.theme === 'Compréhension')).toBe(true)
  })
})
