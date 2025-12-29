import type { SubjectId } from '../taxonomy/tagCatalog'
import { getTagMeta } from '../taxonomy/tagCatalog'
import type { RewardStore } from '../rewards/rewardStore'
import { createFirestoreRewardStore } from '../rewards/rewardStore'
import type { UserRewards } from '../rewards/rewards'

export type ZoneRebuildEntry = {
  correctCount: number
  target: number
  updatedAt?: any
  rebuiltAt?: any
}

export type BiomeRebuildEntry = {
  correctCount: number
  target: number
  updatedAt?: any
  rebuiltAt?: any
}

export function zoneKey(subject: SubjectId, theme: string): string {
  return `${subject}__${theme}`
}

export async function applyZoneRebuildProgress(opts: {
  uid: string
  sessionId: string
  subject: SubjectId
  theme: string
  tagStats: Record<string, { correct: number }>
  target?: number
  store?: RewardStore
}): Promise<{ deltaApplied: number, progress: ZoneRebuildEntry | null }> {
  const { uid, sessionId, subject, theme, tagStats } = opts
  const target = opts.target ?? 35
  const store = opts.store || createFirestoreRewardStore()
  const zKey = zoneKey(subject, theme)
  const eventId = `zone_rebuild_${zKey}_${sessionId}`

  let deltaApplied = 0
  let progress: ZoneRebuildEntry | null = null

  await store.runTransaction(async (tx) => {
    const existingEvent = await tx.getRewardEvent(uid, eventId)
    const currentRewards = await tx.getRewards(uid)
    const now = store.createTimestamp()
    const zoneProgress: Record<string, ZoneRebuildEntry> = currentRewards?.zoneRebuildProgress || {}

    if (existingEvent) {
      progress = zoneProgress[zKey] || null
      deltaApplied = 0
      return
    }

    const zoneTags = Object.entries(tagStats).filter(([tag]) => {
      const meta = getTagMeta(tag)
      return meta.subject === subject && meta.theme === theme
    })
    const delta = zoneTags.reduce((acc, [, stats]) => acc + Math.max(0, stats.correct || 0), 0)

    const prev = zoneProgress[zKey] || { correctCount: 0, target }
    const nextCount = Math.min(target, (prev.correctCount || 0) + delta)
    const rebuilt = prev.rebuiltAt || (nextCount >= target ? now : undefined)
    const nextEntry: ZoneRebuildEntry = {
      correctCount: nextCount,
      target: prev.target || target,
      updatedAt: now,
      rebuiltAt: rebuilt,
    }

    zoneProgress[zKey] = nextEntry
    tx.setRewards(uid, { zoneRebuildProgress: zoneProgress } as Partial<UserRewards>)
    tx.setRewardEvent(uid, eventId, {
      type: 'zone_rebuild',
      zoneKey: zKey,
      sessionId,
      delta: nextCount - (prev.correctCount || 0),
      createdAt: now,
    })
    deltaApplied = nextCount - (prev.correctCount || 0)
    progress = nextEntry
  })

  return { deltaApplied, progress }
}

export async function applyBiomeRebuildProgress(opts: {
  uid: string
  sessionId: string
  subject: SubjectId
  tagStats: Record<string, { correct: number }>
  target?: number
  store?: RewardStore
}): Promise<{ deltaApplied: number, progress: BiomeRebuildEntry | null }> {
  const { uid, sessionId, subject, tagStats } = opts
  const target = opts.target ?? 100
  const store = opts.store || createFirestoreRewardStore()
  const biomeKey = subject
  const eventId = `biome_rebuild_${biomeKey}_${sessionId}`

  let deltaApplied = 0
  let progress: BiomeRebuildEntry | null = null

  await store.runTransaction(async (tx) => {
    const existingEvent = await tx.getRewardEvent(uid, eventId)
    const currentRewards = await tx.getRewards(uid)
    const now = store.createTimestamp()
    const biomeProgress: Record<string, BiomeRebuildEntry> = currentRewards?.biomeRebuildProgress || {}

    if (existingEvent) {
      progress = biomeProgress[biomeKey] || null
      deltaApplied = 0
      return
    }

    const delta = Object.entries(tagStats || {})
      .filter(([tag]) => getTagMeta(tag).subject === subject)
      .reduce((acc, [, stats]) => acc + Math.max(0, stats.correct || 0), 0)

    const prev = biomeProgress[biomeKey] || { correctCount: 0, target }
    const nextCount = Math.min(target, (prev.correctCount || 0) + delta)
    const rebuilt = prev.rebuiltAt || (nextCount >= target ? now : undefined)
    const nextEntry: BiomeRebuildEntry = {
      correctCount: nextCount,
      target: prev.target || target,
      updatedAt: now,
      rebuiltAt: rebuilt,
    }

    biomeProgress[biomeKey] = nextEntry
    tx.setRewards(uid, { biomeRebuildProgress: biomeProgress } as Partial<UserRewards>)
    tx.setRewardEvent(uid, eventId, {
      type: 'biome_rebuild',
      biomeKey,
      sessionId,
      delta: nextCount - (prev.correctCount || 0),
      createdAt: now,
    })
    deltaApplied = nextCount - (prev.correctCount || 0)
    progress = nextEntry
  })

  return { deltaApplied, progress }
}
