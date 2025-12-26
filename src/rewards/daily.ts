import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { computeLevelFromXp } from './rewards'
import { unlockCollectible } from './collectiblesService'
import { COLLECTIBLES } from './collectiblesCatalog'

export type DailyQuest = {
  id: string
  title: string
  description: string
  target: number
  progress: number
  completed: boolean
}

export type DailyState = {
  dateKey: string
  quests: DailyQuest[]
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

const QUEST_POOL: DailyQuest[] = [
  { id: 'session_one', title: 'Faire 1 séance', description: 'Lance et termine une séance.', target: 1, progress: 0, completed: false },
  { id: 'answer_ten', title: 'Répondre à 10 questions', description: 'Réponds à 10 questions, même courtes.', target: 10, progress: 0, completed: false },
  { id: 'grammar_one', title: 'Grammaire : 1 question', description: 'Travaille un tag de grammaire.', target: 1, progress: 0, completed: false },
  { id: 'fractions_five', title: 'Fractions : 5 questions', description: 'Révise les fractions (maths).', target: 5, progress: 0, completed: false },
]

function pickDailyQuests(): DailyQuest[] {
  // Sélection simple : premières quêtes variées pour l’instant
  const base = [QUEST_POOL[0], QUEST_POOL[1]]
  const others = [QUEST_POOL[2], QUEST_POOL[3]]
  const extra = others[Math.floor(Math.random() * others.length)]
  return [...base, extra].map(q => ({ ...q }))
}

export async function ensureDailyState(uid: string): Promise<DailyState> {
  const today = todayKeyParis()
  const dailyRef = doc(db, 'users', uid, 'meta', 'daily')
  const snap = await getDoc(dailyRef)
  const data = snap.exists() ? (snap.data() as DailyState) : null
  if (!data || data.dateKey !== today) {
    const next: DailyState = {
      dateKey: today,
      quests: pickDailyQuests(),
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
}) {
  const { uid, sessionId, answeredCount, tagsUsed } = opts
  const dailyRef = doc(db, 'users', uid, 'meta', 'daily')
  const rewardsRef = doc(db, 'users', uid, 'meta', 'rewards')
  const evRef = doc(db, 'users', uid, 'rewardEvents', `daily_${sessionId}`)
  const today = todayKeyParis()

  // Ensure daily exists for today
  await ensureDailyState(uid)

  let awardedStickerId: string | null = null

  await runTransaction(db, async (tx) => {
    const [dailySnap, evSnap, rewardsSnap] = await Promise.all([
      tx.get(dailyRef),
      tx.get(evRef),
      tx.get(rewardsRef),
    ])
    if (evSnap.exists()) return
    const daily = dailySnap.exists() ? (dailySnap.data() as DailyState) : null
    if (!daily || daily.dateKey !== today) {
      // regen simple
      tx.set(dailyRef, { dateKey: today, quests: pickDailyQuests(), updatedAt: serverTimestamp() })
      return
    }

    const tags = tagsUsed || []
    const grammarCount = tags.filter(t => t.includes('grammaire') || t.includes('grammar')).length
    const fractionsCount = tags.filter(t => t.startsWith('math_fractions')).length

    let deltaXp = 0
    let anyCompleted = false
    const quests = daily.quests.map(q => {
      let add = 0
      if (q.id === 'session_one') add = 1
      if (q.id === 'answer_ten') add = answeredCount
      if (q.id === 'grammar_one') add = grammarCount > 0 ? 1 : 0
      if (q.id === 'fractions_five') add = fractionsCount
      const nextProgress = Math.min(q.target, (q.progress || 0) + add)
      const wasCompleted = q.completed
      const completed = nextProgress >= q.target
      if (completed && !wasCompleted) {
        anyCompleted = true
        // bonus : +15 XP (simple) si pas de sticker disponible
        deltaXp += 15
      }
      return { ...q, progress: nextProgress, completed }
    })

    // Optionnel : si une quête complétée et sticker commun dispo, on le donnera après la transaction.
    if (anyCompleted) {
      const rewardsData = rewardsSnap.exists() ? (rewardsSnap.data() as any) : {}
      const currentXp = rewardsData?.xp || 0
      const newXp = currentXp + deltaXp
      const lvlInfo = computeLevelFromXp(newXp)
      tx.set(rewardsRef, {
        xp: newXp,
        level: lvlInfo.level,
        badges: rewardsData?.badges || [],
        masteryByTag: rewardsData?.masteryByTag || {},
        collectibles: rewardsData?.collectibles || { owned: [], equippedAvatarId: undefined },
        updatedAt: serverTimestamp(),
      }, { merge: true })
      const commonOwned = new Set<string>(rewardsData?.collectibles?.owned || [])
      const commons = COLLECTIBLES.filter(c => c.rarity === 'common' && c.type === 'sticker' && !commonOwned.has(c.id))
      if (commons.length) {
        const picked = commons[Math.floor(Math.random() * commons.length)]
        awardedStickerId = picked.id
      }
    }

    tx.set(dailyRef, { dateKey: today, quests, updatedAt: serverTimestamp() }, { merge: true })
    tx.set(evRef, { sessionId, createdAt: serverTimestamp() })
  })

  if (awardedStickerId) {
    try {
      await unlockCollectible(uid, awardedStickerId, `daily_sticker_${sessionId}`)
    } catch (e) {
      console.error('unlockCollectible daily', e)
    }
  }
}
