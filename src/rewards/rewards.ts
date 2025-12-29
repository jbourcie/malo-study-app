import type { Timestamp } from 'firebase/firestore'

export type MasteryState = 'discovering' | 'progressing' | 'mastered'

export type UserRewards = {
  xp: number
  level: number
  badges?: string[]
  masteryByTag?: Record<string, { state: MasteryState, score: number, updatedAt?: Timestamp }>
  blockProgress?: Record<string, {
    state: MasteryState
    score: number
    attempts?: number
    correct?: number
    successRate?: number
    updatedAt?: Timestamp
  }>
  collectibles?: {
    owned: string[]
    equippedAvatarId?: string
  }
  malocraft?: {
    ownedLootIds: string[]
    equippedAvatarId?: string
    biomeMilestones?: Record<string, number>
  }
  zoneRebuildProgress?: Record<string, {
    correctCount: number
    target: number
    updatedAt?: Timestamp
    rebuiltAt?: Timestamp
  }>
  biomeRebuildProgress?: Record<string, {
    correctCount: number
    target: number
    updatedAt?: Timestamp
    rebuiltAt?: Timestamp
  }>
  updatedAt?: Timestamp
}

export function xpToNextLevel(level: number): number {
  const lvl = Math.max(1, Math.floor(level))
  return 100 + (lvl - 1) * 50
}

export function computeLevelFromXp(xp: number): { level: number, xpIntoLevel: number, xpForNext: number } {
  let remaining = Math.max(0, Math.floor(xp))
  let level = 1
  while (true) {
    const need = xpToNextLevel(level)
    if (remaining < need) {
      return { level, xpIntoLevel: remaining, xpForNext: need }
    }
    remaining -= need
    level += 1
  }
}

export type SessionXpBreakdown = {
  base: number
  completion: number
  streakBonus: number
  comebackBonus: number
}

const XP_RULES = {
  // Toggle bonuses quickly by flipping the enable* flags or zeroing basePerCorrect.
  basePerCorrect: 4,
  fallbackPerAnswer: 2,
  completionBonus: 10,
  streakBonusPerExtra: 1, // points when a streak >=3 continues
  comebackBonus: 2, // small boost after an error + explanation
  enableStreakBonus: true,
  enableComebackBonus: true,
}

export function computeSessionXp(args: {
  answeredCount: number
  correctCount?: number
  streaks?: number[]
  comebackCount?: number
  isCompleted: boolean
}): { total: number, breakdown: SessionXpBreakdown } {
  // completion bonus appliqué uniquement si la session est déclarée complète par l'appelant (toutes les questions répondues)
  const answered = Math.max(0, args.answeredCount)
  const correct = typeof args.correctCount === 'number'
    ? Math.max(0, Math.min(answered, args.correctCount))
    : null

  const base = XP_RULES.basePerCorrect && correct !== null
    ? correct * XP_RULES.basePerCorrect
    : answered * XP_RULES.fallbackPerAnswer

  const completion = args.isCompleted ? XP_RULES.completionBonus : 0

  let streakBonus = 0
  if (XP_RULES.enableStreakBonus && Array.isArray(args.streaks)) {
    args.streaks.forEach((len) => {
      if (len >= 3) {
        streakBonus += (len - 2) * XP_RULES.streakBonusPerExtra
      }
    })
  }

  const comebackBonus = XP_RULES.enableComebackBonus
    ? Math.max(0, args.comebackCount || 0) * XP_RULES.comebackBonus
    : 0

  const total = Math.max(0, Math.round(base + completion + streakBonus + comebackBonus))
  return { total, breakdown: { base, completion, streakBonus, comebackBonus } }
}

function masteryStateFromScore(score: number): MasteryState {
  if (score >= 70) return 'mastered'
  if (score >= 30) return 'progressing'
  return 'discovering'
}

export function updateMasteryFromAttempt(opts: {
  masteryByTag: UserRewards['masteryByTag'] | undefined
  questionTags: string[]
  isCorrect: boolean
  timestamp: Timestamp
}) {
  const map = { ...(opts.masteryByTag || {}) }
  const delta = opts.isCorrect ? 8 : 2
  opts.questionTags.forEach(tag => {
    const prev = map[tag]?.score || 0
    const score = Math.max(0, Math.min(100, prev + delta))
    map[tag] = {
      score,
      state: masteryStateFromScore(score),
      updatedAt: opts.timestamp,
    }
  })
  return map
}
