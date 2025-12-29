import { describe, it, expect } from 'vitest'
import { getBlockVisualState, getZoneVisualState, getBiomeVisualState } from '../src/game/visualProgress'

describe('visualProgress - block', () => {
  it('computes states and weathering', () => {
    const fresh = getBlockVisualState({ attempts: 5, correct: 4, successRate: 80, score: 85, updatedAt: new Date() })
    expect(fresh.state).toBe('beautified')
    expect(fresh.weathered).toBe(false)

    const cracked = getBlockVisualState({ attempts: 3, correct: 1, updatedAt: new Date(Date.now() - 15 * 24 * 3600 * 1000) })
    expect(cracked.state).toBe('cracked')
    expect(cracked.weathered).toBe(true)

    const locked = getBlockVisualState({ attempts: 0 })
    expect(locked.state).toBe('locked')
  })
})

describe('visualProgress - zone', () => {
  it('aggregates to ruins / rebuilt_ready / rebuilding', () => {
    const tagIds = ['fr_tag_a', 'fr_tag_b', 'fr_tag_c', 'fr_tag_d']
    const blockProgress = {
      fr_tag_a: { attempts: 0 },
      fr_tag_b: { attempts: 2, correct: 0, successRate: 0, score: 10 },
      fr_tag_c: { attempts: 4, correct: 3, successRate: 75, score: 82 },
      fr_tag_d: { attempts: 5, correct: 1, successRate: 20, score: 10 },
    }
    const masteryByTag = {
      fr_tag_c: { state: 'progressing', score: 82 },
    }
    const ruins = getZoneVisualState('fr', 'Compréhension', tagIds, { blockProgress, masteryByTag })
    expect(ruins.state).toBe('ruins')

    const rebuiltReady = getZoneVisualState('fr', 'Compréhension', ['fr_tag_c'], { blockProgress, masteryByTag })
    expect(rebuiltReady.state).toBe('rebuilt_ready')

    const rebuilding = getZoneVisualState(
      'fr',
      'Compréhension',
      tagIds,
      { blockProgress, masteryByTag },
      { correctCount: 12, target: 35 }
    )
    expect(rebuilding.state).toBe('rebuilding')
  })
})

describe('visualProgress - biome', () => {
  it('computes biome rebuild readiness and status', () => {
    const zones = [
      { theme: 'Compréhension', tagIds: ['fr_a', 'fr_b'] },
      { theme: 'Lexique', tagIds: ['fr_c', 'fr_d'] },
      { theme: 'Grammaire', tagIds: ['fr_e', 'fr_f'] },
      { theme: 'Orthographe', tagIds: ['fr_g', 'fr_h'] },
      { theme: 'Expression', tagIds: ['fr_i', 'fr_j'] },
    ]
    const blockProgress: any = {}
    zones.forEach(z => z.tagIds.forEach(t => { blockProgress[t] = { attempts: 3, correct: 2, successRate: 66, score: 70 } }))
    const masteryByTag = {}
    const zoneRebuildProgress = {
      'fr__Compréhension': { correctCount: 35, target: 35 },
      'fr__Lexique': { correctCount: 35, target: 35 },
      'fr__Grammaire': { correctCount: 35, target: 35 },
    }
    const readyBiome = getBiomeVisualState(
      'fr',
      zones,
      { blockProgress, masteryByTag },
      { zoneRebuildProgress }
    )
    expect(readyBiome.rebuild?.status).toBe('ready')

    const rebuildingBiome = getBiomeVisualState(
      'fr',
      zones,
      { blockProgress, masteryByTag },
      { zoneRebuildProgress, biomeRebuild: { correctCount: 20, target: 100 } }
    )
    expect(rebuildingBiome.rebuild?.status).toBe('rebuilding')

    const rebuilt = getBiomeVisualState(
      'fr',
      zones,
      { blockProgress, masteryByTag },
      { zoneRebuildProgress, biomeRebuild: { correctCount: 100, target: 100 } }
    )
    expect(rebuilt.rebuild?.status).toBe('rebuilt')
  })
})
