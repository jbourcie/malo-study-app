import type { ZoneVisualState } from './progressionStates'

export type ConstructionStage = 0 | 1 | 2 | 3 | 4

export function computeZoneConstructionStage(progress: number): ConstructionStage {
  const pct = Math.max(0, Math.min(100, Math.round(progress || 0)))
  if (pct >= 100) return 4
  if (pct >= 75) return 3
  if (pct >= 50) return 2
  if (pct >= 25) return 1
  return 0
}

export function shouldShowConstruction(stage: ConstructionStage, zoneState: ZoneVisualState): boolean {
  return zoneState === 'rebuilding' && stage > 0
}
