export type QuestionType = 'MCQ' | 'FILL_BLANK' | 'TRUE_FALSE' | 'ERROR_SPOTTING'

export type QualityStatus = 'draft' | 'reviewed' | 'published' | 'rejected' | 'archived'

export type QualityHistoryEntry = {
  at: string | Date
  by: string
  action: 'created' | 'updated' | 'reviewed' | 'published' | 'rejected' | 'archived' | 'deleted' | 'hard_deleted'
  notes?: string
  status?: QualityStatus
  details?: string
}

export type ReviewDecision = 'approved' | 'rejected' | null

export type ReviewInfo = {
  reviewedBy?: string | null
  reviewedAt?: string | Date | null
  decision?: ReviewDecision
  notes?: string | null
}

export type QualityState = {
  status: QualityStatus
  review?: ReviewInfo
  history?: QualityHistoryEntry[]
  deletedAt?: string | Date | null
  deletedBy?: string | null
}

export type PackMetaV1 = {
  schemaVersion: number
  taxonomyVersion: string
  setId: string
  grade: string
  lang: string
  primaryTag?: string
  blockId?: string
  name?: string
  promptDirectives?: string
  createdAt?: string
  lesson?: string
  lessonTitle?: string
}

export type QuestionV1 = {
  schemaVersion: number
  taxonomyVersion: string
  id: string
  blockId: string
  grade: string
  lang: string
  primaryTag: string
  setId?: string
  secondaryTags?: string[]
  metaTags?: string[]
  type: QuestionType
  difficulty: number
  statement: string
  choices?: string[] | null
  answer: string
  lessonRef?: string | null
  explanation?: string
  commonMistake?: string
  quality: QualityState
  generator?: {
    source?: string
    setId?: string
  }
  createdAt?: string | Date
  updatedAt?: string | Date
}

export type QuestionPackV1 = {
  pack: PackMetaV1
  questions: QuestionV1[]
}

export type PackValidationResult = {
  ok: boolean
  errors: string[]
  warnings: string[]
}

export type ImportReport = {
  packImported: boolean
  questions: {
    created: number
    updated: number
    ignored: number
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function extractLessonAnchors(lesson?: string): Set<string> {
  const anchors = new Set<string>()
  if (!lesson || typeof lesson !== 'string') return anchors
  const regex = /{#([a-zA-Z0-9_-]+)}/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(lesson)) !== null) {
    anchors.add(m[1])
  }
  return anchors
}

function validateQuestion(q: any, idx: number, anchors: Set<string>): { errors: string[], warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const lessonRefNormalized = (typeof q.lessonRef === 'string')
    ? q.lessonRef.trim().replace(/^#/, '')
    : q.lessonRef

  if (q.schemaVersion !== 1) errors.push(`question[${idx}].schemaVersion doit valoir 1`)
  if (!isNonEmptyString(q.taxonomyVersion)) errors.push(`question[${idx}].taxonomyVersion requis`)
  if (!isNonEmptyString(q.id)) errors.push(`question[${idx}].id manquant ou vide`)
  if (!isNonEmptyString(q.blockId)) errors.push(`question[${idx}].blockId manquant ou vide`)
  if (!isNonEmptyString(q.grade)) errors.push(`question[${idx}].grade manquant ou vide`)
  if (!isNonEmptyString(q.lang)) errors.push(`question[${idx}].lang manquant ou vide`)
  if (!isNonEmptyString(q.primaryTag)) errors.push(`question[${idx}].primaryTag manquant ou vide`)
  if (!isNonEmptyString(q.type)) errors.push(`question[${idx}].type manquant ou vide`)
  if (!Number.isFinite(q.difficulty)) {
    warnings.push(`question[${idx}].difficulty manquante ou invalide (défaut = 2)`)
  }
  if (!isNonEmptyString(q.statement)) errors.push(`question[${idx}].statement manquant ou vide`)
  if (!isNonEmptyString(q.answer)) errors.push(`question[${idx}].answer manquant ou vide`)

  const allowedTypes: QuestionType[] = ['MCQ', 'FILL_BLANK', 'TRUE_FALSE', 'ERROR_SPOTTING']
  if (q.type && !allowedTypes.includes(q.type)) {
    errors.push(`question[${idx}].type invalide (${q.type})`)
  }

  if (!q.quality || !q.quality.status) {
    errors.push(`question[${idx}].quality.status manquant`)
  } else {
    const allowedStatus: QualityStatus[] = ['draft', 'reviewed', 'published', 'rejected', 'archived']
    if (!allowedStatus.includes(q.quality.status)) {
      errors.push(`question[${idx}].quality.status invalide (${q.quality.status})`)
    }
  }

  if (q.type === 'MCQ') {
    if (!Array.isArray(q.choices) || q.choices.length < 2) {
      errors.push(`question[${idx}].choices requis pour MCQ (au moins 2)`)
    } else {
      if (!q.choices.includes(q.answer)) {
        errors.push(`question[${idx}].answer doit appartenir à choices pour MCQ`)
      }
      const dup = new Set(q.choices)
      if (dup.size !== q.choices.length) {
        errors.push(`question[${idx}].choices doit contenir des réponses distinctes (MCQ)`)
      }
    }
  }

  if (q.type === 'TRUE_FALSE') {
    const allowedTf = ['true', 'false']
    if (!allowedTf.includes(String(q.answer))) {
      errors.push(`question[${idx}].answer doit être "true" ou "false" pour TRUE_FALSE`)
    }
  }

  if (q.type === 'FILL_BLANK') {
    if (q.choices !== null && q.choices !== undefined && !Array.isArray(q.choices)) {
      errors.push(`question[${idx}].choices doit être null ou string[] pour FILL_BLANK`)
    }
  }

  if (q.lessonRef !== undefined && q.lessonRef !== null && !isNonEmptyString(q.lessonRef)) {
    errors.push(`question[${idx}].lessonRef doit être une string non vide ou null`)
  }
  if (isNonEmptyString(lessonRefNormalized)) {
    if (!anchors.has(lessonRefNormalized)) {
      warnings.push(`question[${idx}].lessonRef "${q.lessonRef}" introuvable dans la leçon (ancre {#...})`)
    }
  }

  if (Array.isArray(q.metaTags)) {
    const invalidMeta = q.metaTags.filter((t: any) => !isNonEmptyString(t) || !t.startsWith('meta_'))
    if (invalidMeta.length) {
      errors.push(`question[${idx}].metaTags doivent commencer par "meta_" (${invalidMeta.join(', ')})`)
    }
  }

  if (q.explanation && q.explanation.trim().length > 0 && q.explanation.trim().length < 20) {
    warnings.push(`question[${idx}].explanation trop courte (<20 caractères)`)
  }

  return { errors, warnings }
}

export function validateQuestionPack(pack: any): PackValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  if (!pack || typeof pack !== 'object') {
    return { ok: false, errors: ['Pack inexistant ou non-objet'], warnings }
  }

  if (!pack.pack || typeof pack.pack !== 'object') {
    errors.push('Section pack manquante')
  } else {
    if (pack.pack.schemaVersion !== 1) errors.push('pack.schemaVersion requis et doit valoir 1')
    if (!isNonEmptyString(pack.pack.taxonomyVersion)) errors.push('pack.taxonomyVersion requis (ex: "5e-1.0")')
    if (!isNonEmptyString(pack.pack.setId)) errors.push('pack.setId requis')
    if (!isNonEmptyString(pack.pack.grade)) errors.push('pack.grade requis')
    if (!isNonEmptyString(pack.pack.lang)) errors.push('pack.lang requis')
    if (pack.pack.lesson !== undefined && typeof pack.pack.lesson !== 'string') errors.push('pack.lesson doit être une string si présent')
    if (pack.pack.lessonTitle !== undefined && typeof pack.pack.lessonTitle !== 'string') errors.push('pack.lessonTitle doit être une string si présent')
  }

  const anchors = extractLessonAnchors(pack.pack?.lesson)

  if (!Array.isArray(pack.questions) || pack.questions.length === 0) {
    errors.push('questions[] manquant ou vide')
  } else {
    pack.questions.forEach((q: any, idx: number) => {
      const { errors: qErrors, warnings: qWarnings } = validateQuestion(q, idx, anchors)
      if (pack.pack?.taxonomyVersion && q.taxonomyVersion && q.taxonomyVersion !== pack.pack.taxonomyVersion) {
        qErrors.push(`question[${idx}].taxonomyVersion doit égaler pack.taxonomyVersion`)
      }
      errors.push(...qErrors)
      warnings.push(...qWarnings)
    })
  }

  return { ok: errors.length === 0, errors, warnings }
}
