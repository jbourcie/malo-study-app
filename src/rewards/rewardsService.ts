import { collection, doc, getDoc, getDocs, limit, query, runTransaction, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import type { UserRewards } from './rewards'
import { computeLevelFromXp, updateMasteryFromAttempt } from './rewards'
import { BADGES } from './badgesCatalog'

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
      collectibles: data.collectibles && Array.isArray(data.collectibles.owned)
        ? { owned: data.collectibles.owned, equippedAvatarId: data.collectibles.equippedAvatarId }
        : { owned: [], equippedAvatarId: undefined },
      updatedAt: data.updatedAt,
    }
  }
  const initial: UserRewards = { xp: 0, level: 1, badges: [], masteryByTag: {}, collectibles: { owned: [], equippedAvatarId: undefined }, updatedAt: serverTimestamp() as any }
  await setDoc(ref, initial)
  return initial
}

export async function awardSessionRewards(uid: string, sessionId: string | null, deltaXp: number): Promise<UserRewards> {
  if (deltaXp <= 0) return await getOrInitRewards(uid)
  const rewardsRef = doc(db, 'users', uid, 'meta', 'rewards')
  const eventsRef = sessionId ? doc(db, 'users', uid, 'rewardEvents', sessionId) : null

  let result: UserRewards | null = null

  await runTransaction(db, async (tx) => {
    const [evSnap, rewardsSnap] = await Promise.all([
      eventsRef ? tx.get(eventsRef) : Promise.resolve(null as any),
      tx.get(rewardsRef),
    ])

    if (eventsRef && evSnap && evSnap.exists()) {
      result = rewardsSnap.exists() ? (rewardsSnap.data() as UserRewards) : { xp: 0, level: 1 }
      return
    }

    const existing = rewardsSnap.exists() ? (rewardsSnap.data() as any) : null
    const current: UserRewards = {
      xp: existing?.xp || 0,
      level: existing?.level || 1,
      badges: Array.isArray(existing?.badges) ? existing.badges : [],
      masteryByTag: typeof existing?.masteryByTag === 'object' && existing?.masteryByTag ? existing.masteryByTag : {},
      collectibles: existing?.collectibles && Array.isArray(existing.collectibles.owned)
        ? existing.collectibles
        : { owned: [], equippedAvatarId: undefined },
      updatedAt: existing?.updatedAt,
    }
    const newXp = Math.max(0, (current.xp || 0) + deltaXp)
    const levelInfo = computeLevelFromXp(newXp)
    const nextRewards: UserRewards = {
      xp: newXp,
      level: levelInfo.level,
      badges: current.badges || [],
      masteryByTag: current.masteryByTag || {},
      collectibles: current.collectibles || { owned: [], equippedAvatarId: undefined },
      updatedAt: serverTimestamp() as any,
    }

    tx.set(rewardsRef, nextRewards, { merge: true })
    if (eventsRef) {
      tx.set(eventsRef, {
        sessionId,
        deltaXp,
        awardedAt: serverTimestamp(),
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
}) {
  const { uid, sessionId, items } = opts
  const rewardsRef = doc(db, 'users', uid, 'meta', 'rewards')

  await runTransaction(db, async (tx) => {
    const rewardsSnap = await tx.get(rewardsRef)
    const existing = rewardsSnap.exists() ? (rewardsSnap.data() as any) : null
    const current: UserRewards = {
      xp: existing?.xp || 0,
      level: existing?.level || 1,
      badges: Array.isArray(existing?.badges) ? existing.badges : [],
      masteryByTag: typeof existing?.masteryByTag === 'object' && existing?.masteryByTag ? existing.masteryByTag : {},
      updatedAt: existing?.updatedAt,
    }

    const now = serverTimestamp() as any
    const events = items.map(item => ({
      item,
      evRef: doc(db, 'users', uid, 'rewardEvents', `${sessionId}_${item.exerciseId}`)
    }))

    const eventSnaps = await Promise.all(events.map(e => tx.get(e.evRef)))

    let mastery = current.masteryByTag || {}
    events.forEach((e, idx) => {
      const evSnap = eventSnaps[idx]
      if (evSnap.exists()) return
      const tags = Array.isArray(e.item.tags) ? e.item.tags : []
      mastery = updateMasteryFromAttempt({
        masteryByTag: mastery,
        questionTags: tags,
        isCorrect: e.item.correct,
        timestamp: now,
      })
    })

    events.forEach((e, idx) => {
      const evSnap = eventSnaps[idx]
      if (evSnap.exists()) return
      const tags = Array.isArray(e.item.tags) ? e.item.tags : []
      tx.set(e.evRef, { sessionId, exerciseId: e.item.exerciseId, correct: e.item.correct, tags, createdAt: now })
    })

    tx.set(rewardsRef, {
      ...current,
      masteryByTag: mastery,
      updatedAt: serverTimestamp(),
    }, { merge: true })
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
