export type ExpeditionType = 'mine' | 'repair' | 'craft'

export type SelectOptions = {
  expedition: ExpeditionType
  targetTagId: string
  secondaryTagIds?: string[]
  desiredCount: number
  masteryByTag: Record<string, { state: 'discovering' | 'progressing' | 'mastered' }>
  history: Array<{
    questionId: string
    tagIds: string[]
    correct: boolean
    ts: number
    difficulty?: number
  }>
}

const DEFAULT_EXPEDITION: ExpeditionType = 'mine'

const difficultyByState: Record<'discovering' | 'progressing' | 'mastered', number[]> = {
  discovering: [1, 2],
  progressing: [1, 2, 3],
  mastered: [2, 3, 4],
}

export function shouldRepair(targetTagId: string, history: SelectOptions['history']): boolean {
  const recent = [...history]
    .filter((h) => h.tagIds?.includes(targetTagId))
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .slice(0, 10)
  const errors = recent.filter((h) => !h.correct)
  if (errors.length >= 4) return true
  for (let i = 0; i < recent.length - 1; i++) {
    if (!recent[i].correct && !recent[i + 1].correct) return true
  }
  return false
}

function scoreQuestion(q: any, opts: SelectOptions, effectiveExpedition: ExpeditionType, history: SelectOptions['history']): number {
  const tags: string[] = q.tags || q.tagIds || []
  const id = q.id || q.questionId
  let score = 0
  const now = Date.now()
  const historyForQuestion = history.filter((h) => h.questionId === id).sort((a, b) => (b.ts || 0) - (a.ts || 0))
  const occurrences = historyForQuestion.length
  const lastUse = historyForQuestion[0]?.ts

  if (tags.includes(opts.targetTagId)) score += 100
  if ((opts.secondaryTagIds || []).some((t) => tags.includes(t))) score += 30

  if (!occurrences) score += 20
  if (occurrences > 0 && occurrences < 3) score += 10

  const wrongAttempts = historyForQuestion.filter((h) => !h.correct)
  const thirtyMinAgo = now - 30 * 60 * 1000
  if (wrongAttempts.some((h) => (h.ts || 0) < thirtyMinAgo)) score += 15

  const tenLatest = [...history].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 10)
  if (tenLatest.some((h) => h.questionId === id)) score -= 50

  const dayAgo = now - 24 * 60 * 60 * 1000
  if (lastUse && lastUse > dayAgo) score -= 20

  // Slight push for repair mode on previously missed target questions
  if (effectiveExpedition === 'repair' && tags.includes(opts.targetTagId) && wrongAttempts.length) {
    score += 25
  }

  return score
}

function filterByDifficulty(pool: any[], allowed: number[]): any[] {
  const allowedSet = new Set(allowed)
  return pool.filter((q) => {
    const diff = typeof q.difficulty === 'number' ? q.difficulty : 1
    // accept up to 4; clamp if packs only go to 3
    return allowedSet.has(diff) || (allowedSet.has(4) && diff === 3)
  })
}

type QuestionLike = {
  id?: string
  questionId?: string
  tags?: string[]
  tagIds?: string[]
  difficulty?: number
}

export function selectQuestionsFromPool<T extends QuestionLike>(pool: T[], opts: SelectOptions): T[] {
  if (!Array.isArray(pool) || pool.length === 0) return []

  const masteryState = opts.masteryByTag?.[opts.targetTagId]?.state || 'discovering'
  const allowedDiff = difficultyByState[masteryState] || difficultyByState.discovering
  const baseExpedition = opts.expedition || DEFAULT_EXPEDITION
  const needRepair = shouldRepair(opts.targetTagId, opts.history || [])
  const effectiveExpedition: ExpeditionType = baseExpedition === 'mine' && needRepair ? 'repair' : baseExpedition

  const filteredPool = filterByDifficulty(pool, allowedDiff)
  if (!filteredPool.length) return []

  const dedup: Record<string, T> = {}
  filteredPool.forEach((q: any) => {
    const id = q.id || q.questionId
    dedup[id] = q
  })
  const uniquePool = Object.values(dedup)

  const scored = uniquePool.map((q) => ({
    question: q,
    score: scoreQuestion(q, opts, effectiveExpedition, opts.history || []),
  })).sort((a, b) => b.score - a.score)

  const targetQs = scored.filter(({ question }) => (question.tags || question.tagIds || []).includes(opts.targetTagId))
  const secondarySet = new Set(opts.secondaryTagIds || [])
  const secondaryQs = scored.filter(({ question }) => (question.tags || question.tagIds || []).some((t: string) => secondarySet.has(t)))
  const otherQs = scored.filter(({ question }) => {
    const tags: string[] = question.tags || question.tagIds || []
    return !tags.includes(opts.targetTagId) && !tags.some((t) => secondarySet.has(t))
  })

  const take = (arr: typeof scored, count: number, usedIds: Set<string>) => {
    const picked: T[] = []
    for (const item of arr) {
      const id = (item.question as any).id || (item.question as any).questionId
      if (usedIds.has(id)) continue
      picked.push(item.question)
      usedIds.add(id)
      if (picked.length >= count) break
    }
    return picked
  }

  const desired = Math.max(1, opts.desiredCount || 10)
  const used = new Set<string>()
  let selected: T[] = []

  if (effectiveExpedition === 'craft') {
    const bothTags = scored.filter(({ question }) => {
      const tags: string[] = question.tags || question.tagIds || []
      return tags.includes(opts.targetTagId) && tags.some((t) => secondarySet.has(t))
    })
    const altOrder = []
    let i = 0
    while (altOrder.length < desired && i < Math.max(targetQs.length, secondaryQs.length)) {
      if (targetQs[i]) altOrder.push(targetQs[i])
      if (secondaryQs[i]) altOrder.push(secondaryQs[i])
      i++
    }
    const priority = [...bothTags, ...altOrder, ...scored]
    for (const item of priority) {
      const id = (item.question as any).id || (item.question as any).questionId
      if (used.has(id)) continue
      selected.push(item.question)
      used.add(id)
      if (selected.length >= desired) break
    }
  } else {
    const targetShare = effectiveExpedition === 'repair'
      ? Math.max(1, Math.round(desired * 0.9))
      : Math.max(1, Math.round(desired * 0.8))
    selected = [
      ...take(targetQs, targetShare, used),
      ...take(otherQs, desired - targetShare, used),
    ]
    if (selected.length < desired) {
      selected = [
        ...selected,
        ...take(scored, desired - selected.length, used),
      ]
    }
  }

  return selected.slice(0, desired)
}

// Lightweight demo for manual checks (used when no test runner is available)
export function demoSelect(): void {
  const pool: any[] = [
    { id: 'q1', tags: ['math_fractions_addition'], difficulty: 2 },
    { id: 'q2', tags: ['math_fractions_addition'], difficulty: 1 },
    { id: 'q3', tags: ['math_fractions_vocabulaire'], difficulty: 1 },
    { id: 'q4', tags: ['math_fractions_addition', 'math_fractions_vocabulaire'], difficulty: 3 },
  ]
  const opts: SelectOptions = {
    expedition: 'mine',
    targetTagId: 'math_fractions_addition',
    desiredCount: 3,
    masteryByTag: { math_fractions_addition: { state: 'progressing' } },
    history: [],
  }
  const picked = selectQuestionsFromPool(pool, opts)
  // eslint-disable-next-line no-console
  console.debug('[demoSelect] picked', picked.map((p) => p.id))
}
