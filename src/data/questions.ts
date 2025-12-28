import { arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { validateQuestionPack, type PackMetaV1, type QualityStatus, type QuestionPackV1, type QuestionV1 } from '../domain/questions/types'
import type { Exercise, ExerciseFillBlank, ExerciseMCQ, ExerciseShortText } from '../types'

export type ModerationFilters = {
  status?: QualityStatus
  primaryTag?: string
  blockId?: string
  difficulty?: number
  text?: string
  setId?: string
  includeDeleted?: boolean
}

export async function importQuestionPackClient(pack: QuestionPackV1, opts?: { dryRun?: boolean }) {
  const validation = validateQuestionPack(pack)
  if (!validation.ok) return validation
  if (opts?.dryRun) return { ok: true, errors: [] }

  const batch = writeBatch(db)
  const nowIso = new Date().toISOString()
  const packRef = doc(db, 'questionPacks', pack.pack.setId)
  const packPayload: PackMetaV1 & { totalQuestions: number, updatedAt: any, createdAt: any } = {
    ...pack.pack,
    totalQuestions: Array.isArray(pack.questions) ? pack.questions.length : 0,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }
  batch.set(packRef, packPayload, { merge: true })

  pack.questions.forEach((q) => {
    const history = Array.isArray(q.quality?.history) ? q.quality.history : []
    const questionRef = doc(db, 'questions', q.id)
    const payload: QuestionV1 & { setId: string, createdAt: any, updatedAt: any } = {
      ...q,
      setId: pack.pack.setId,
      quality: {
        ...q.quality,
        status: 'draft',
        history: [
          ...history,
          { at: nowIso, by: 'import', action: 'created', status: 'draft', details: `pack:${pack.pack.setId}` },
        ],
        review: q.quality?.review || { reviewedAt: null, reviewedBy: null, decision: null, notes: null },
        deletedAt: null,
        deletedBy: null,
      },
      createdAt: q.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    batch.set(questionRef, payload, { merge: true })
  })

  await batch.commit()
  return { ok: true, errors: [] }
}

export async function listQuestionPacksMeta() {
  const snap = await getDocs(collection(db, 'questionPacks'))
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Array<PackMetaV1 & { id: string }>
}

export async function fetchQuestionsForModeration(filters: ModerationFilters & { includeDeleted?: boolean } ): Promise<QuestionV1[]> {
  const clauses = []
  if (filters.status) clauses.push(where('quality.status', '==', filters.status))
  if (filters.primaryTag) clauses.push(where('primaryTag', '==', filters.primaryTag))
  if (filters.blockId) clauses.push(where('blockId', '==', filters.blockId))
  if (filters.setId) clauses.push(where('setId', '==', filters.setId))
  let q = query(collection(db, 'questions'), ...clauses, orderBy('updatedAt', 'desc'), limit(200))
  const snap = await getDocs(q)
  let res = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as QuestionV1[]

  if (!filters.includeDeleted) {
    res = res.filter(r => !r.quality?.deletedAt)
  }
  if (filters.difficulty) {
    res = res.filter(r => Number(r.difficulty) === Number(filters.difficulty))
  }
  if (filters.text) {
    const needle = filters.text.toLowerCase()
    res = res.filter(r => (r.statement || '').toLowerCase().includes(needle) || (r.answer || '').toLowerCase().includes(needle))
  }
  return res
}

export async function fetchPublishedQuestionsByTag(tagId: string, opts?: { difficulty?: number, limitTo?: number }) {
  const clauses = [
    where('quality.status', '==', 'published'),
    where('primaryTag', '==', tagId),
  ]
  if (opts?.difficulty) clauses.push(where('difficulty', '==', opts.difficulty))
  const q = query(collection(db, 'questions'), ...clauses, limit(opts?.limitTo || 200))
  const snap = await getDocs(q)
  const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as QuestionV1[]
  const filtered = rows.filter(r => !r.quality?.deletedAt)
  if (tagId === 'fr_comprehension_connecteurs_logiques') {
    // Debug: suivi des questions publiées pour ce tag après import
    // eslint-disable-next-line no-console
    console.info('[questions.fetchPublishedQuestionsByTag] connecteurs_logiques', {
      requestedLimit: opts?.limitTo || 200,
      docsFetched: rows.length,
      filteredCount: filtered.length,
      ids: filtered.map(q => q.id),
    })
  }
  return filtered
}

export function mapQuestionToExercise(q: QuestionV1): Exercise {
  const difficulty = Math.min(3, Math.max(1, Math.round(Number(q.difficulty) || 1))) as Exercise['difficulty']
  const tags = [q.primaryTag, ...(Array.isArray(q.secondaryTags) ? q.secondaryTags : [])].slice(0, 3)
  if (q.type === 'MCQ' || q.type === 'TRUE_FALSE') {
    const choices = q.type === 'TRUE_FALSE'
      ? ['Vrai', 'Faux']
      : (Array.isArray(q.choices) ? q.choices : [])
    const answerValue = q.type === 'TRUE_FALSE'
      ? (String(q.answer) === 'true' ? 'Vrai' : 'Faux')
      : q.answer
    let answerIndex = Math.max(0, choices.findIndex(c => c === answerValue))
    if (answerIndex === -1) answerIndex = 0
    const mcq: ExerciseMCQ = {
      id: q.id,
      themeId: q.blockId || q.primaryTag,
      type: 'mcq',
      prompt: q.statement,
      choices,
      answerIndex,
      difficulty,
      tags,
    }
    return mcq
  }
  if (q.type === 'FILL_BLANK') {
    const fb: ExerciseFillBlank = {
      id: q.id,
      themeId: q.blockId || q.primaryTag,
      type: 'fill_blank',
      prompt: q.statement,
      text: q.statement,
      expected: [String(q.answer || '')],
      difficulty,
      tags,
    }
    return fb
  }
  const short: ExerciseShortText = {
    id: q.id,
    themeId: q.blockId || q.primaryTag,
    type: 'short_text',
    prompt: q.statement,
    expected: [String(q.answer || '')],
    difficulty,
    tags,
  }
  return short
}

export async function fetchExercisesForPlay(tagId: string, opts?: { limitTo?: number, includeLessons?: boolean }) {
  const questions = await fetchPublishedQuestionsByTag(tagId, { limitTo: opts?.limitTo })
  let packMetaBySetId: Record<string, PackMetaV1 | null> = {}
  if (opts?.includeLessons) {
    const setIds = Array.from(new Set(questions.map(q => q.setId).filter(Boolean) as string[]))
    const entries = await Promise.all(setIds.map(async (setId) => {
      try {
        const snap = await getDoc(doc(db, 'questionPacks', setId))
        return [setId, snap.exists() ? (snap.data() as PackMetaV1) : null] as const
      } catch {
        return [setId, null] as const
      }
    }))
    packMetaBySetId = Object.fromEntries(entries)
  }
  return questions.map((q) => {
    const ex = mapQuestionToExercise(q) as Exercise & {
      setId?: string
      lessonRef?: string | null
      packLesson?: string
      packLessonTitle?: string
    }
    ex.setId = q.setId
    ex.lessonRef = q.lessonRef || null
    if (opts?.includeLessons && q.setId) {
      const pack = packMetaBySetId[q.setId]
      ex.packLesson = pack?.lesson
      ex.packLessonTitle = pack?.lessonTitle
    }
    return ex
  })
  if (tagId === 'fr_comprehension_connecteurs_logiques') {
    // eslint-disable-next-line no-console
    console.info('[questions.fetchExercisesForPlay] connecteurs_logiques', {
      totalQuestions: questions.length,
      exercisesCount: mapped.length,
      setIds: Array.from(new Set(questions.map(q => q.setId))),
    })
  }
  return mapped
}

export async function softDeleteQuestion(questionId: string, opts?: { by?: string, notes?: string }) {
  const ref = doc(db, 'questions', questionId)
  const nowIso = new Date().toISOString()
  const historyEntry: any = {
    at: nowIso,
    by: opts?.by || 'moderator',
    action: 'deleted',
    status: 'archived',
  }
  if (opts?.notes) historyEntry.notes = opts.notes
  await updateDoc(ref, {
    'quality.deletedAt': serverTimestamp(),
    'quality.deletedBy': opts?.by || null,
    'quality.status': 'archived',
    'quality.history': arrayUnion(historyEntry),
    updatedAt: serverTimestamp(),
  })
}

export async function updateQuestionContent(questionId: string, updates: Partial<QuestionV1> & { updatedBy?: string, note?: string }) {
  const ref = doc(db, 'questions', questionId)
  const patch: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  }
  const editable: Array<keyof QuestionV1> = ['statement', 'choices', 'answer', 'explanation', 'commonMistake', 'difficulty', 'secondaryTags', 'metaTags', 'primaryTag', 'blockId']
  editable.forEach((key) => {
    if (updates[key] !== undefined) {
      patch[key] = updates[key] as any
    }
  })
  if (updates.updatedBy) {
    patch['quality.lastEditedBy'] = updates.updatedBy
  }
  const historyEntry = {
    at: new Date().toISOString(),
    by: updates.updatedBy || 'moderator',
    action: 'updated',
    notes: updates.note || undefined,
  }
  await updateDoc(ref, {
    ...patch,
    'quality.history': arrayUnion(historyEntry),
  })
}

export async function setQuestionStatus(questionId: string, status: QualityStatus, opts?: { reviewerId?: string, notes?: string, decision?: 'approved' | 'rejected' | null }) {
  const ref = doc(db, 'questions', questionId)
  if (status === 'published') {
    const snap = await getDoc(ref)
    if (snap.exists()) {
      const data = snap.data() as QuestionV1
      const explanation = data.explanation || ''
      if (!explanation || explanation.trim().length < 20) {
        throw new Error('Explication obligatoire (>= 20 caractères) pour publier.')
      }
    }
  }
  const historyEntry: any = {
    at: new Date().toISOString(),
    by: opts?.reviewerId || 'moderator',
    action: status as any,
    status,
  }
  if (opts?.notes) historyEntry.notes = opts.notes
  const review = {
    reviewedBy: opts?.reviewerId || null,
    reviewedAt: serverTimestamp(),
    decision: opts?.decision ?? (status === 'published' ? 'approved' : status === 'rejected' ? 'rejected' : null),
    notes: opts?.notes ?? null,
  }
  await updateDoc(ref, {
    'quality.status': status,
    'quality.review': review,
    'quality.history': arrayUnion(historyEntry),
    updatedAt: serverTimestamp(),
  })
}

export async function archiveQuestion(questionId: string, opts?: { by?: string, notes?: string }) {
  await setQuestionStatus(questionId, 'archived', { reviewerId: opts?.by, notes: opts?.notes })
}

export async function deleteQuestion(questionId: string) {
  await deleteDoc(doc(db, 'questions', questionId))
}
