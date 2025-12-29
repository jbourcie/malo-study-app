import { collection, doc, getDoc, getDocs, limit, query, runTransaction, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import type { UserRewards } from './rewards'
import { computeLevelFromXp, updateMasteryFromAttempt } from './rewards'
import { BADGES } from './badgesCatalog'
import { createFirestoreRewardStore, type RewardStore } from './rewardStore'

export async function getOrInitRewards(uid: string): Promise<UserRewards> {
  const ref = doc(db, 'users', uid, 'meta', 'rewards')
  const snap = await getDoc(ref)
  if (snap.exists()) {
    const data = snap.data() as any
    return {
      xp: data.xp || 0,
      level: data.level || 1,
      badges: Array.isArray(data.badges) ? data.badges : [],
      masteryByTag: typeof data.masteryByTag === 'object' && data.masteryByTag ? data.masteryByTag : {},
      blockProgress: typeof data.blockProgress === 'object' && data.blockProgress ? data.blockProgress : {},
      collectibles: data.collectibles && Array.isArray(data.collectibles.owned)
        ? { owned: data.collectibles.owned, equippedAvatarId: data.collectibles.equippedAvatarId ?? null }
        : { owned: [], equippedAvatarId: null },
      malocraft: data.malocraft && Array.isArray(data.malocraft.ownedLootIds)
        ? { ownedLootIds: data.malocraft.ownedLootIds, equippedAvatarId: data.malocraft.equippedAvatarId ?? null, biomeMilestones: data.malocraft.biomeMilestones || {} }
        : { ownedLootIds: [], equippedAvatarId: null, biomeMilestones: {} },
      zoneRebuildProgress: typeof data.zoneRebuildProgress === 'object' && data.zoneRebuildProgress ? data.zoneRebuildProgress : {},
      biomeRebuildProgress: typeof data.biomeRebuildProgress === 'object' && data.biomeRebuildProgress ? data.biomeRebuildProgress : {},
      updatedAt: data.updatedAt,
    }
  }
  const initial: UserRewards = { xp: 0, level: 1, badges: [], masteryByTag: {}, blockProgress: {}, collectibles: { owned: [], equippedAvatarId: null }, malocraft: { ownedLootIds: [], equippedAvatarId: null, biomeMilestones: {} }, zoneRebuildProgress: {}, biomeRebuildProgress: {}, updatedAt: serverTimestamp() as any }
  await setDoc(ref, initial)
  return initial
}

export async function awardSessionRewards(uid: string, sessionId: string | null, deltaXp: number, store: RewardStore = createFirestoreRewardStore()): Promise<UserRewards> {
  if (deltaXp <= 0) return await getOrInitRewards(uid)
  let result: UserRewards | null = null

  await store.runTransaction(async (tx) => {
    const existing = await tx.getRewards(uid)
    const eventAlreadyExists = sessionId ? await tx.getRewardEvent(uid, sessionId) : null

    if (sessionId && eventAlreadyExists) {
      result = existing || { xp: 0, level: 1 }
      return
    }

    const current: UserRewards = {
      xp: existing?.xp || 0,
      level: existing?.level || 1,
      badges: Array.isArray(existing?.badges) ? existing.badges : [],
      masteryByTag: typeof existing?.masteryByTag === 'object' && existing?.masteryByTag ? existing.masteryByTag : {},
      blockProgress: typeof existing?.blockProgress === 'object' && existing?.blockProgress ? existing.blockProgress : {},
      collectibles: existing?.collectibles && Array.isArray(existing.collectibles.owned)
        ? { owned: existing.collectibles.owned, equippedAvatarId: existing.collectibles.equippedAvatarId ?? null }
        : { owned: [], equippedAvatarId: null },
      malocraft: existing?.malocraft && Array.isArray(existing.malocraft.ownedLootIds)
        ? { ownedLootIds: existing.malocraft.ownedLootIds, equippedAvatarId: existing.malocraft.equippedAvatarId ?? null, biomeMilestones: existing.malocraft.biomeMilestones || {} }
        : { ownedLootIds: [], equippedAvatarId: null, biomeMilestones: {} },
      zoneRebuildProgress: typeof existing?.zoneRebuildProgress === 'object' && existing.zoneRebuildProgress ? existing.zoneRebuildProgress : {},
      biomeRebuildProgress: typeof existing?.biomeRebuildProgress === 'object' && existing.biomeRebuildProgress ? existing.biomeRebuildProgress : {},
      updatedAt: existing?.updatedAt,
    }
    const newXp = Math.max(0, (current.xp || 0) + deltaXp)
    const levelInfo = computeLevelFromXp(newXp)
    const nextRewards: UserRewards = {
      xp: newXp,
      level: levelInfo.level,
      badges: current.badges || [],
      masteryByTag: current.masteryByTag || {},
      blockProgress: current.blockProgress || {},
      collectibles: {
        owned: current.collectibles?.owned || [],
        equippedAvatarId: current.collectibles?.equippedAvatarId ?? null,
      },
      malocraft: current.malocraft || { ownedLootIds: [], equippedAvatarId: null, biomeMilestones: {} },
      zoneRebuildProgress: current.zoneRebuildProgress || {},
      biomeRebuildProgress: current.biomeRebuildProgress || {},
      updatedAt: store.createTimestamp(),
    }

    tx.setRewards(uid, nextRewards)
    if (sessionId) {
      tx.setRewardEvent(uid, sessionId, {
        sessionId,
        deltaXp,
        awardedAt: store.createTimestamp(),
      })
    }
    result = nextRewards
  })

  return result || { xp: 0, level: 1 }
}

export async function applyMasteryEvents(opts: {
  uid: string
  sessionId: string
  items: Array<{ exerciseId: string, tags?: string[], correct: boolean }>
}, store: RewardStore = createFirestoreRewardStore()) {
  const { uid, sessionId, items } = opts
  const now = store.createTimestamp()

  await store.runTransaction(async (tx) => {
    const existing = await tx.getRewards(uid)
    const current: UserRewards = {
      xp: existing?.xp || 0,
      level: existing?.level || 1,
      badges: Array.isArray(existing?.badges) ? existing.badges : [],
      masteryByTag: typeof existing?.masteryByTag === 'object' && existing?.masteryByTag ? existing.masteryByTag : {},
      blockProgress: typeof existing?.blockProgress === 'object' && existing?.blockProgress ? existing.blockProgress : {},
      collectibles: existing?.collectibles,
      malocraft: existing?.malocraft,
      zoneRebuildProgress: existing?.zoneRebuildProgress,
      biomeRebuildProgress: existing?.biomeRebuildProgress,
      updatedAt: existing?.updatedAt,
    }

    const events = items.map(item => ({
      item,
      id: `${sessionId}_${item.exerciseId}`,
    }))

    const eventSnapshots = await Promise.all(events.map(e => tx.getRewardEvent(uid, e.id)))

    let mastery = current.masteryByTag || {}
    let blockProgress = current.blockProgress || {}
    events.forEach((e, idx) => {
      const existingEvent = eventSnapshots[idx]
      if (existingEvent) return
      const tags = Array.isArray(e.item.tags) ? e.item.tags : []
      mastery = updateMasteryFromAttempt({
        masteryByTag: mastery,
        questionTags: tags,
        isCorrect: e.item.correct,
        timestamp: now,
      })
      tags.forEach((tag) => {
        const prev = blockProgress?.[tag] || { attempts: 0, correct: 0, successRate: 0, state: 'discovering', score: mastery?.[tag]?.score || 0 }
        const masteryState = mastery?.[tag]?.state || 'discovering'
        const masteryScore = mastery?.[tag]?.score ?? prev.score ?? 0
        const attempts = (prev.attempts || 0) + 1
        const correct = (prev.correct || 0) + (e.item.correct ? 1 : 0)
        const successRate = attempts > 0 ? Math.round((correct / attempts) * 100) : 0
        blockProgress = {
          ...blockProgress,
          [tag]: {
            state: masteryState,
            score: masteryScore,
            attempts,
            correct,
            successRate,
            updatedAt: now,
          }
        }
      })
    })

    events.forEach((e, idx) => {
      const existingEvent = eventSnapshots[idx]
      if (existingEvent) return
      const tags = Array.isArray(e.item.tags) ? e.item.tags : []
      tx.setRewardEvent(uid, e.id, { sessionId, exerciseId: e.item.exerciseId, correct: e.item.correct, tags, createdAt: now })
    })

    tx.setRewards(uid, {
      ...current,
      masteryByTag: mastery,
      blockProgress,
      zoneRebuildProgress: current.zoneRebuildProgress || {},
      biomeRebuildProgress: current.biomeRebuildProgress || {},
      updatedAt: store.createTimestamp(),
    })
  })
}

export async function evaluateBadges(opts: {
  uid: string
  rewards: UserRewards
}) {
  const { uid, rewards } = opts
  const unlocked: string[] = []
  const currentBadges = Array.isArray(rewards.badges) ? rewards.badges : []

  // Fetch supporting data
  const statsSnap = await getDoc(doc(db, 'users', uid, 'stats', 'main'))
  const summarySnap = await getDoc(doc(db, 'users', uid, 'progressSummary', 'main'))
  const stats = statsSnap.exists() ? (statsSnap.data() as any) : {}
  const summary = summarySnap.exists() ? (summarySnap.data() as any) : {}

  const streakDays = stats.streakDays || 0
  const totalAttempts = summary.totalAttempts || 0

  const masteryMap = rewards.masteryByTag || {}
  const masteredTags = Object.entries(masteryMap)
    .filter(([, v]) => v?.state === 'mastered')
    .map(([tag]) => tag)

  // retry_5: count incorrect events
  const retrySnap = await getDocs(query(
    collection(db, 'users', uid, 'rewardEvents'),
    where('correct', '==', false),
    limit(5)
  ))
  const incorrectCount = retrySnap.size

  const hasBadge = (id: string) => currentBadges.includes(id) || unlocked.includes(id)

  if (!hasBadge('streak_3') && streakDays >= 3) unlocked.push('streak_3')
  if (!hasBadge('streak_7') && streakDays >= 7) unlocked.push('streak_7')
  if (!hasBadge('sessions_10') && totalAttempts >= 10) unlocked.push('sessions_10')
  if (!hasBadge('retry_5') && incorrectCount >= 5) unlocked.push('retry_5')

  const masteredCount = masteredTags.length
  if (!hasBadge('tag_master_3') && masteredCount >= 3) unlocked.push('tag_master_3')
  if (!hasBadge('tag_master_10') && masteredCount >= 10) unlocked.push('tag_master_10')

  if (!hasBadge('fractions_first_mastery') && masteredTags.some(t => t.startsWith('math_fractions'))) {
    unlocked.push('fractions_first_mastery')
  }
  if (!hasBadge('grammar_first_mastery') && masteredTags.some(t => t.startsWith('fr_grammaire'))) {
    unlocked.push('grammar_first_mastery')
  }

  if (!unlocked.length) return []

  const rewardsRef = doc(db, 'users', uid, 'meta', 'rewards')
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(rewardsRef)
    const current = snap.exists() ? (snap.data() as any) : {}
    const currentList = Array.isArray(current.badges) ? current.badges : []
    const newOnes = unlocked.filter(id => !currentList.includes(id))
    if (!newOnes.length) return
    tx.set(rewardsRef, {
      badges: [...currentList, ...newOnes],
      updatedAt: serverTimestamp(),
    }, { merge: true })
    newOnes.forEach(id => {
      tx.set(doc(db, 'users', uid, 'rewardEvents', `badge_${id}`), {
        type: 'badge',
        badgeId: id,
        createdAt: serverTimestamp(),
      })
    })
  })

  return unlocked
}
