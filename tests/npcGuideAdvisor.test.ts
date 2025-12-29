import { describe, expect, it } from 'vitest'
import type { BiomeVisualState, ZoneVisualState } from '../src/game/visualProgress'
import { adviseNpcAction, buildEligibleOptions, computeWeights, weightedPick, type LastAdvice } from '../src/game/npc/npcGuideAdvisor'

const baseZoneVisual: ZoneVisualState = {
  state: 'building',
  breakdown: { total: 1, locked: 0, cracked: 0, repaired: 1, beautified: 0, stable: 1, lockedPct: 0, crackedPct: 0, stablePct: 100 },
  weatheredPct: 0,
}

const baseBiomeVisual: BiomeVisualState = {
  state: 'recovering',
  breakdown: { totalTags: 1, locked: 0, cracked: 0, repaired: 1, beautified: 0, stable: 1, lockedPct: 0, crackedPct: 0, stablePct: 100 },
  zones: [],
  rebuild: { status: 'not_ready', correctCount: 0, target: 100, rebuiltZones: 0, totalZones: 1 },
}

function makeInput(overrides: Partial<Parameters<typeof buildEligibleOptions>[0]> = {}) {
  return {
    biomeId: 'biome_fr_foret_langue',
    subjectId: 'fr' as const,
    zones: [],
    biomeVisual: baseBiomeVisual,
    masteryByTag: {},
    blockProgress: {},
    seed: 'seed',
    ...overrides,
  }
}

describe('npcGuideAdvisor', () => {
  it('excludes non-authorized tags', () => {
    const zones = [{
      theme: 'Grammaire',
      tagIds: ['fr_tag_a', 'fr_tag_b'],
      visual: baseZoneVisual,
      blocks: [],
    }]
    const input = makeInput({
      zones,
      masteryByTag: { fr_tag_a: { score: 20 } as any, fr_tag_b: { score: 20 } as any },
      allowedTags: new Set(['fr_tag_a']),
    })
    const options = buildEligibleOptions(input)
    const tagOptions = options.filter(o => o.adviceId.startsWith('remediate_') || o.adviceId.startsWith('progress_'))
    expect(tagOptions.every(o => o.adviceId.includes('fr_tag_a'))).toBe(true)
  })

  it('picks the only eligible option consistently', () => {
    const input = makeInput()
    const decision = adviseNpcAction(input)
    expect(decision.adviceId.startsWith('explore_')).toBe(true)
  })

  it('renormalizes weights over eligible options', () => {
    const zones = [{
      theme: 'Zone A',
      tagIds: ['fr_tag_a'],
      visual: { ...baseZoneVisual, state: 'rebuilt_ready', rebuild: { correctCount: 30, target: 35, rebuilt: false } },
      blocks: [],
    }]
    const input = makeInput({ zones })
    const options = buildEligibleOptions(input)
    const weights = computeWeights(options, input.biomeVisual)
    const total = Array.from(weights.values()).reduce((acc, v) => acc + v, 0)
    expect(Math.round(total * 1000)).toBe(1000)
  })

  it('keeps the same choice for the same seed', () => {
    const zones = [{
      theme: 'Zone A',
      tagIds: ['fr_tag_a'],
      visual: { ...baseZoneVisual, state: 'rebuilt_ready', rebuild: { correctCount: 30, target: 35, rebuilt: false } },
      blocks: [],
    }]
    const input = makeInput({ zones, seed: 'same-seed' })
    const options = buildEligibleOptions(input)
    const weights = computeWeights(options, input.biomeVisual)
    const rngFactory = () => {
      let first = true
      return () => {
        if (first) { first = false; return 0.1 }
        return 0.1
      }
    }
    const pick1 = weightedPick(options, weights, rngFactory(), null)
    const pick2 = weightedPick(options, weights, rngFactory(), null)
    expect(pick1.adviceId).toBe(pick2.adviceId)
  })

  it('applies anti-repeat penalty when possible', () => {
    const fallbackOption = { adviceId: 'explore_fr', actionType: 'explore', messageCode: 'fallback', messageVariants: ['x'] }
    const rebuildOption = { adviceId: 'zone_rebuild_fr__A', actionType: 'reconstruction_theme', messageCode: 'zone_rebuild', messageVariants: ['y'] }
    const options = [rebuildOption, fallbackOption] as any
    const weights = new Map<string, number>([
      [rebuildOption.adviceId, 0.5],
      [fallbackOption.adviceId, 0.5],
    ])
    const last: LastAdvice = { adviceId: rebuildOption.adviceId, actionType: 'reconstruction_theme', messageKey: 'zone_rebuild:0' }
    const rngValues = [0.0, 0.9]
    let idx = 0
    const rng = () => rngValues[Math.min(idx++, rngValues.length - 1)]
    const picked = weightedPick(options as any, weights, rng, last)
    expect(picked.adviceId).toBe(fallbackOption.adviceId)
  })
})
