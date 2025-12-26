import type { Timestamp } from 'firebase/firestore'

export type MasteryState = 'discovering' | 'progressing' | 'mastered'

export type UserRewards = {
  xp: number
  level: number
  badges?: string[]
  masteryByTag?: Record<string, { state: MasteryState, score: number, updatedAt?: Timestamp }>
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

export function computeSessionXp(args: { answeredCount: number, isCompleted: boolean }): number {
  const answered = Math.max(0, args.answeredCount)
  const base = answered * 2
  const completion = args.isCompleted ? 10 : 0
  return base + completion
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
