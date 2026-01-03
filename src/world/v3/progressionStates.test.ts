import { describe, expect, it } from 'vitest'
import { BLOCK_THRESHOLDS, computeBiomeVisualState, computeBlockVisualState, computeZoneVisualState, WEATHER_DAYS_DEFAULT } from './progressionStates'

const NOW = new Date('2024-01-15T12:00:00Z')
const DAYS = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000)

describe('computeZoneVisualState', () => {
  it('returns foundation at 0%', () => {
    expect(computeZoneVisualState({ zoneProgressCorrect: 0, zoneLastActivityAt: null, now: NOW })).toBe('foundation')
  })

  it('returns rebuilding when progress started', () => {
    expect(computeZoneVisualState({ zoneProgressCorrect: 10, zoneLastActivityAt: NOW, now: NOW })).toBe('rebuilding')
  })

  it('returns rebuilt when at 100 and recent', () => {
    expect(computeZoneVisualState({ zoneProgressCorrect: 100, zoneLastActivityAt: NOW, now: NOW })).toBe('rebuilt')
  })

  it('returns weathered when 100 and stale', () => {
    expect(computeZoneVisualState({ zoneProgressCorrect: 100, zoneLastActivityAt: DAYS(WEATHER_DAYS_DEFAULT + 1), now: NOW })).toBe('weathered')
  })
})

describe('computeBlockVisualState', () => {
  it('classifies by mastery thresholds', () => {
    expect(computeBlockVisualState({ masteryPct: 10, tagLastActivityAt: NOW, now: NOW })).toBe('cracked')
    expect(computeBlockVisualState({ masteryPct: 55, tagLastActivityAt: NOW, now: NOW })).toBe('repairing')
    expect(computeBlockVisualState({ masteryPct: 75, tagLastActivityAt: NOW, now: NOW })).toBe('repaired')
    expect(computeBlockVisualState({ masteryPct: 90, tagLastActivityAt: NOW, now: NOW })).toBe('enhanced')
  })

  it('returns weathered when stale but mastered', () => {
    expect(computeBlockVisualState({ masteryPct: BLOCK_THRESHOLDS.repairing, tagLastActivityAt: DAYS(WEATHER_DAYS_DEFAULT + 1), now: NOW })).toBe('weathered')
  })
})

describe('computeBiomeVisualState', () => {
  it('classifies by rebuild percentage', () => {
    expect(computeBiomeVisualState({ biomeRebuiltPct: 10, biomeLastActivityAt: NOW, now: NOW })).toBe('low')
    expect(computeBiomeVisualState({ biomeRebuiltPct: 30, biomeLastActivityAt: NOW, now: NOW })).toBe('mid')
    expect(computeBiomeVisualState({ biomeRebuiltPct: 60, biomeLastActivityAt: NOW, now: NOW })).toBe('high')
    expect(computeBiomeVisualState({ biomeRebuiltPct: 85, biomeLastActivityAt: NOW, now: NOW })).toBe('max')
  })

  it('returns weathered when stale', () => {
    expect(computeBiomeVisualState({ biomeRebuiltPct: 40, biomeLastActivityAt: DAYS(WEATHER_DAYS_DEFAULT + 2), now: NOW })).toBe('weathered')
  })
})
