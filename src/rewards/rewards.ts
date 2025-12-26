import type { Timestamp } from 'firebase/firestore'

export type UserRewards = {
  xp: number
  level: number
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
