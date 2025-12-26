import { collection, doc, getDoc, getDocs, query, where, writeBatch, serverTimestamp, setDoc, runTransaction } from 'firebase/firestore'
import { db } from '../firebase'
import type { Exercise, PackJSON, Reading, SubjectId, Theme } from '../types'
import type { TagMasteryBucket } from '../typesProgress'
import { normalize } from '../utils/normalize'

export type AttemptItemInput = {
  exerciseId: string
  difficulty: 1 | 2 | 3
  tags?: string[]
  correct: boolean
}

export async function listSubjects() {
  const snap = await getDocs(collection(db, 'subjects'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
}

export async function listThemes(subjectId: SubjectId, opts?: { uid?: string, includeHidden?: boolean, includeOverrides?: boolean }) {
  const { uid, includeHidden = false, includeOverrides = false } = opts || {}
  const q = query(collection(db, 'themes'), where('subjectId', '==', subjectId))
  const snap = await getDocs(q)
  const themes = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Theme[]

  let visibility = new Map<string, boolean>()
  if (uid) {
    try {
      const visSnap = await getDocs(collection(db, 'users', uid, 'visibilityThemes'))
      visibility = new Map(visSnap.docs.map(d => [d.id, !!d.data().visible]))
    } catch {
      visibility = new Map()
    }
  }

  const filtered = themes.filter(t => {
    const override = visibility.get(t.id)
    if (!includeHidden && (t as any).hidden) return false
    if (!includeHidden && override === false) return false
    return true
  })

  if (includeOverrides) {
    return filtered.map(t => ({ ...t, visibleOverride: visibility.get(t.id) }))
  }

  return filtered
}

export async function listExercises(themeId: string, opts?: { uid?: string, includeHidden?: boolean, includeOverrides?: boolean }) {
  const { uid, includeHidden = false, includeOverrides = false } = opts || {}
  const q = query(collection(db, 'exercises'), where('themeId', '==', themeId))
  const snap = await getDocs(q)
  const exercises = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Exercise[]

  let visibility = new Map<string, boolean>()
  if (uid) {
    try {
      const visSnap = await getDocs(collection(db, 'users', uid, 'visibilityExercises'))
      visibility = new Map(visSnap.docs.map(d => [d.id, !!d.data().visible]))
    } catch {
      visibility = new Map()
    }
  }

  const filtered = exercises.filter(ex => {
    const override = visibility.get(ex.id)
    if (!includeHidden && (ex as any).hidden) return false
    if (!includeHidden && override === false) return false
    return true
  })

  if (includeOverrides) {
    return filtered.map(ex => ({ ...ex, visibleOverride: visibility.get(ex.id) }))
  }

  return filtered
}

export async function listReadings(themeId: string) {
  const q = query(collection(db, 'readings'), where('themeId', '==', themeId))
  try {
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Reading[]
  } catch {
    return []
  }
}

export async function importPack(pack: PackJSON) {
  const batch = writeBatch(db)
  const readingsToWrite: Array<{ id: string, payload: any }> = []

  for (const subj of pack.subjects) {
    batch.set(doc(db, 'subjects', subj.id), { title: subj.title }, { merge: true })

    for (const th of subj.themes) {
      batch.set(doc(db, 'themes', th.id), {
        subjectId: subj.id,
        title: th.title,
        grade: pack.grade,
        readings: Array.isArray((th as any).readings) ? (th as any).readings : [],
      }, { merge: true })

      for (const ex of th.exercises) {
        const exDoc = doc(db, 'exercises', ex.id)
        // normalisation des réponses pour short_text / fill_blank
        const cleaned = { ...ex, themeId: th.id }
        cleaned.tags = Array.isArray(cleaned.tags) ? cleaned.tags.slice(0, 3) : []
        if (cleaned.type === 'short_text' && Array.isArray(cleaned.expected)) {
          cleaned.expected = cleaned.expected.map((x: string) => normalize(x))
        }
        if (cleaned.type === 'fill_blank' && Array.isArray(cleaned.expected)) {
          cleaned.expected = cleaned.expected.map((x: string) => normalize(x))
        }
        batch.set(exDoc, cleaned, { merge: true })
      }

      if (Array.isArray((th as any).readings)) {
        for (const rd of (th as any).readings as Reading[]) {
          if (!rd.id || !rd.title || !rd.text || !Array.isArray(rd.questions)) continue
          const readingPayload: Reading = {
            id: rd.id,
            title: rd.title,
            text: rd.text,
            difficulty: rd.difficulty as any,
            tags: Array.isArray(rd.tags) ? rd.tags.slice(0, 3) : [],
            questions: rd.questions.map((q) => ({
              ...q,
              type: 'mcq',
              themeId: th.id,
              tags: Array.isArray(q.tags) ? q.tags.slice(0, 3) : [],
            })),
          }
          readingsToWrite.push({ id: rd.id, payload: { ...readingPayload, themeId: th.id } })
        }
      }
    }
  }

  await batch.commit()

  // Attempt to write readings collection; ignore permission errors (readings still embedded in theme)
  if (readingsToWrite.length) {
    try {
      const batchReadings = writeBatch(db)
      readingsToWrite.forEach(r => {
        batchReadings.set(doc(db, 'readings', r.id), r.payload, { merge: true })
      })
      await batchReadings.commit()
    } catch {
      // ignore if insufficient permissions
    }
  }
}

export async function setThemeHidden(themeId: string, hidden: boolean) {
  await setDoc(doc(db, 'themes', themeId), { hidden }, { merge: true })
}

export async function setExerciseHidden(exerciseId: string, hidden: boolean) {
  await setDoc(doc(db, 'exercises', exerciseId), { hidden }, { merge: true })
}

export async function setThemeVisibilityForChild(uid: string, themeId: string, visible: boolean) {
  await setDoc(doc(db, 'users', uid, 'visibilityThemes', themeId), { visible }, { merge: true })
}

export async function setExerciseVisibilityForChild(uid: string, exerciseId: string, visible: boolean) {
  await setDoc(doc(db, 'users', uid, 'visibilityExercises', exerciseId), { visible }, { merge: true })
}

export async function deleteTheme(themeId: string) {
  // best-effort: delete theme doc and its exercises
  const batch = writeBatch(db)
  batch.delete(doc(db, 'themes', themeId))
  const exSnap = await getDocs(query(collection(db, 'exercises'), where('themeId', '==', themeId)))
  exSnap.docs.forEach(d => batch.delete(d.ref))
  const readSnap = await getDocs(query(collection(db, 'readings'), where('themeId', '==', themeId)))
  readSnap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
}

export async function getOrInitStats(uid: string) {
  const ref = doc(db, 'users', uid, 'stats', 'main')
  const snap = await getDoc(ref)
  if (snap.exists()) return snap.data() as any
  await setDoc(ref, {
    xp: 0,
    coins: 0,
    streakDays: 0,
    lastDoneDate: null,
    badges: [],
    updatedAt: serverTimestamp(),
  })
  const snap2 = await getDoc(ref)
  return snap2.data() as any
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
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

export async function saveAttemptAndRewards(args: {
  uid: string
  subjectId: SubjectId
  themeId: string
  items: AttemptItemInput[]
  durationSec: number
  existingAttemptId?: string
  skipAttemptWrite?: boolean
}) {
  const { uid, subjectId, themeId, items, durationSec, existingAttemptId, skipAttemptWrite } = args
  const now = new Date()
  const today = isoDate(now)
  const outOf = items.length
  const score = items.filter(i => i.correct).length

  if (outOf === 0) {
    return { xpGain: 0, coinsGain: 0, streakDays: 0, badges: [], score: 0, outOf: 0 }
  }

  const tagImpacts = new Map<string, { delta: number, correct: number, wrong: number }>()
  items.forEach(item => {
    const tags = Array.isArray(item.tags) ? item.tags.slice(0, 3) : []
    const delta = masteryDelta(item.difficulty, item.correct)
    tags.forEach(tag => {
      const current = tagImpacts.get(tag) || { delta: 0, correct: 0, wrong: 0 }
      tagImpacts.set(tag, {
        delta: current.delta + delta,
        correct: current.correct + (item.correct ? 1 : 0),
        wrong: current.wrong + (item.correct ? 0 : 1)
      })
    })
  })

  const xpGain = score * 10
  const coinsGain = Math.max(1, Math.min(3, Math.round(score / Math.max(1, outOf) * 3)))

  let rewards: { xpGain: number, coinsGain: number, streakDays: number, badges: string[] } | null = null

  const attemptRef = existingAttemptId
    ? doc(db, 'users', uid, 'attempts', existingAttemptId)
    : doc(collection(db, 'users', uid, 'attempts'))
  const itemRefs = items.map(() => doc(collection(attemptRef, 'items')))

  await runTransaction(db, async (tx) => {
    const statsRef = doc(db, 'users', uid, 'stats', 'main')
    const summaryRef = doc(db, 'users', uid, 'progressSummary', 'main')
    const tagRefs = Array.from(tagImpacts.keys()).map(tagId => doc(db, 'users', uid, 'tagProgress', tagId))

    // Reads must precede writes in a transaction
    const [statsSnap, summarySnap, tagSnaps] = await Promise.all([
      tx.get(statsRef),
      tx.get(summaryRef),
      Promise.all(tagRefs.map(ref => tx.get(ref))),
    ])

    const stats = statsSnap.exists()
      ? (statsSnap.data() as any)
      : { xp: 0, coins: 0, streakDays: 0, lastDoneDate: null, badges: [] as string[] }

    let streakDays = stats.streakDays || 0
    const last = stats.lastDoneDate as string | null
    if (last === today) {
      // pas de changement
    } else {
      const yesterday = isoDate(new Date(now.getTime() - 24*3600*1000))
      streakDays = (last === yesterday) ? (streakDays + 1) : 1
    }

    const badges = new Set<string>(Array.isArray(stats.badges) ? stats.badges : [])
    if (streakDays >= 3) badges.add('3 jours d’affilée')
    if (streakDays >= 7) badges.add('7 jours d’affilée')
    if (score === outOf && outOf >= 10) badges.add('Zéro faute (10+)')

    const summary = summarySnap.exists()
      ? (summarySnap.data() as any)
      : null
    const bucketCounters: Record<TagMasteryBucket, number> = {
      weak: 0,
      developing: 0,
      nearly: 0,
      mastered: 0,
    }

    for (let i = 0; i < tagRefs.length; i++) {
      const tagRef = tagRefs[i]
      const tagSnap = tagSnaps[i]
      const tagId = tagRef.id
      const impact = tagImpacts.get(tagId)!
      const tagData = tagSnap.exists() ? (tagSnap.data() as any) : null
      const previousMastery = typeof tagData?.mastery === 'number' ? tagData.mastery : 0
      const previousBucket = tagData?.bucket as TagMasteryBucket | undefined
      const newMastery = clampMastery(previousMastery + impact.delta)
      const bucket = masteryBucket(newMastery)

      if (previousBucket && summary) bucketCounters[previousBucket] -= 1
      bucketCounters[bucket] += 1

      tx.set(tagRef, {
        mastery: newMastery,
        bucket,
        correctAnswers: (tagData?.correctAnswers || 0) + impact.correct,
        wrongAnswers: (tagData?.wrongAnswers || 0) + impact.wrong,
        lastDelta: impact.delta,
        updatedAt: serverTimestamp(),
      }, { merge: true })
    }

    const prevBuckets = summary?.masteryBuckets || {
      weak: 0,
      developing: 0,
      nearly: 0,
      mastered: 0,
    }

    // Writes
    if (!skipAttemptWrite) {
      tx.set(attemptRef, {
        createdAt: serverTimestamp(),
        date: today,
        subjectId,
        themeId,
        score,
        outOf,
        durationSec,
        itemsCount: items.length,
      })

      items.forEach((item, idx) => {
        const tags = Array.isArray(item.tags) ? item.tags.slice(0, 3) : []
        tx.set(itemRefs[idx], {
          createdAt: serverTimestamp(),
          index: idx,
          exerciseId: item.exerciseId,
          subjectId,
          themeId,
          correct: item.correct,
          difficulty: item.difficulty,
          tags,
        })
      })
    }

    tx.set(statsRef, {
      xp: (stats.xp || 0) + xpGain,
      coins: (stats.coins || 0) + coinsGain,
      streakDays,
      lastDoneDate: today,
      badges: Array.from(badges),
      updatedAt: serverTimestamp(),
    }, { merge: true })

    tx.set(summaryRef, {
      totalAnswers: (summary?.totalAnswers || 0) + outOf,
      correctAnswers: (summary?.correctAnswers || 0) + score,
      totalAttempts: (summary?.totalAttempts || 0) + 1,
      masteryBuckets: {
        weak: (prevBuckets.weak || 0) + bucketCounters.weak,
        developing: (prevBuckets.developing || 0) + bucketCounters.developing,
        nearly: (prevBuckets.nearly || 0) + bucketCounters.nearly,
        mastered: (prevBuckets.mastered || 0) + bucketCounters.mastered,
      },
      lastAttemptId: attemptRef.id,
      lastDate: today,
      updatedAt: serverTimestamp(),
    }, { merge: true })

    rewards = { xpGain, coinsGain, streakDays, badges: Array.from(badges) }
  })

  return { ...(rewards || { xpGain: 0, coinsGain: 0, streakDays: 0, badges: [] }), score, outOf }
}
