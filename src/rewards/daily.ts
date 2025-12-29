import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { computeLevelFromXp, type UserRewards } from './rewards'
import { unlockCollectible } from './collectiblesService'
import { COLLECTIBLES } from './collectiblesCatalog'
import { getTagMeta } from '../taxonomy/tagCatalog'
import { loadNpcPriorityTags } from '../data/npcPriorities'

export type DailyQuestType = 'session' | 'remediation' | 'progress'

export const DAILY_QUEST_CONFIG = {
  targets: {
    session: 1,
    remediation: 3,
    progress: 5, // tunable to 4 if friction is too high
  },
  xpRewards: {
    session: 10,
    remediation: 20,
    progress: 15,
    dailyBonus: 30,
  },
  sticker: {
    enabled: true,
    rarity: 'common',
  },
} as const

export type DailyQuest =
  | {
      id: string
      type: DailyQuestType
      title: string
      description: string
      target: number
      progress: number
      completed: boolean
      tagId?: string | null
      tagHint?: string | null
    }
  // Legacy fallback (v1 pool)
  | {
      id: string
      title: string
      description: string
      target: number
      progress: number
      completed: boolean
      type?: DailyQuestType
      tagId?: string | null
      tagHint?: string | null
    }

export type DailyState = {
  dateKey: string
  quests: DailyQuest[]
  bonusAwarded?: boolean
  updatedAt?: any
}

export function todayKeyParis() {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
  const parts = formatter.formatToParts(now)
  const y = parts.find(p => p.type === 'year')?.value
  const m = parts.find(p => p.type === 'month')?.value
  const d = parts.find(p => p.type === 'day')?.value
  return `${y}-${m}-${d}`
}

function pickRemediationTag(masteryByTag: UserRewards['masteryByTag'] | undefined, priorityTags?: Set<string>): string | null {
  if (!masteryByTag) return null
  const entries = Object.entries(masteryByTag).filter(([tag, v]) =>
    typeof v?.score === 'number'
    && !!getTagMeta(tag)
    && (!priorityTags || priorityTags.has(tag))
  )
  if (!entries.length) return null
  const weak = entries.filter(([, v]) => (v?.score ?? 0) < 50)
  if (!weak.length) return null
  return weak.sort((a, b) => (a[1].score ?? 0) - (b[1].score ?? 0))[0]?.[0] || null
}

function pickProgressTag(masteryByTag: UserRewards['masteryByTag'] | undefined, excludeTag?: string | null, priorityTags?: Set<string>): string | null {
  if (!masteryByTag) return null
  const entries = Object.entries(masteryByTag).filter(([tag, v]) =>
    typeof v?.score === 'number'
    && !!getTagMeta(tag)
    && tag !== excludeTag
    && (!priorityTags || priorityTags.has(tag))
  )
  if (!entries.length) return null
  const filtered = entries.filter(([, v]) => (v?.score ?? 0) >= 30 && (v?.score ?? 0) < 80)
  if (!filtered.length) return null
  return filtered.sort((a, b) => (b[1].score ?? 0) - (a[1].score ?? 0))[0]?.[0] || null
}

function tagLabel(tagId: string | null): string | null {
  if (!tagId) return null
  return getTagMeta(tagId)?.label || tagId
}

function buildDailyQuestsFromMastery(masteryByTag: UserRewards['masteryByTag'] | undefined, opts?: { priorityTags?: Set<string> }): DailyQuest[] {
  const priorityTags = opts?.priorityTags
  const remediationTag = pickRemediationTag(masteryByTag, priorityTags)
  const progressTag = pickProgressTag(masteryByTag, remediationTag, priorityTags)

  const sessionQuest: DailyQuest = {
    id: 'session',
    type: 'session',
    title: 'Session du jour',
    description: 'Fais au moins une session complète aujourd’hui.',
    target: DAILY_QUEST_CONFIG.targets.session,
    progress: 0,
    completed: false,
  }

  const remediationQuest: DailyQuest = {
    id: remediationTag ? `remediation:${remediationTag}` : 'remediation',
    type: 'remediation',
    title: 'Remédiation ciblée',
    description: remediationTag
      ? `Renforce ${tagLabel(remediationTag)} avec des réponses correctes.`
      : 'On s’entraîne un peu aujourd’hui, puis on reviendra sur des notions plus ciblées.',
    target: DAILY_QUEST_CONFIG.targets.remediation,
    progress: 0,
    completed: false,
    tagId: remediationTag || null,
    tagHint: remediationTag ? tagLabel(remediationTag) : null,
  }

  const progressQuest: DailyQuest = {
    id: progressTag ? `progress:${progressTag}` : 'progress',
    type: 'progress',
    title: 'Valorisation / amélioration',
    description: progressTag
      ? `Améliore ${tagLabel(progressTag)} en enchaînant des bonnes réponses.`
      : 'On s’entraîne un peu aujourd’hui, puis on reviendra sur des notions plus ciblées.',
    target: DAILY_QUEST_CONFIG.targets.progress,
    progress: 0,
    completed: false,
    tagId: progressTag || null,
    tagHint: progressTag ? tagLabel(progressTag) : null,
  }

  return [sessionQuest, remediationQuest, progressQuest]
}

export { buildDailyQuestsFromMastery }

export async function ensureDailyState(uid: string): Promise<DailyState> {
  const today = todayKeyParis()
  const dailyRef = doc(db, 'users', uid, 'meta', 'daily')
  const [snap, rewardsSnap, priorityTagsList] = await Promise.all([
    getDoc(dailyRef),
    getDoc(doc(db, 'users', uid, 'meta', 'rewards')),
    loadNpcPriorityTags(uid),
  ])
  const priorityTags = new Set(priorityTagsList || [])
  const data = snap.exists() ? (snap.data() as DailyState) : null
  if (!data || data.dateKey !== today) {
    const rewards = rewardsSnap.exists() ? (rewardsSnap.data() as UserRewards) : undefined
    const quests = buildDailyQuestsFromMastery(rewards?.masteryByTag || {}, { priorityTags })
    const next: DailyState = {
      dateKey: today,
      quests,
      bonusAwarded: false,
      updatedAt: serverTimestamp() as any,
    }
    await setDoc(dailyRef, next)
    return next
  }
  return data
}

export async function getDailyState(uid: string): Promise<DailyState> {
  return ensureDailyState(uid)
}

export async function updateDailyProgress(opts: {
  uid: string
  sessionId: string
  answeredCount: number
  tagsUsed: string[]
  tagStats?: Record<string, { answered: number; correct: number }>
}): Promise<{ allCompleted: boolean }> {
  const { uid, sessionId, answeredCount, tagsUsed, tagStats = {} } = opts
  const dailyRef = doc(db, 'users', uid, 'meta', 'daily')
  const rewardsRef = doc(db, 'users', uid, 'meta', 'rewards')
  const evRef = doc(db, 'users', uid, 'rewardEvents', `daily_${sessionId}`)
  const bonusEvRef = doc(db, 'users', uid, 'rewardEvents', `daily_bonus_${todayKeyParis()}`)
  const today = todayKeyParis()

  // Ensure daily exists for today
  await ensureDailyState(uid)

  let awardedStickerId: string | null = null
  let allCompleted = false

  await runTransaction(db, async (tx) => {
    const [dailySnap, evSnap, rewardsSnap, bonusSnap] = await Promise.all([
      tx.get(dailyRef),
      tx.get(evRef),
      tx.get(rewardsRef),
      tx.get(bonusEvRef),
    ])
    if (evSnap.exists()) return
    const daily = dailySnap.exists() ? (dailySnap.data() as DailyState) : null
    if (!daily || daily.dateKey !== today) {
      // regen simple
      const rewards = rewardsSnap.exists() ? (rewardsSnap.data() as UserRewards) : undefined
      const priorityTags = new Set(await loadNpcPriorityTags(uid))
      tx.set(dailyRef, { dateKey: today, quests: buildDailyQuestsFromMastery(rewards?.masteryByTag || {}, { priorityTags }), bonusAwarded: false, updatedAt: serverTimestamp() })
      return
    }

    const tags = tagsUsed || []
    const grammarCount = tags.filter(t => t.includes('grammaire') || t.includes('grammar')).length
    const fractionsCount = tags.filter(t => t.startsWith('math_fractions')).length
    const perTag = { ...tagStats }
    if (!Object.keys(perTag).length && tags.length) {
      tags.forEach(tag => {
        const stats = perTag[tag] || { answered: 0, correct: 0 }
        stats.answered += 1
        stats.correct += 1 // best effort fallback sans détail de correction
        perTag[tag] = stats
      })
    }

    let deltaXp = 0
    let anyCompleted = false
    let bonusAwarded = daily.bonusAwarded || false
    const quests = daily.quests.map(q => {
      let add = 0
      // Legacy quests support
      if (q.id === 'session_one') add = 1
      if (q.id === 'answer_ten') add = answeredCount
      if (q.id === 'grammar_one') add = grammarCount > 0 ? 1 : 0
      if (q.id === 'fractions_five') add = fractionsCount

      // New quests
      if (q.type === 'session') add = 1
      if (q.type === 'remediation') {
        const targetTag = q.tagId || tags.find(t => t.includes('grammar') || t.includes('math_fractions')) || null
        if (targetTag) {
          const stats = perTag[targetTag] || { answered: 0, correct: 0 }
          add = stats.correct || 0
        } else {
          add = answeredCount > 0 ? Math.min(3, answeredCount) : 0
        }
      }
      if (q.type === 'progress') {
        const targetTag = q.tagId || tags[0] || null
        if (targetTag) {
          const stats = perTag[targetTag] || { answered: 0, correct: 0 }
          add = stats.correct || 0
        } else {
          add = answeredCount > 0 ? Math.min(5, answeredCount) : 0
        }
      }

      const nextProgress = Math.min(q.target, (q.progress || 0) + add)
      const wasCompleted = q.completed
      const completed = nextProgress >= q.target
      if (completed && !wasCompleted) {
        anyCompleted = true
        const rewardType: DailyQuestType =
          q.type
          || (q.id === 'session_one' ? 'session'
            : q.id === 'grammar_one' ? 'remediation'
              : 'progress')
        deltaXp += DAILY_QUEST_CONFIG.xpRewards[rewardType] || DAILY_QUEST_CONFIG.xpRewards.progress
      }
      return { ...q, progress: nextProgress, completed }
    })

    // Optionnel : si une quête complétée et sticker commun dispo, on le donnera après la transaction.
    if (anyCompleted && DAILY_QUEST_CONFIG.sticker.enabled) {
      const rewardsData = rewardsSnap.exists() ? (rewardsSnap.data() as any) : {}
      const currentXp = rewardsData?.xp || 0
      const newXp = currentXp + deltaXp
      const lvlInfo = computeLevelFromXp(newXp)
      tx.set(rewardsRef, {
        xp: newXp,
        level: lvlInfo.level,
        badges: rewardsData?.badges || [],
        masteryByTag: rewardsData?.masteryByTag || {},
        collectibles: rewardsData?.collectibles
          ? { owned: rewardsData.collectibles.owned || [], equippedAvatarId: rewardsData.collectibles.equippedAvatarId ?? null }
          : { owned: [], equippedAvatarId: null },
        updatedAt: serverTimestamp(),
      }, { merge: true })
      const commonOwned = new Set<string>(rewardsData?.collectibles?.owned || [])
      const commons = COLLECTIBLES.filter(c =>
        c.rarity === DAILY_QUEST_CONFIG.sticker.rarity
        && c.type === 'sticker'
        && !commonOwned.has(c.id)
      )
      if (commons.length) {
        const picked = commons[Math.floor(Math.random() * commons.length)]
        awardedStickerId = picked.id
      }
    }

    // Bonus daily (1x/jour)
    allCompleted = quests.every(q => q.completed)
    if (allCompleted && !bonusSnap.exists() && !bonusAwarded) {
      const rewardsData = rewardsSnap.exists() ? (rewardsSnap.data() as any) : {}
      const currentXp = rewardsData?.xp || 0
      deltaXp += DAILY_QUEST_CONFIG.xpRewards.dailyBonus
      const newXp = currentXp + deltaXp
      const lvlInfo = computeLevelFromXp(newXp)
      tx.set(rewardsRef, {
        xp: newXp,
        level: lvlInfo.level,
        badges: rewardsData?.badges || [],
        masteryByTag: rewardsData?.masteryByTag || {},
        collectibles: rewardsData?.collectibles
          ? { owned: rewardsData.collectibles.owned || [], equippedAvatarId: rewardsData.collectibles.equippedAvatarId ?? null }
          : { owned: [], equippedAvatarId: null },
        updatedAt: serverTimestamp(),
      }, { merge: true })
      tx.set(bonusEvRef, { dateKey: today, type: 'daily_bonus', createdAt: serverTimestamp() })
      bonusAwarded = true
    }

    tx.set(dailyRef, { dateKey: today, quests, bonusAwarded, updatedAt: serverTimestamp() }, { merge: true })
    tx.set(evRef, { sessionId, createdAt: serverTimestamp() })
  })

  if (awardedStickerId) {
    try {
      await unlockCollectible(uid, awardedStickerId, `daily_sticker_${sessionId}`)
    } catch (e) {
      console.error('unlockCollectible daily', e)
    }
  }

  return { allCompleted }
}
