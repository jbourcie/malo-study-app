import { collection, doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import type { Exercise, ExerciseFillBlank, ExerciseMCQ, ExerciseShortText, SubjectId } from '../types'
import { normalize } from '../utils/normalize'
import type { Attempt, AttemptItem, ProgressSummary, TagMasteryBucket, TagProgress } from '../typesProgress'

type SaveSessionArgs = {
  uid: string
  subjectId: SubjectId
  themeId: string
  answers: Record<string, any>
  exercises: Exercise[]
  durationSec: number
}

function isCorrect(ex: Exercise, ans: any): boolean {
  if (ex.type === 'mcq') return ans === (ex as ExerciseMCQ).answerIndex
  if (ex.type === 'short_text') return (ex as ExerciseShortText).expected.includes(normalize(ans || ''))
  if (ex.type === 'fill_blank') return (ex as ExerciseFillBlank).expected.includes(normalize(ans || ''))
  return false
}

function masteryDelta(difficulty: 1 | 2 | 3, correct: boolean) {
  if (difficulty === 1) return correct ? 3 : -1
  if (difficulty === 2) return correct ? 5 : -2
  return correct ? 7 : -3
}

function clampMastery(v: number) {
  return Math.max(0, Math.min(100, v))
}

function masteryBucket(mastery: number): TagMasteryBucket {
  if (mastery >= 80) return 'mastered'
  if (mastery >= 60) return 'nearly'
  if (mastery >= 30) return 'developing'
  return 'weak'
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function addDays(date: string, days: number) {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

function computeNextDueDate(mastery: number, bucket: TagMasteryBucket, fromDate: string) {
  const clamped = Math.max(0, Math.min(100, mastery))
  let days = 1
  if (clamped >= 81 || bucket === 'mastered') days = 10
  else if (clamped >= 61 || bucket === 'nearly') days = 4
  else if (clamped >= 31 || bucket === 'developing') days = 2
  else days = 1
  return addDays(fromDate, days)
}

export async function saveSessionWithProgress(args: SaveSessionArgs) {
  const { uid, subjectId, themeId, answers, exercises, durationSec } = args
  const now = new Date()
  const today = isoDate(now)

  const attemptRef = doc(collection(db, 'users', uid, 'attempts'))
  const itemsRef = collection(db, 'users', uid, 'attemptItems')
  const summaryRef = doc(db, 'users', uid, 'progressSummary', 'main')

  const attemptItems: AttemptItem[] = exercises.map((ex, idx) => {
    const correct = isCorrect(ex, answers[ex.id])
    return {
      exerciseId: ex.id,
      subjectId,
      themeId,
      difficulty: ex.difficulty,
      tags: ex.tags?.slice(0, 3) || [],
      correct,
      index: idx,
      prompt: (ex as any).prompt,
      choices: Array.isArray((ex as any).choices) ? (ex as any).choices : null,
      readingContext: (ex as any).readingContext || null,
    }
  })

  const score = attemptItems.filter(i => i.correct).length
  const outOf = attemptItems.length

  const tagAggregates = new Map<string, {
    delta: number
    correct: number
    wrong: number
    results: boolean[]
  }>()

  attemptItems.forEach(item => {
    const delta = masteryDelta(item.difficulty, item.correct)
    item.tags.forEach(tag => {
      const agg = tagAggregates.get(tag) || { delta: 0, correct: 0, wrong: 0, results: [] as boolean[] }
      agg.delta += delta
      agg.correct += item.correct ? 1 : 0
      agg.wrong += item.correct ? 0 : 1
      agg.results.push(item.correct)
      tagAggregates.set(tag, agg)
    })
  })

  const tagIds = Array.from(tagAggregates.keys())
  const tagSnaps = await Promise.all(tagIds.map(id => getDoc(doc(db, 'users', uid, 'tagProgress', id))))

  const batch = writeBatch(db)

  // Attempt
  const attemptDoc: Attempt = {
    subjectId,
    themeId,
    score,
    outOf,
    durationSec,
    itemsCount: attemptItems.length,
    date: today,
    createdAt: serverTimestamp(),
  }
  batch.set(attemptRef, attemptDoc)

  attemptItems.forEach(item => {
    const itemRef = doc(itemsRef)
    batch.set(itemRef, {
      ...item,
      createdAt: serverTimestamp(),
      answer: answers[item.exerciseId] ?? null,
    })
  })

  const bucketDelta = {
    weak: 0,
    developing: 0,
    nearly: 0,
    mastered: 0,
  }

  const updatedTagStates: Record<string, TagProgress> = {}

  tagIds.forEach((tagId, idx) => {
    const snap = tagSnaps[idx]
    const prev = snap.exists() ? (snap.data() as TagProgress) : null
    const agg = tagAggregates.get(tagId)!

    const prevResults = Array.isArray(prev?.last7Results) ? prev!.last7Results! : []
    const newResults = [...prevResults, ...agg.results].slice(-7)
    const last7 = {
      correct: newResults.filter(x => x).length,
      wrong: newResults.filter(x => !x).length,
    }

    let streakCorrect = prev?.streakCorrect || 0
    let streakWrong = prev?.streakWrong || 0
    agg.results.forEach(r => {
      if (r) {
        streakCorrect += 1
        streakWrong = 0
      } else {
        streakWrong += 1
        streakCorrect = 0
      }
    })

    const prevMastery = typeof prev?.mastery === 'number' ? prev.mastery : 0
    const newMastery = clampMastery(prevMastery + agg.delta)
    const bucket = masteryBucket(newMastery)
    const prevBucket = prev?.bucket

    if (prevBucket) bucketDelta[prevBucket] -= 1
    bucketDelta[bucket] += 1

    const nextDueDate = computeNextDueDate(newMastery, bucket, today)

    const tagRef = doc(db, 'users', uid, 'tagProgress', tagId)
    const updated: TagProgress = {
      tagId,
      mastery: newMastery,
      bucket,
      attempts: (prev?.attempts || 0) + agg.results.length,
      correctAnswers: (prev?.correctAnswers || 0) + agg.correct,
      wrongAnswers: (prev?.wrongAnswers || 0) + agg.wrong,
      last7Results: newResults,
      last7,
      lastSeenAt: serverTimestamp(),
      lastCorrectAt: agg.correct > 0 ? serverTimestamp() : (prev?.lastCorrectAt || null),
      streakCorrect,
      streakWrong,
      lastDelta: agg.delta,
      nextDueDate,
      updatedAt: serverTimestamp(),
    }

    updatedTagStates[tagId] = updated
    batch.set(tagRef, updated, { merge: true })
  })

  const summarySnap = await getDoc(summaryRef)
  const summary = summarySnap.exists() ? (summarySnap.data() as ProgressSummary & { topWeakTags?: string[] }) : null

  const prevBuckets = summary?.masteryBuckets || { weak: 0, developing: 0, nearly: 0, mastered: 0 }
  const masteryBuckets = {
    weak: (prevBuckets.weak || 0) + bucketDelta.weak,
    developing: (prevBuckets.developing || 0) + bucketDelta.developing,
    nearly: (prevBuckets.nearly || 0) + bucketDelta.nearly,
    mastered: (prevBuckets.mastered || 0) + bucketDelta.mastered,
  }

  const touchedWeak = Object.values(updatedTagStates)
    .sort((a, b) => a.mastery - b.mastery)
    .map(t => t.tagId!)
  const existingWeak = Array.isArray((summary as any)?.topWeakTags) ? (summary as any).topWeakTags as string[] : []
  const topWeakTags = Array.from(new Set([...touchedWeak, ...existingWeak])).slice(0, 3)

  const summaryUpdate: ProgressSummary & { topWeakTags: string[] } = {
    totalAnswers: (summary?.totalAnswers || 0) + outOf,
    correctAnswers: (summary?.correctAnswers || 0) + score,
    totalAttempts: (summary?.totalAttempts || 0) + 1,
    masteryBuckets,
    lastAttemptId: attemptRef.id,
    lastDate: today,
    updatedAt: serverTimestamp(),
    topWeakTags,
  }
  batch.set(summaryRef, summaryUpdate, { merge: true })

  await batch.commit()

  return {
    attemptId: attemptRef.id,
    score,
    outOf,
    summary: summaryUpdate,
    tagsUpdated: updatedTagStates,
  }
}
