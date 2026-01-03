import { describe, expect, it } from 'vitest'
import { computeZoneConstructionStage, shouldShowConstruction } from './constructionStages'

describe('computeZoneConstructionStage', () => {
  it('maps progress to expected stages', () => {
    expect(computeZoneConstructionStage(0)).toBe(0)
    expect(computeZoneConstructionStage(10)).toBe(0)
    expect(computeZoneConstructionStage(25)).toBe(1)
    expect(computeZoneConstructionStage(49)).toBe(1)
    expect(computeZoneConstructionStage(50)).toBe(2)
    expect(computeZoneConstructionStage(74)).toBe(2)
    expect(computeZoneConstructionStage(75)).toBe(3)
    expect(computeZoneConstructionStage(99)).toBe(3)
    expect(computeZoneConstructionStage(100)).toBe(4)
    expect(computeZoneConstructionStage(140)).toBe(4)
    expect(computeZoneConstructionStage(-20)).toBe(0)
  })
})

describe('shouldShowConstruction', () => {
  it('shows only when rebuilding and stage>0', () => {
    expect(shouldShowConstruction(0, 'rebuilding')).toBe(false)
    expect(shouldShowConstruction(1, 'rebuilding')).toBe(true)
    expect(shouldShowConstruction(3, 'rebuilding')).toBe(true)
    expect(shouldShowConstruction(2, 'foundation')).toBe(false)
    expect(shouldShowConstruction(2, 'rebuilt')).toBe(false)
    expect(shouldShowConstruction(2, 'weathered')).toBe(false)
  })
})
