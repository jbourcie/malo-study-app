/**
 * MaloCraft loot — extension compatible avec le système de rewards existant.
 * Voir audit : docs/MaloCraft_Rewards_Audit.md
 */
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { pickLoot } from './malocraftLootRoll'
import { MALLOOT_CATALOG, type MalocraftLoot } from './malocraftLootCatalog'
import type { UserRewards } from './rewards'
import { unlockCollectible } from './collectiblesService'

type AwardParams = {
  uid: string
  sessionId: string
  biomeId: string
  targetTagId: string
  expedition: 'mine' | 'repair' | 'craft'
  sessionStats: {
    deltaXp?: number
    correctRate?: number
    streakCorrectMax?: number
    levelUp?: boolean
  }
}

function countMasteredInBiome(rewards: UserRewards, biomeId: string): number {
  const mastery = rewards.masteryByTag || {}
  const mastered = Object.entries(mastery).filter(([, v]) => v?.state === 'mastered')
  // fallback: approximate by tag prefix
  return mastered.filter(([tag]) => tag.includes(biomeId.split('_')[1] || '')).length
}

const MILESTONE_PALIERS = [3, 6, 10]

function milestoneLoot(biomeId: string, masteredCount: number, alreadyLevel: number): MalocraftLoot | null {
  let level = alreadyLevel || 0
  for (const palier of MILESTONE_PALIERS) {
    if (masteredCount >= palier && palier > level) {
      level = palier
    }
  }
  if (level === alreadyLevel) return null
  const trophy = MALLOOT_CATALOG.find(l => l.type === 'trophy' && l.biomeId === biomeId && l.title.includes(level >= 10 ? 'Or' : level >= 6 ? 'Argent' : 'Bronze'))
  return trophy || null
}

export async function awardMalocraftLoot(params: AwardParams): Promise<{ awarded?: MalocraftLoot | null }> {
  const { uid, sessionId, biomeId, sessionStats, expedition } = params
  const eventId = `malocraftLoot:${sessionId}`
  const rewardsRef = doc(db, 'users', uid, 'meta', 'rewards')
  const evRef = doc(db, 'users', uid, 'rewardEvents', eventId)

  let awarded: MalocraftLoot | null = null

  await runTransaction(db, async (tx) => {
    const [evSnap, rewardsSnap] = await Promise.all([tx.get(evRef), tx.get(rewardsRef)])
    if (evSnap.exists()) {
      return
    }
    const data = rewardsSnap.exists() ? (rewardsSnap.data() as any) : null
    const rewards: UserRewards = {
      xp: data?.xp || 0,
      level: data?.level || 1,
      badges: data?.badges || [],
      masteryByTag: data?.masteryByTag || {},
      collectibles: data?.collectibles || { owned: [], equippedAvatarId: null },
      malocraft: data?.malocraft || { ownedLootIds: [], equippedAvatarId: undefined, biomeMilestones: {} },
      updatedAt: data?.updatedAt,
    }
    const owned = new Set(rewards.malocraft?.ownedLootIds || [])

    // Milestone check
    const mastered = countMasteredInBiome(rewards, biomeId)
    const currentLevel = rewards.malocraft?.biomeMilestones?.[biomeId] || 0
    const trophy = milestoneLoot(biomeId, mastered, currentLevel)

    if (trophy && !owned.has(trophy.id)) {
      awarded = trophy
      owned.add(trophy.id)
      tx.set(rewardsRef, {
        malocraft: {
          ownedLootIds: Array.from(owned),
          biomeMilestones: { ...(rewards.malocraft?.biomeMilestones || {}), [biomeId]: Math.max(currentLevel, mastered) },
          equippedAvatarId: rewards.malocraft?.equippedAvatarId ?? undefined,
        },
        updatedAt: serverTimestamp(),
      }, { merge: true })
      tx.set(evRef, { type: 'malocraft', sessionId, awardedId: trophy.id, milestone: true, createdAt: serverTimestamp() })
      return
    }

    // Roll standard
    const success = (sessionStats.deltaXp || 0) >= 10 || (sessionStats.correctRate || 0) >= 0.5
    if (!success) return

    const rolled = pickLoot({
      owned,
      biomeId,
      correctRate: sessionStats.correctRate,
      levelUp: sessionStats.levelUp,
      expedition,
    })
    if (!rolled) return
    awarded = rolled
    owned.add(rolled.id)
    const nextMilestones = { ...(rewards.malocraft?.biomeMilestones || {}) }
    tx.set(rewardsRef, {
      malocraft: {
        ownedLootIds: Array.from(owned),
        biomeMilestones: nextMilestones,
        equippedAvatarId: rewards.malocraft?.equippedAvatarId ?? undefined,
      },
      collectibles: rolled.type === 'avatar'
        ? {
            owned: Array.from(new Set([...(rewards.collectibles?.owned || []), rolled.id])),
            equippedAvatarId: rewards.collectibles?.equippedAvatarId ?? rolled.id,
          }
        : rewards.collectibles || { owned: [], equippedAvatarId: null },
      updatedAt: serverTimestamp(),
    }, { merge: true })
    tx.set(evRef, { type: 'malocraft', sessionId, awardedId: rolled.id, milestone: false, createdAt: serverTimestamp() })
  })

  // Sync collectibles equip if avatar (outside TX but idempotent via event)
  if (awarded && awarded.type === 'avatar') {
    try {
      await unlockCollectible(params.uid, awarded.id, `collectible_${eventId}`)
    } catch {
      // ignore
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[malocraft.award]', { awarded: awarded?.id || null, rarity: awarded?.rarity, expedition, sessionId })
  }

  return { awarded }
}
