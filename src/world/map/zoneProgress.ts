import type { ZoneOverlayDef } from './resolveZoneAnchors'
import type { UserRewards } from '../../rewards/rewards'

type ZoneProgressResult = {
  progressPct: number
  correctCount: number
  target: number
  state: 'intact' | 'rebuilding' | 'rebuilt' | 'degraded'
}

const WEATHERED_MS = 14 * 24 * 60 * 60 * 1000

export function computeZoneProgress(zone: ZoneOverlayDef, rewards: Pick<UserRewards, 'blockProgress' | 'zoneRebuildProgress'>): ZoneProgressResult {
  const zoneEntry = rewards.zoneRebuildProgress?.[zone.zoneKey]
  const target = zoneEntry?.target || 100
  const correct = zoneEntry?.correctCount ?? sumCorrect(zone.tagIds, rewards.blockProgress || {})
  const progressPct = clamp(Math.round((correct / target) * 100), 0, 100)

  const weathered = isZoneWeathered(zone.tagIds, rewards.blockProgress || {})

  let state: ZoneProgressResult['state'] = 'intact'
  if (weathered) {
    state = 'degraded'
  } else if (progressPct >= 100) {
    state = 'rebuilt'
  } else if (progressPct > 0) {
    state = 'rebuilding'
  }

  return { progressPct, correctCount: correct, target, state }
}

function sumCorrect(tagIds: string[], blockProgress: NonNullable<UserRewards['blockProgress']>): number {
  return tagIds.reduce((sum, tagId) => {
    const entry = blockProgress[tagId]
    if (!entry || typeof entry.correct !== 'number') return sum
    return sum + Math.max(0, entry.correct)
  }, 0)
}

function isZoneWeathered(tagIds: string[], blockProgress: NonNullable<UserRewards['blockProgress']>): boolean {
  let latest = 0
  tagIds.forEach((tagId) => {
    const entry = blockProgress[tagId]
    const ts = toMillis(entry?.updatedAt)
    if (ts && ts > latest) latest = ts
  })
  if (!latest) return false
  return Date.now() - latest > WEATHERED_MS
}

function toMillis(value: any): number | null {
  if (!value) return null
  if (typeof value === 'number') return value
  if (typeof value === 'object') {
    if (typeof value.toMillis === 'function') return value.toMillis()
    if (typeof value.toDate === 'function') return value.toDate().getTime()
    if (typeof value.seconds === 'number') return value.seconds * 1000 + (value.nanoseconds ? value.nanoseconds / 1e6 : 0)
  }
  return null
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
