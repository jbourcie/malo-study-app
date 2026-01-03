import React from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { pickPoiTags } from '../src/world/v3/pickPoiTags'
import { assetExists, clearAssetExistenceCache } from '../src/world/v3/assetExistsCache'
import { ZoneMonument } from '../src/world/v3/ZoneMonument'
import { BlockPOI } from '../src/world/v3/BlockPOI'
import type { TagMeta } from '../src/taxonomy/tagCatalog'

describe('pickPoiTags', () => {
  const tags: TagMeta[] = [
    { id: 'low-a', label: 'Low A', subject: 'fr', theme: 'Test', order: 30 },
    { id: 'low-b', label: 'Low B', subject: 'fr', theme: 'Test', order: 20 },
    { id: 'mid-a', label: 'Mid A', subject: 'fr', theme: 'Test', order: 5 },
    { id: 'mid-b', label: 'Mid B', subject: 'fr', theme: 'Test', order: 15 },
    { id: 'recent-high', label: 'Recent High', subject: 'fr', theme: 'Test', order: 50 },
    { id: 'high-a', label: 'High A', subject: 'fr', theme: 'Test', order: 60 },
    { id: 'high-b', label: 'High B', subject: 'fr', theme: 'Test', order: 70 },
    { id: 'extra-1', label: 'Extra 1', subject: 'fr', theme: 'Test', order: 80 },
    { id: 'extra-2', label: 'Extra 2', subject: 'fr', theme: 'Test', order: 90 },
    { id: 'extra-3', label: 'Extra 3', subject: 'fr', theme: 'Test', order: 100 },
    { id: 'extra-4', label: 'Extra 4', subject: 'fr', theme: 'Test', order: 110 },
    { id: 'extra-5', label: 'Extra 5', subject: 'fr', theme: 'Test', order: 120 },
  ]

  it('prioritizes weak and in-progress tags and caps at 10', () => {
    const masteryByTag = {
      'low-a': { score: 10, state: 'discovering' as const },
      'low-b': { score: 40, state: 'discovering' as const },
      'mid-a': { score: 60, state: 'progressing' as const },
      'mid-b': { score: 70, state: 'progressing' as const },
      'recent-high': { score: 90, state: 'mastered' as const },
      'high-a': { score: 90, state: 'mastered' as const },
      'high-b': { score: 95, state: 'mastered' as const },
      'extra-1': { score: 82, state: 'mastered' as const },
      'extra-2': { score: 81, state: 'mastered' as const },
      'extra-3': { score: 80, state: 'mastered' as const },
      'extra-4': { score: 79, state: 'progressing' as const },
      'extra-5': { score: 78, state: 'progressing' as const },
    }
    const picked = pickPoiTags({ tags, masteryByTag, recentlyPlayed: ['recent-high'], limit: 10 })
    expect(picked.length).toBe(10)
    const ids = picked.map(t => t.id)
    expect(ids.slice(0, 2)).toEqual(['low-b', 'low-a'])
    expect(ids[2]).toBe('mid-a')
    expect(ids[3]).toBe('mid-b')
    expect(ids).toContain('recent-high')
  })
})

describe('assetExistsCache', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    clearAssetExistenceCache()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('memoizes successful lookups', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    global.fetch = mockFetch as any
    const first = await assetExists('/assets/monument.svg')
    const second = await assetExists('/assets/monument.svg')
    expect(first).toBe(true)
    expect(second).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

describe('component aria', () => {
  it('renders BlockPOI with aria-label and data-tag-id', () => {
    const html = renderToStaticMarkup(
      <BlockPOI
        tagId="tag-1"
        label="Bloc test"
        state="repairing"
        masteryPct={12}
        packBaseUrl="/assets/graphic-packs/pack-5e-mvp"
        onStart={() => {}}
      />,
    )
    expect(html).toContain('aria-label="Lancer le bloc Bloc test, maîtrise 12%"')
    expect(html).toContain('data-tag-id="tag-1"')
  })

  it('renders ZoneMonument with aria-label', () => {
    const html = renderToStaticMarkup(
      <ZoneMonument
        subjectId="fr"
        zoneSlug="comprehension"
        label="Compréhension"
        state="foundation"
        progressPct={42}
        packBaseUrl="/assets/graphic-packs/pack-5e-mvp"
      />,
    )
    expect(html).toContain('aria-label="Ouvrir la zone Compréhension, progression 42%"')
  })
})
