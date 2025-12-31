import { collection, collectionGroup, doc, getCountFromServer, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where, type QueryConstraint } from 'firebase/firestore'
import { db } from '../firebase'

export type ReportReason = 'wrong_answer' | 'ambiguous' | 'typo' | 'too_hard' | 'off_topic' | 'other'
export type QuestionReportStatus = 'open' | 'triaged' | 'resolved'

export type QuestionReportContext = {
  setId?: string
  primaryTag?: string
  blockId?: string
  sessionId?: string
  grade?: string
}

export type QuestionReport = {
  id: string
  questionId: string
  uid: string
  createdAt?: any
  reason: ReportReason
  message?: string
  context?: QuestionReportContext
  status: QuestionReportStatus
  admin?: {
    notes?: string
    resolvedBy?: string | null
    resolvedAt?: any
  }
}

const ALLOWED_REASONS: ReportReason[] = ['wrong_answer', 'ambiguous', 'typo', 'too_hard', 'off_topic', 'other']
const MAX_MESSAGE = 240

export function buildReportId(questionId: string, uid: string) {
  return `${questionId}_${uid}`
}

export function validateReportPayload(reason: ReportReason, message?: string) {
  if (!ALLOWED_REASONS.includes(reason)) {
    throw new Error('Raison invalide.')
  }
  const trimmed = (message ?? '').toString().trim()
  if (trimmed.length > MAX_MESSAGE) {
    throw new Error('Le message doit faire moins de 240 caractères.')
  }
  return { reason, message: trimmed || undefined }
}

function sanitizeContext(ctx?: QuestionReportContext | null): QuestionReportContext {
  const cleaned: QuestionReportContext = {}
  if (!ctx) return cleaned
  if (ctx.setId) cleaned.setId = ctx.setId
  if (ctx.primaryTag) cleaned.primaryTag = ctx.primaryTag
  if (ctx.blockId) cleaned.blockId = ctx.blockId
  if (ctx.sessionId) cleaned.sessionId = ctx.sessionId
  if (ctx.grade) cleaned.grade = ctx.grade
  return cleaned
}

export async function createQuestionReport(params: {
  questionId: string
  uid: string
  reason: ReportReason
  message?: string
  context?: QuestionReportContext
}) {
  const { questionId, uid, reason, message, context } = params
  const reportId = buildReportId(questionId, uid)
  const validated = validateReportPayload(reason, message)
  const ref = doc(db, 'questionReports', reportId)

  try {
    const contextPayload = sanitizeContext(context)
    const payload: any = {
      questionId,
      uid,
      createdAt: serverTimestamp(),
      reason: validated.reason,
      context: contextPayload,
      status: 'open',
      admin: {
        notes: null,
        resolvedBy: null,
        resolvedAt: null,
      },
    }
    if (validated.message !== undefined) payload.message = validated.message
    await setDoc(ref, payload)
    return { created: true, alreadyExists: false, id: reportId }
  } catch (e: any) {
    // setDoc will be treated as update if the doc already exists; update is denied by rules -> permission-denied
    if (e?.code === 'already-exists' || e?.code === 'permission-denied') {
      return { created: false, alreadyExists: true, id: reportId }
    }
    throw e
  }
}

export async function listQuestionReports(opts?: {
  limitTo?: number
  status?: QuestionReportStatus
  reason?: ReportReason
  primaryTag?: string
  blockId?: string
  sinceDays?: number
  questionId?: string
}) {
  const q = query(
    collection(db, 'questionReports'),
    orderBy('createdAt', 'desc'),
    limit(opts?.limitTo || 400),
  )
  const snap = await getDocs(q)
  const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as QuestionReport[]
  const since = opts?.sinceDays ? Date.now() - opts.sinceDays * 24 * 60 * 60 * 1000 : null
  return rows.filter(r => {
    if (opts?.status && r.status !== opts.status) return false
    if (opts?.reason && r.reason !== opts.reason) return false
    if (opts?.questionId && r.questionId !== opts.questionId) return false
    if (opts?.primaryTag && r.context?.primaryTag !== opts.primaryTag) return false
    if (opts?.blockId && r.context?.blockId !== opts.blockId) return false
    if (since && r.createdAt?.toDate) {
      if (r.createdAt.toDate().getTime() < since) return false
    }
    return true
  })
}

export function groupTopReportedQuestions(reports: QuestionReport[], topN = 20) {
  const grouped = new Map<string, { count: number, latest?: number, sample?: QuestionReport }>()
  reports.forEach((r) => {
    const entry = grouped.get(r.questionId) || { count: 0, latest: 0, sample: r }
    const ts = typeof r.createdAt?.toDate === 'function' ? r.createdAt.toDate().getTime() : Date.now()
    entry.count += 1
    entry.latest = Math.max(entry.latest || 0, ts)
    entry.sample = entry.sample || r
    grouped.set(r.questionId, entry)
  })
  return Array.from(grouped.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, topN)
    .map(([questionId, meta]) => ({
      questionId,
      count: meta.count,
      latestAt: meta.latest ? new Date(meta.latest) : null,
      sample: meta.sample,
    }))
}

export async function updateReportStatus(reportId: string, status: QuestionReportStatus, opts?: { notes?: string, resolvedBy?: string | null }) {
  const patch: any = { status }
  if (opts?.notes !== undefined) {
    patch['admin.notes'] = opts.notes
  }
  if (status === 'resolved') {
    patch['admin.resolvedBy'] = opts?.resolvedBy || null
    patch['admin.resolvedAt'] = serverTimestamp()
  }
  await updateDoc(doc(db, 'questionReports', reportId), patch)
}

async function countAttempts(field: 'questionId' | 'exerciseId', questionId: string, onlyWrong = false) {
  const clauses: QueryConstraint[] = [
    where(field, '==', questionId),
  ]
  if (onlyWrong) clauses.push(where('correct', '==', false))
  const snap = await getCountFromServer(query(collectionGroup(db, 'attemptItems'), ...clauses))
  return snap.data().count || 0
}

export async function getQuestionAttemptStats(questionId: string) {
  let total = 0
  let wrong = 0
  try {
    total = await countAttempts('questionId', questionId, false)
    wrong = await countAttempts('questionId', questionId, true)
    if (total === 0 && wrong === 0) {
      total = await countAttempts('exerciseId', questionId, false)
      wrong = await countAttempts('exerciseId', questionId, true)
    }
  } catch (e) {
    console.warn('aggregate counts unavailable', e)
    return { total: 0, wrong: 0, wrongRate: 0 }
  }
  const wrongRate = total > 0 ? Math.round((wrong / total) * 1000) / 10 : 0
  return { total, wrong, wrongRate }
}

export async function getReportCountForQuestion(questionId: string) {
  try {
    const snap = await getCountFromServer(query(collection(db, 'questionReports'), where('questionId', '==', questionId)))
    return snap.data().count || 0
  } catch (e) {
    console.warn('report count unavailable', e)
    return 0
  }
}
