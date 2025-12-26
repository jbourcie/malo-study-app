import type { Timestamp } from 'firebase/firestore'
import type { SubjectId } from './types'

export type TagMasteryBucket = 'weak' | 'developing' | 'nearly' | 'mastered'

export interface AttemptItem {
  id?: string
  exerciseId: string
  subjectId: SubjectId
  themeId: string
  difficulty: 1 | 2 | 3
  tags: string[]
  correct: boolean
  index?: number
  createdAt?: Timestamp
}

export interface Attempt {
  id?: string
  uid?: string
  subjectId: SubjectId
  themeId: string
  score: number
  outOf: number
  durationSec: number
  itemsCount?: number
  date: string
  createdAt?: Timestamp
  items?: AttemptItem[]
}

export interface TagProgress {
  tagId?: string
  mastery: number // 0..100
  bucket: TagMasteryBucket
  attempts: number
  correctAnswers: number
  wrongAnswers: number
  last7Results?: boolean[] // fenêtre glissante max 7
  last7?: {
    correct: number
    wrong: number
  }
  lastSeenAt?: Timestamp
  lastCorrectAt?: Timestamp | null
  streakCorrect: number
  streakWrong: number
  lastDelta?: number
  nextDueDate?: string | null
  updatedAt?: Timestamp
}

export interface ProgressSummary {
  totalAnswers: number
  correctAnswers: number
  totalAttempts: number
  masteryBuckets: Record<TagMasteryBucket, number>
  lastAttemptId?: string
  lastDate?: string
  updatedAt?: Timestamp
}
