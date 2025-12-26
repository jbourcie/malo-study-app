import { collection, doc, getDoc, getDocs, query, where, writeBatch, serverTimestamp, setDoc, increment } from 'firebase/firestore'
import { db } from '../firebase'
import type { Exercise, PackJSON, SubjectId, Theme } from '../types'
import { normalize } from '../utils/normalize'

export async function listSubjects() {
  const snap = await getDocs(collection(db, 'subjects'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
}

export async function listThemes(subjectId: SubjectId) {
  const q = query(collection(db, 'themes'), where('subjectId', '==', subjectId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Theme[]
}

export async function listExercises(themeId: string) {
  const q = query(collection(db, 'exercises'), where('themeId', '==', themeId))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data()) as Exercise[]
}

export async function importPack(pack: PackJSON) {
  const batch = writeBatch(db)

  for (const subj of pack.subjects) {
    batch.set(doc(db, 'subjects', subj.id), { title: subj.title }, { merge: true })

    for (const th of subj.themes) {
      batch.set(doc(db, 'themes', th.id), {
        subjectId: subj.id,
        title: th.title,
        grade: pack.grade,
      }, { merge: true })

      for (const ex of th.exercises) {
        const exDoc = doc(db, 'exercises', ex.id)
        // normalisation des réponses pour short_text / fill_blank
        const cleaned = { ...ex, themeId: th.id }
        if (cleaned.type === 'short_text' && Array.isArray(cleaned.expected)) {
          cleaned.expected = cleaned.expected.map((x: string) => normalize(x))
        }
        if (cleaned.type === 'fill_blank' && Array.isArray(cleaned.expected)) {
          cleaned.expected = cleaned.expected.map((x: string) => normalize(x))
        }
        batch.set(exDoc, cleaned, { merge: true })
      }
    }
  }

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

export async function saveAttemptAndRewards(args: {
  uid: string
  subjectId: SubjectId
  themeId: string
  score: number
  outOf: number
  durationSec: number
}) {
  const { uid, subjectId, themeId, score, outOf, durationSec } = args
  const now = new Date()
  const today = isoDate(now)

  // attempt
  const attemptRef = doc(collection(db, 'users', uid, 'attempts'))
  const statsRef = doc(db, 'users', uid, 'stats', 'main')
  const statsSnap = await getDoc(statsRef)
  const stats = statsSnap.exists() ? (statsSnap.data() as any) : await getOrInitStats(uid)

  // gamification simple
  const xpGain = score * 10
  const coinsGain = Math.max(1, Math.min(3, Math.round(score / Math.max(1, outOf) * 3)))

  let streakDays = stats.streakDays || 0
  const last = stats.lastDoneDate as string | null
  if (last === today) {
    // pas de changement
  } else {
    const yesterday = isoDate(new Date(now.getTime() - 24*3600*1000))
    streakDays = (last === yesterday) ? (streakDays + 1) : 1
  }

  // badges simples
  const badges = new Set<string>(stats.badges || [])
  if (streakDays >= 3) badges.add('3 jours d’affilée')
  if (streakDays >= 7) badges.add('7 jours d’affilée')
  if (score === outOf && outOf >= 10) badges.add('Zéro faute (10+)')

  const batch = writeBatch(db)
  batch.set(attemptRef, {
    createdAt: serverTimestamp(),
    date: today,
    subjectId, themeId, score, outOf, durationSec
  })
  batch.set(statsRef, {
    xp: increment(xpGain),
    coins: increment(coinsGain),
    streakDays,
    lastDoneDate: today,
    badges: Array.from(badges),
    updatedAt: serverTimestamp(),
  }, { merge: true })

  await batch.commit()

  return { xpGain, coinsGain, streakDays, badges: Array.from(badges) }
}
