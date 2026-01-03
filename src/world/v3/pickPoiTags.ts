import type { TagMeta } from '../../taxonomy/tagCatalog'
import type { UserRewards } from '../../rewards/rewards'

type PickPoiArgs = {
  tags: TagMeta[]
  masteryByTag?: UserRewards['masteryByTag']
  blockProgress?: UserRewards['blockProgress']
  recentlyPlayed?: string[]
  limit?: number
}

function masteryScore(tagId: string, masteryByTag?: UserRewards['masteryByTag'], blockProgress?: UserRewards['blockProgress']): number {
  const masteryScore = masteryByTag?.[tagId]?.score
  if (typeof masteryScore === 'number') return masteryScore
  const blockScore = blockProgress?.[tagId]?.score
  if (typeof blockScore === 'number') return blockScore
  return 0
}

function updatedAtMs(tagId: string, blockProgress?: UserRewards['blockProgress']): number {
  const raw = blockProgress?.[tagId]?.updatedAt as any
  if (!raw) return 0
  if (typeof raw === 'number') return raw
  if (typeof raw.toMillis === 'function') return raw.toMillis()
  if (typeof raw.toDate === 'function') return raw.toDate().getTime()
  if (typeof raw.seconds === 'number') return raw.seconds * 1000 + (raw.nanoseconds ? raw.nanoseconds / 1e6 : 0)
  return 0
}

export function pickPoiTags({ tags, masteryByTag, blockProgress, recentlyPlayed = [], limit = 10 }: PickPoiArgs): TagMeta[] {
  const recentSet = new Set(recentlyPlayed)

  const sorted = [...tags].sort((a, b) => {
    const scoreA = masteryScore(a.id, masteryByTag, blockProgress)
    const scoreB = masteryScore(b.id, masteryByTag, blockProgress)

    const bucketA = scoreA < 50 ? 0 : scoreA < 80 ? 1 : recentSet.has(a.id) ? 2 : 3
    const bucketB = scoreB < 50 ? 0 : scoreB < 80 ? 1 : recentSet.has(b.id) ? 2 : 3
    if (bucketA !== bucketB) return bucketA - bucketB

    const recentA = updatedAtMs(a.id, blockProgress)
    const recentB = updatedAtMs(b.id, blockProgress)
    if (recentA !== recentB) return recentB - recentA

    const orderA = typeof a.order === 'number' ? a.order : 9999
    const orderB = typeof b.order === 'number' ? b.order : 9999
    if (orderA !== orderB) return orderA - orderB

    return a.id.localeCompare(b.id)
  })

  const capped = Math.max(0, Math.floor(limit))
  return capped ? sorted.slice(0, capped) : []
}
