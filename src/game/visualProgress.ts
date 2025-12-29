import type { Timestamp } from 'firebase/firestore'
import type { SubjectId } from '../taxonomy/tagCatalog'
import type { UserRewards } from '../rewards/rewards'

export type BlockVisualStateName = 'locked' | 'beautified' | 'cracked' | 'repaired'
export type ZoneVisualStateName = 'ruins' | 'building' | 'rebuilt_ready' | 'rebuilding' | 'rebuilt'
export type BiomeVisualStateName = 'wasteland' | 'recovering' | 'thriving' | 'neglected'
export type BiomeRebuildState = 'not_ready' | 'ready' | 'rebuilding' | 'rebuilt'

export type BlockVisualState = {
  state: BlockVisualStateName
  weathered: boolean
  attempts: number
  successRate: number
  masteryScore: number
}

export type ZoneVisualState = {
  state: ZoneVisualStateName
  breakdown: {
    total: number
    locked: number
    cracked: number
    repaired: number
    beautified: number
    stable: number
    lockedPct: number
    crackedPct: number
    stablePct: number
  }
  weatheredPct: number
  rebuild?: {
    correctCount: number
    target: number
    rebuilt: boolean
  }
}

export type BiomeVisualState = {
  state: BiomeVisualStateName
  breakdown: {
    totalTags: number
    locked: number
    cracked: number
    repaired: number
    beautified: number
    stable: number
    lockedPct: number
    crackedPct: number
    stablePct: number
  }
  zones: Array<{ theme: string, visual: ZoneVisualState }>
  rebuild?: {
    status: BiomeRebuildState
    correctCount: number
    target: number
    rebuiltZones: number
    totalZones: number
  }
}

type ProgressEntry = UserRewards['blockProgress'] extends Record<string, infer T> ? T : never
type RewardsMeta = Pick<UserRewards, 'blockProgress' | 'masteryByTag'>
type ZoneProgressEntry = { correctCount?: number, target?: number }

function clamp100(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

function asDate(ts?: Timestamp | Date | null): Date | null {
  if (!ts) return null
  if (ts instanceof Date) return ts
  if (typeof (ts as Timestamp).toDate === 'function') return (ts as Timestamp).toDate()
  return null
}

function daysSince(date: Date | null): number {
  if (!date) return 0
  const diff = Date.now() - date.getTime()
  return diff > 0 ? Math.floor(diff / (1000 * 60 * 60 * 24)) : 0
}

function ratio(value: number, total: number): number {
  if (!total) return 0
  return clamp100((value / total) * 100)
}

export function getBlockVisualState(entry?: Partial<ProgressEntry>): BlockVisualState {
  const attempts = entry?.attempts ?? 0
  const correct = entry?.correct ?? 0
  const storedSuccess = typeof entry?.successRate === 'number' ? entry.successRate : null
  const successRate = clamp100(
    storedSuccess !== null ? storedSuccess : (attempts > 0 ? (correct / attempts) * 100 : 0)
  )
  const masteryScore = clamp100(
    typeof (entry as any)?.masteryScore === 'number'
      ? (entry as any).masteryScore
      : typeof entry?.score === 'number'
        ? entry.score
        : 0
  )

  let state: BlockVisualStateName
  if (attempts === 0) {
    state = 'locked'
  } else if (masteryScore >= 80) {
    state = 'beautified'
  } else if (successRate < 40) {
    state = 'cracked'
  } else {
    state = 'repaired'
  }

  const weathered = daysSince(asDate(entry?.updatedAt) || null) > 14

  return { state, weathered, attempts, successRate, masteryScore }
}

export function getZoneVisualState(
  subject: SubjectId,
  theme: string,
  tagIds: string[],
  rewards: RewardsMeta,
  rebuild?: ZoneProgressEntry | null
): ZoneVisualState {
  const breakdown = { total: tagIds.length, locked: 0, cracked: 0, repaired: 0, beautified: 0, stable: 0 }
  let weatheredCount = 0

  tagIds.forEach((tagId) => {
    const entry = rewards.blockProgress?.[tagId]
    const masteryScore = rewards.masteryByTag?.[tagId]?.score
    const visual = getBlockVisualState({ ...(entry || {}), score: entry?.score ?? masteryScore ?? 0 })
    if (visual.state === 'locked') breakdown.locked += 1
    if (visual.state === 'cracked') breakdown.cracked += 1
    if (visual.state === 'repaired') breakdown.repaired += 1
    if (visual.state === 'beautified') breakdown.beautified += 1
    if (visual.state === 'repaired' || visual.state === 'beautified') breakdown.stable += 1
    if (visual.weathered) weatheredCount += 1
  })

  const lockedPlusCrackedPct = ratio(breakdown.locked + breakdown.cracked, breakdown.total)
  const stablePct = ratio(breakdown.stable, breakdown.total)

  let state: ZoneVisualStateName
  const rebuildTarget = rebuild?.target || 35
  const rebuildCount = rebuild?.correctCount || 0
  const rebuilt = rebuildCount >= rebuildTarget
  if (rebuilt) {
    state = 'rebuilt'
  } else if (rebuildCount > 0) {
    state = 'rebuilding'
  } else if (lockedPlusCrackedPct >= 70) {
    state = 'ruins'
  } else if (stablePct >= 80) {
    state = 'rebuilt_ready'
  } else {
    state = 'building'
  }

  return {
    state,
    breakdown: {
      ...breakdown,
      lockedPct: ratio(breakdown.locked, breakdown.total),
      crackedPct: ratio(breakdown.cracked, breakdown.total),
      stablePct,
    },
    weatheredPct: ratio(weatheredCount, breakdown.total),
    rebuild: rebuild ? { correctCount: rebuildCount, target: rebuildTarget, rebuilt } : undefined,
  }
}

export function getBiomeVisualState(
  subject: SubjectId,
  zones: Array<{ theme: string, tagIds: string[] }>,
  rewards: RewardsMeta,
  opts?: {
    zoneRebuildProgress?: Record<string, { correctCount?: number, target?: number }>
    biomeRebuild?: { correctCount?: number, target?: number }
  }
): BiomeVisualState {
  const zoneVisuals = zones.map(({ theme, tagIds }) => ({
    theme,
    visual: getZoneVisualState(subject, theme, tagIds, rewards, opts?.zoneRebuildProgress?.[`${subject}__${theme}`]),
  }))

  const aggregate = { totalTags: 0, locked: 0, cracked: 0, repaired: 0, beautified: 0, stable: 0 }
  zoneVisuals.forEach(({ visual }) => {
    aggregate.totalTags += visual.breakdown.total
    aggregate.locked += visual.breakdown.locked
    aggregate.cracked += visual.breakdown.cracked
    aggregate.repaired += visual.breakdown.repaired
    aggregate.beautified += visual.breakdown.beautified
    aggregate.stable += visual.breakdown.stable
  })

  const lockedPlusCrackedPct = ratio(aggregate.locked + aggregate.cracked, aggregate.totalTags)
  const stablePct = ratio(aggregate.stable, aggregate.totalTags)

  let state: BiomeVisualStateName
  if (lockedPlusCrackedPct >= 70) {
    state = 'wasteland'
  } else if (stablePct >= 80) {
    state = 'thriving'
  } else if (stablePct >= 40) {
    state = 'recovering'
  } else {
    state = 'neglected'
  }

  const zoneTargets = zones.length
  const rebuiltZones = zoneVisuals.filter(z => z.visual.rebuild?.rebuilt).length
  const readyForBiome = zoneTargets > 0 ? (rebuiltZones / zoneTargets) >= 0.6 : false
  const biomeTarget = opts?.biomeRebuild?.target || 100
  const biomeCount = opts?.biomeRebuild?.correctCount || 0
  let rebuildStatus: BiomeRebuildState = 'not_ready'
  if (biomeCount >= biomeTarget) {
    rebuildStatus = 'rebuilt'
  } else if (biomeCount > 0 && readyForBiome) {
    rebuildStatus = 'rebuilding'
  } else if (readyForBiome) {
    rebuildStatus = 'ready'
  }

  return {
    state,
    breakdown: {
      ...aggregate,
      lockedPct: ratio(aggregate.locked, aggregate.totalTags),
      crackedPct: ratio(aggregate.cracked, aggregate.totalTags),
      stablePct,
    },
    zones: zoneVisuals,
    rebuild: {
      status: rebuildStatus,
      correctCount: biomeCount,
      target: biomeTarget,
      rebuiltZones,
      totalZones: zoneTargets,
    },
  }
}
