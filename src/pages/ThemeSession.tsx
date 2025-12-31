import React from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { listExercises, listReadings, listExercisesByTag, saveAttemptAndRewards, type AttemptItemInput } from '../data/firestore'
import { saveSessionWithProgress } from '../data/progress'
import { createQuestionReport, type ReportReason } from '../data/questionReports'
import { useAuth } from '../state/useAuth'
import type { Exercise, ExerciseMCQ, ExerciseShortText, ExerciseFillBlank, SubjectId, Reading } from '../types'
import { normalize } from '../utils/normalize'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { flattenThemeContent, PlayableExercise } from '../utils/flattenThemeContent'
import { computeSessionXp, computeLevelFromXp, updateMasteryFromAttempt, type SessionXpBreakdown, type MasteryState } from '../rewards/rewards'
import { awardSessionRewards, applyMasteryEvents, evaluateBadges } from '../rewards/rewardsService'
import { useUserRewards } from '../state/useUserRewards'
import { RewardsHeader } from '../components/RewardsHeader'
import { LessonReminder } from '../components/LessonReminder'
import { extractLessonSection, markdownToHtml } from '../utils/markdown'
import { getSessionFeedback } from '../utils/sessionFeedback'
import { rollCollectible } from '../rewards/collectibles'
import { equipAvatar, unlockCollectible } from '../rewards/collectiblesService'
import { COLLECTIBLES } from '../rewards/collectiblesCatalog'
import { updateDailyProgress } from '../rewards/daily'
import { upsertDayStat } from '../stats/dayLog'
import { selectQuestionsFromPool, shouldRepair, type ExpeditionType } from '../pedagogy/questionSelector'
import { awardMalocraftLoot } from '../rewards/awardMalocraftLoot'
import { subjectToBiomeId } from '../game/biomeCatalog'
import { TAG_CATALOG, getTagMeta, inferSubject } from '../taxonomy/tagCatalog'
import { MALLOOT_CATALOG } from '../rewards/malocraftLootCatalog'
import { getNpcLine, type NpcDialogueLine } from '../game/npc/npcDialogue'
import { getPreferredNpcId } from '../game/npc/npcStorage'
import { NPC_CATALOG, type NpcId } from '../game/npc/npcCatalog'
import { applyZoneRebuildProgress, applyBiomeRebuildProgress } from '../game/rebuildService'
import { computeCoinsEarned } from '../rewards/cosmeticsService'
import { Drawer } from '../components/ui/Drawer'

type AnswerState = Record<string, any>
type LessonReminderState = {
  title?: string | null
  content?: string | null
  lessonRef?: string | null
  mode?: 'full' | 'contextual'
}
type FeedbackItem = {
  id: string
  prompt: string
  correct: boolean
  expected: string
  userAnswer: string
  idx: number
  explanation?: string | null
  lessonRef?: string | null
  packLesson?: string | null
  packLessonTitle?: string | null
  npcLine?: NpcDialogueLine | null
}

const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  wrong_answer: 'Mauvaise correction',
  ambiguous: 'Énoncé ambigu',
  typo: 'Faute ou typo',
  too_hard: 'Trop difficile',
  off_topic: 'Hors sujet',
  other: 'Autre',
}

function isCorrect(ex: Exercise, ans: any): boolean {
  if (ex.type === 'mcq') return ans === (ex as ExerciseMCQ).answerIndex
  if (ex.type === 'short_text') return (ex as ExerciseShortText).expected.includes(normalize(ans || ''))
  if (ex.type === 'fill_blank') return (ex as ExerciseFillBlank).expected.includes(normalize(ans || ''))
  return false
}

function renderUnderlined(text: string) {
  const parts: React.ReactNode[] = []
  const regex = /_([^_]+)_/g
  let lastIndex = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index))
    parts.push(<span key={`u-${key++}`} style={{ textDecoration: 'underline' }}>{m[1]}</span>)
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

function getTagsForZone(subject: SubjectId | null, theme: string | null): string[] {
  if (!subject || !theme) return []
  return Object.values(TAG_CATALOG)
    .filter(meta => meta.subject === subject && meta.theme === theme)
    .map(meta => meta.id)
}

function getTagsForSubject(subject: SubjectId | null): Record<string, string[]> {
  if (!subject) return {}
  const byTheme: Record<string, string[]> = {}
  Object.values(TAG_CATALOG).forEach(meta => {
    if (meta.subject !== subject) return
    if (!byTheme[meta.theme]) byTheme[meta.theme] = []
    byTheme[meta.theme].push(meta.id)
  })
  return byTheme
}

export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function selectRebuildZoneQuestions(content: any[], zoneTags: string[], desiredCount: number, allowHarder: boolean) {
  const pools = new Map<string, any[]>()
  content.forEach((q) => {
    const tag = (q.tags || []).find((t: string) => zoneTags.includes(t))
    if (!tag) return
    if (!pools.has(tag)) pools.set(tag, [])
    pools.get(tag)!.push(q)
  })
  zoneTags.forEach((tag) => {
    if (pools.has(tag)) {
      pools.set(tag, shuffleArray(pools.get(tag)!))
    }
  })

  const unique = new Set<string>()
  const picked: any[] = []
  const diff3Limit = allowHarder ? Math.max(2, Math.floor(desiredCount * 0.2)) : 0
  let diff3Count = 0
  let idx = 0
  const order = zoneTags.filter((t) => pools.get(t)?.length)

  while (picked.length < desiredCount && order.length) {
    const tag = order[idx % order.length]
    const pool = pools.get(tag) || []
    let candidate = pool.shift()
    while (candidate && unique.has(candidate.id)) {
      candidate = pool.shift()
    }
    if (candidate) {
      const diff = candidate.difficulty || 1
      if (diff > 2 && diff3Count >= diff3Limit) {
        // remiser si trop de diff3 déjà prises
        pool.push(candidate)
      } else {
        picked.push(candidate)
        unique.add(candidate.id || candidate.questionId)
        if (diff > 2) diff3Count += 1
      }
    }
    if (!pool.length) {
      const idxToRemove = order.indexOf(tag)
      if (idxToRemove >= 0) order.splice(idxToRemove, 1)
    } else {
      pools.set(tag, pool)
    }
    idx++
    if (!order.length || idx > desiredCount * 5) break
  }

  if (picked.length < desiredCount) {
    const leftovers = Array.from(pools.values()).flat()
    shuffleArray(leftovers).forEach((q) => {
      if (picked.length >= desiredCount) return
      const diff = q.difficulty || 1
      if (diff > 2 && diff3Count >= diff3Limit) return
      const id = q.id || q.questionId
      if (unique.has(id)) return
      picked.push(q)
      unique.add(id)
      if (diff > 2) diff3Count += 1
    })
  }

  return picked.slice(0, desiredCount)
}

export function ThemeSessionPage() {
  const { themeId } = useParams()
  const { user, activeChild } = useAuth()
  const playerUid = activeChild?.id || user?.uid || null
  const { rewards: liveRewards } = useUserRewards(playerUid)
  const [theme, setTheme] = React.useState<any | null>(null)
  const [exos, setExos] = React.useState<PlayableExercise[]>([])
  const [answers, setAnswers] = React.useState<AnswerState>({})
  const [startedAt] = React.useState<number>(() => Date.now())
  const [result, setResult] = React.useState<any | null>(null)
  const [weakTags, setWeakTags] = React.useState<string[]>([])
  const [sessionTargetTagId, setSessionTargetTagId] = React.useState<string | null>(null)
  const [sessionExpeditionType, setSessionExpeditionType] = React.useState<ExpeditionType>('mine')
  const [feedback, setFeedback] = React.useState<FeedbackItem[]>([])
  const [showCorrections, setShowCorrections] = React.useState(false)
  const [sessionRewards, setSessionRewards] = React.useState<{
    deltaXp: number
    levelUp: boolean
    coinsEarned?: number
    newRewards?: any
    prevRewards?: any
    unlockedBadges?: string[]
    collectibleId?: string | null
    xpBreakdown?: SessionXpBreakdown
    blockProgress?: { tagId: string, attempts: number, successRate: number, state?: MasteryState }
  } | null>(null)
  const [awardedLootId, setAwardedLootId] = React.useState<string | null>(null)
  const [showRewardModal, setShowRewardModal] = React.useState(false)
  const nav = useNavigate()
  const [sessionFeedbackMsg, setSessionFeedbackMsg] = React.useState<string>('')
  const [errorMsg, setErrorMsg] = React.useState<string>('')
  const [searchParams] = useSearchParams()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [attemptId, setAttemptId] = React.useState<string | null>(null)
  const [reportTarget, setReportTarget] = React.useState<FeedbackItem | null>(null)
  const [reportReason, setReportReason] = React.useState<ReportReason>('wrong_answer')
  const [reportMessage, setReportMessage] = React.useState('')
  const [reportStatuses, setReportStatuses] = React.useState<Record<string, 'sent' | 'already'>>({})
  const [reportError, setReportError] = React.useState('')
  const [reportSubmitting, setReportSubmitting] = React.useState(false)
  const [lessonReminder, setLessonReminder] = React.useState<LessonReminderState | null>(null)
  const [openLessonByQuestion, setOpenLessonByQuestion] = React.useState<Record<string, boolean>>({})
  const [npcId, setNpcId] = React.useState<NpcId>(getPreferredNpcId())
  const [npcStartLine, setNpcStartLine] = React.useState<NpcDialogueLine | null>(null)
  const [npcEndLine, setNpcEndLine] = React.useState<NpcDialogueLine | null>(null)
  const [sessionKind, setSessionKind] = React.useState<string | null>(null)
  const [zoneMeta, setZoneMeta] = React.useState<{ subject: SubjectId | null, theme: string | null }>({ subject: null, theme: null })
  const npcGuide = NPC_CATALOG[npcId]
  const npcStartShownRef = React.useRef(false)
  const streakPraiseShownRef = React.useRef(false)

  React.useEffect(() => {
    setNpcId(getPreferredNpcId())
  }, [])

  React.useEffect(() => {
    npcStartShownRef.current = false
    streakPraiseShownRef.current = false
    setNpcStartLine(null)
    setNpcEndLine(null)
  }, [themeId])

  React.useEffect(() => {
    (async () => {
      if (!themeId) return
      if (showCorrections || isSubmitting) return // ne pas relancer une nouvelle session pendant l’écran de correction ou en soumission
      const targetTagFromQuery = searchParams.get('targetTagId') || searchParams.get('tagId')
      const expeditionType = (searchParams.get('expeditionType') as ExpeditionType) || 'mine'
      const sessionKindParam = searchParams.get('sessionKind')
      const subjectFromQuery = (searchParams.get('subjectId') as SubjectId) || null
      const themeFromQuery = searchParams.get('theme') || null
      setSessionKind(sessionKindParam)
      setZoneMeta({ subject: subjectFromQuery, theme: themeFromQuery })
      setSessionExpeditionType(expeditionType)

      const tSnap = sessionKindParam === 'reconstruction_theme' ? null : await getDoc(doc(db, 'themes', themeId))
      const tData = tSnap && tSnap.exists() ? { id: themeId, ...tSnap.data() } : null

      let exercises: any[] = []
      let readings: any[] = []

      if (sessionKindParam === 'reconstruction_theme') {
        const subject = subjectFromQuery || (tData as any)?.subjectId || null
        const zoneTags = getTagsForZone(subject, themeFromQuery)
        if (!zoneTags.length) {
          setErrorMsg('Aucun bloc pour cette zone.')
          setExos([])
          setFeedback([])
          setShowCorrections(false)
          setOpenLessonByQuestion({})
          setLessonReminder(null)
          return
        }
        const exercisesByTag = await Promise.all(zoneTags.map(tag => listExercisesByTag(tag, { uid: playerUid })))
        exercises = exercisesByTag.flat()
        const resolvedSubject = subject || inferSubject(zoneTags[0])
        setZoneMeta({ subject: resolvedSubject, theme: themeFromQuery })
        const effectiveTheme = {
          id: themeId,
          subjectId: resolvedSubject,
          title: `Reconstruction · ${themeFromQuery || 'Zone'}`,
        }
        setTheme(effectiveTheme)

        const contentRaw = flattenThemeContent({ exercises, readings })
        const allowHarder = zoneTags.some(tag => ((liveRewards?.masteryByTag || {}) as any)?.[tag]?.score >= 70)
        const content = allowHarder
          ? contentRaw.filter((c: any) => ((c as any).difficulty || 1) <= 3)
          : contentRaw.filter((c: any) => ((c as any).difficulty || 1) <= 2)
        const desiredCount = 18
        if (!content.length) {
          setErrorMsg('Aucune question publiée pour cette zone pour le moment.')
          setExos([])
          setFeedback([])
          setShowCorrections(false)
          setOpenLessonByQuestion({})
          setLessonReminder(null)
          return
        } else {
          setErrorMsg('')
        }

        const picked = selectRebuildZoneQuestions(content, zoneTags, desiredCount, allowHarder)
        setSessionTargetTagId(zoneTags[0] || null)
        setExos(picked.slice(0, desiredCount))
        setLessonReminder(null)
        setAnswers({})
        setResult(null)
        setFeedback([])
        setOpenLessonByQuestion({})
        return
      } else if (sessionKindParam === 'reconstruction_biome') {
        const subject = subjectFromQuery || (tData as any)?.subjectId || null
        if (!subject) {
          setErrorMsg('Biome introuvable.')
          setExos([])
          setFeedback([])
          setShowCorrections(false)
          setOpenLessonByQuestion({})
          setLessonReminder(null)
          return
        }
        const tagsByTheme = getTagsForSubject(subject)
        const zoneEntries = Object.entries(tagsByTheme)
        if (!zoneEntries.length) {
          setErrorMsg('Aucune zone pour ce biome.')
          setExos([])
          setFeedback([])
          setShowCorrections(false)
          setOpenLessonByQuestion({})
          setLessonReminder(null)
          return
        }
        const zoneProgress = liveRewards?.zoneRebuildProgress || {}
        const rebuiltZones = zoneEntries.filter(([theme]) => {
          const key = `${subject}__${theme}`
          const entry = zoneProgress[key]
          const target = entry?.target || 35
          return (entry?.correctCount || 0) >= target
        }).length
        const readyForBiome = (rebuiltZones / zoneEntries.length) >= 0.6
        if (!readyForBiome) {
          setErrorMsg('Reconstruis au moins 60% des zones avant de lancer le biome.')
          setExos([])
          setFeedback([])
          setShowCorrections(false)
          setOpenLessonByQuestion({})
          setLessonReminder(null)
          return
        }

        setZoneMeta({ subject, theme: null })
        const orderedZones = [...zoneEntries].sort((a, b) => {
          const keyA = `${subject}__${a[0]}`
          const keyB = `${subject}__${b[0]}`
          const pa = zoneProgress[keyA]?.correctCount || 0
          const pb = zoneProgress[keyB]?.correctCount || 0
          return pb - pa
        })
        const orderedTags = orderedZones.flatMap(([, tags]) => tags)
        const limitedTags = orderedTags.slice(0, 12) // éviter de charger trop de packs
        const exercisesByTag = await Promise.all(limitedTags.map(tag => listExercisesByTag(tag, { uid: playerUid })))
        const exercises = exercisesByTag.flat()
        const allowHarder = limitedTags.some(tag => ((liveRewards?.masteryByTag || {}) as any)?.[tag]?.score >= 70)
        const contentRaw = flattenThemeContent({ exercises, readings: [] })
        const content = contentRaw.filter((c: any) => {
          const diff = (c as any).difficulty || 1
          return diff <= (allowHarder ? 3 : 2)
        })
        const desiredCount = 22
        if (!content.length) {
          setErrorMsg('Aucune question disponible pour ce biome.')
          setExos([])
          setFeedback([])
          setShowCorrections(false)
          setOpenLessonByQuestion({})
          setLessonReminder(null)
          return
        } else {
          setErrorMsg('')
        }
        const picked = selectRebuildZoneQuestions(content, limitedTags, desiredCount, allowHarder)
        const effectiveTheme = {
          id: themeId,
          subjectId: subject,
          title: 'Reconstruction du biome',
        }
        setSessionTargetTagId(limitedTags[0] || null)
        setTheme(effectiveTheme)
        setExos(picked.slice(0, desiredCount))
        setLessonReminder(null)
        setAnswers({})
        setResult(null)
        setFeedback([])
        setOpenLessonByQuestion({})
        return
      }

      exercises = await listExercises(themeId, { uid: playerUid })
      const readingsFromTheme = Array.isArray((tData as any)?.readings) ? (tData as any).readings : []
      readings = readingsFromTheme
      // fallback : si expédition et aucune question, charger par tag
      if ((!exercises.length || !tData) && targetTagFromQuery) {
        exercises = await listExercisesByTag(targetTagFromQuery, { uid: playerUid })
        readings = []
      } else {
        try {
          const remote = await listReadings(themeId)
          if (remote.length) readings = remote
        } catch {
          // ignore
        }
      }

      const effectiveTheme = tData || (targetTagFromQuery ? {
        id: themeId,
        subjectId: inferSubject(targetTagFromQuery),
        title: 'Expédition MaloCraft',
      } : null)
      setTheme(effectiveTheme)

      const content = flattenThemeContent({ exercises, readings })
      const desiredCount = 10
      if (!content.length) {
        setExos([])
        setErrorMsg('Aucune question publiée pour ce bloc pour le moment.')
        setFeedback([])
        setShowCorrections(false)
        setOpenLessonByQuestion({})
        setLessonReminder(null)
        return
      } else {
        setErrorMsg('')
      }

      const tagFrequency: Record<string, number> = {}
      content.forEach((c: any) => (c.tags || []).forEach((t: string) => { tagFrequency[t] = (tagFrequency[t] || 0) + 1 }))
      const fallbackTag = Object.entries(tagFrequency).sort((a, b) => b[1] - a[1])[0]?.[0]
      const targetTagId = targetTagFromQuery || fallbackTag
      setSessionTargetTagId(targetTagId || null)

      let picked = content
      if (targetTagId) {
        const masteryByTag = (liveRewards?.masteryByTag || {}) as any
        const history: Array<{ questionId: string, tagIds: string[], correct: boolean, ts: number, difficulty?: number }> = []
        const effectiveExpedition: ExpeditionType =
          sessionExpeditionType === 'mine' && shouldRepair(targetTagId, history) ? 'repair' : sessionExpeditionType
        picked = selectQuestionsFromPool(content, {
          expedition: effectiveExpedition,
          targetTagId,
          desiredCount,
          masteryByTag,
          history,
        })
        if (process.env.NODE_ENV !== 'production') {
          const targetCount = picked.filter((p: any) => (p.tags || []).includes(targetTagId)).length
          const avgDifficulty = picked.length ? (picked.reduce((acc: number, p: any) => acc + (p.difficulty || 1), 0) / picked.length).toFixed(2) : '0'
          console.debug('[session.select]', { expedition: effectiveExpedition, targetTagId, count: picked.length, targetCount, avgDifficulty })
        }
      }

      if (!picked.length) {
        const shuffled = [...content].sort(() => Math.random() - 0.5)
        picked = shuffled.slice(0, desiredCount)
      }

      setExos(picked.slice(0, desiredCount))
      const lessonSource = picked.find((ex: any) => (ex as any).packLesson)
      if (lessonSource && (lessonSource as any).packLesson) {
        setLessonReminder({
          title: (lessonSource as any).packLessonTitle || null,
          content: (lessonSource as any).packLesson,
          lessonRef: (lessonSource as any).lessonRef || null,
          mode: 'full',
        })
      } else {
        setLessonReminder(null)
      }
      setAnswers({})
      setResult(null)
      setFeedback([])
      setOpenLessonByQuestion({})
      setShowCorrections(false)
    })()
  }, [themeId, user, searchParams, liveRewards])

  React.useEffect(() => {
    if (!sessionTargetTagId || !exos.length || npcStartShownRef.current || showCorrections) return
    const blockMeta = getTagMeta(sessionTargetTagId)
    const line = getNpcLine(npcId, 'session_start', {
      blockId: sessionTargetTagId,
      blockLabel: blockMeta?.label || null,
      lessonAvailable: !!lessonReminder?.content,
      lessonRef: lessonReminder?.lessonRef || null,
    })
    setNpcStartLine(line)
    npcStartShownRef.current = true
  }, [sessionTargetTagId, exos.length, npcId, lessonReminder?.content, lessonReminder?.lessonRef, showCorrections])

  const submit = async () => {
    if (!playerUid || !themeId || !theme) return
    setIsSubmitting(true)
    setErrorMsg('')
    const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000))

    try {
      const answeredItemIds = new Set<string>()
      exos.forEach((ex) => {
        const ans = answers[ex.id]
        if (ans === undefined || ans === null) return
        if (typeof ans === 'string' && ans.trim() === '') return
        answeredItemIds.add(ex.id)
      })
      const answeredCount = answeredItemIds.size
      // Bonus de complétion uniquement si toutes les questions ont été répondues (évite double comptage sur abandon/refresh).
      const sessionCompleted = answeredCount > 0 && answeredCount === exos.length

      // exerciseId provient de la question publiée (questionId Firestore), nécessaire pour l'idempotence rewardEvents.
      const items: Array<AttemptItemInput & { answered: boolean }> = exos.map(ex => {
        const answered = answeredItemIds.has(ex.id)
        return {
          exerciseId: ex.id,
          questionId: ex.id,
          difficulty: ex.difficulty,
          tags: ex.tags || [],
          correct: answered ? isCorrect(ex, answers[ex.id]) : false,
          answered,
        }
      })

      const progress = await saveSessionWithProgress({
        uid: playerUid,
        subjectId: theme.subjectId as SubjectId,
        themeId,
        answers,
        exercises: exos,
        durationSec,
      })
      setAttemptId(progress.attemptId || null)

      const attemptRewards = await saveAttemptAndRewards({
        uid: playerUid,
        subjectId: theme.subjectId as SubjectId,
        themeId,
        items,
        durationSec,
        existingAttemptId: progress.attemptId,
        skipAttemptWrite: true,
      })

      const correctCount = items.filter(i => i.answered && i.correct).length
      const coinsEarned = computeCoinsEarned(correctCount)
      const streaks: number[] = []
      let currentStreak = 0
      let comebackCount = 0
      let previousIncorrect = false
      const fallbackTagsForRebuild = sessionKind === 'reconstruction_theme' && zoneMeta.subject && zoneMeta.theme
        ? getTagsForZone(zoneMeta.subject, zoneMeta.theme)
        : sessionKind === 'reconstruction_biome' && zoneMeta.subject
          ? Object.values(getTagsForSubject(zoneMeta.subject)).flat()
          : []
      const tagStats: Record<string, { answered: number, correct: number }> = {}
      items.forEach(item => {
        const tagsForStats = (item.tags && item.tags.length ? item.tags : fallbackTagsForRebuild) || []
        tagsForStats.forEach(tag => {
          const stats = tagStats[tag] || { answered: 0, correct: 0 }
          stats.answered += item.answered ? 1 : 0
          stats.correct += item.answered && item.correct ? 1 : 0
          tagStats[tag] = stats
        })
      })
      items.forEach((item) => {
        if (!item.answered) {
          if (currentStreak >= 2) streaks.push(currentStreak)
          currentStreak = 0
          previousIncorrect = false
          return
        }
        if (item.correct) {
          currentStreak += 1
          if (previousIncorrect) comebackCount += 1
          previousIncorrect = false
        } else {
          if (currentStreak >= 2) streaks.push(currentStreak)
          currentStreak = 0
          previousIncorrect = true
        }
      })
      if (currentStreak >= 2) streaks.push(currentStreak)

      // Projection for mastery unlocks (used to decide collectible roll)
      const masteryBefore = liveRewards?.masteryByTag || {}
      let masteryAfter = masteryBefore
      items.forEach(item => {
        masteryAfter = updateMasteryFromAttempt({
          masteryByTag: masteryAfter,
          questionTags: item.tags || [],
          isCorrect: item.correct,
          timestamp: new Date(),
        })
      })
      const newMasteredTagCount = Object.entries(masteryAfter)
        .filter(([tag, val]) => val?.state === 'mastered' && (masteryBefore as any)?.[tag]?.state !== 'mastered')
        .length
      const maxStreak = streaks.length ? Math.max(...streaks) : 0
      if (!streakPraiseShownRef.current && maxStreak >= 3) {
        const praise = getNpcLine(npcId, 'streak_praise', { streak: maxStreak, sessionId: progress.attemptId || themeId })
        setNpcEndLine(prev => prev ?? praise)
        streakPraiseShownRef.current = true
      }

      const xpOutcome = computeSessionXp({
        answeredCount,
        correctCount,
        streaks,
        comebackCount,
        isCompleted: sessionCompleted,
      })
      const deltaXp = xpOutcome.total
      const targetTag = sessionTargetTagId || items.find(i => Array.isArray(i.tags) && i.tags.length)?.tags?.[0] || null
      const blockProgress = targetTag ? (() => {
        const tagged = items.filter(i => i.answered && (i.tags || []).includes(targetTag))
        const attempts = tagged.length
        const correctBlock = tagged.filter(i => i.correct).length
        const successRate = attempts ? Math.round((correctBlock / attempts) * 100) : 0
        const state = (masteryAfter as any)?.[targetTag]?.state || (masteryBefore as any)?.[targetTag]?.state
        return { tagId: targetTag, attempts, successRate, state: state as MasteryState | undefined }
      })() : undefined
      const prevRewards = liveRewards
      let newRewards = null
      let levelUp = false
      let unlockedBadges: string[] = []
      let rolledCollectibleId: string | null = null
      try {
        const res = await awardSessionRewards(playerUid, progress.attemptId || null, deltaXp, coinsEarned)
        newRewards = res
        levelUp = (res?.level || 1) > (liveRewards?.level || 1)
        await applyMasteryEvents({
          uid: playerUid,
          sessionId: progress.attemptId || themeId,
          items: items,
        })
        unlockedBadges = await evaluateBadges({ uid: playerUid, rewards: res || liveRewards }) || []

        const shouldRollCollectible = deltaXp >= 20 || levelUp || newMasteredTagCount > 0
        if (shouldRollCollectible) {
          const owned = (res as any)?.collectibles?.owned || liveRewards?.collectibles?.owned || []
          rolledCollectibleId = rollCollectible(owned)
          if (rolledCollectibleId) {
            const evId = progress.attemptId ? `collectible_${progress.attemptId}` : undefined
            await unlockCollectible(playerUid, rolledCollectibleId, evId)
          }
        }
        // MaloCraft loot (idempotent)
        try {
          const correctRate = items.length ? items.filter(i => i.correct).length / items.length : 0
          const targetTag = items[0]?.tags?.[0] || sessionTargetTagId || ''
          const biomeId = subjectToBiomeId(theme.subjectId as any)
          const resLoot = await awardMalocraftLoot({
            uid: playerUid,
            sessionId: progress.attemptId || themeId,
            biomeId,
            targetTagId: targetTag,
            expedition: sessionExpeditionType,
            sessionStats: { deltaXp, correctRate, levelUp },
          })
          if (resLoot.awarded?.id) setAwardedLootId(resLoot.awarded.id)
        } catch (e) {
          console.warn('awardMalocraftLoot failed', e)
        }

        // Daily quests update (idempotent via event)
        const dailyRes = await updateDailyProgress({
          uid: playerUid,
          sessionId: progress.attemptId || themeId,
          answeredCount,
          tagsUsed: items.flatMap(i => i.tags || []),
          tagStats,
        }).catch(err => {
          console.error('updateDailyProgress failed', err)
          return { allCompleted: false }
        })
        if (dailyRes?.allCompleted) {
          upsertDayStat({
            uid: playerUid,
            sessionsDelta: 1,
            xpDelta: deltaXp,
          }).catch(err => console.error('upsertDayStat failed', err))
        } else {
          // sessions non comptées pour le streak si quêtes non terminées
          upsertDayStat({
            uid: playerUid,
            sessionsDelta: 0,
            xpDelta: deltaXp,
          }).catch(err => console.error('upsertDayStat failed', err))
        }
        const fallbackRebuildTags = (() => {
          if (sessionKind === 'reconstruction_theme' && zoneMeta.subject && zoneMeta.theme) {
            return getTagsForZone(zoneMeta.subject, zoneMeta.theme)
          }
          if (sessionKind === 'reconstruction_biome' && zoneMeta.subject) {
            return Object.values(getTagsForSubject(zoneMeta.subject)).flat()
          }
          return []
        })()

        const zoneDeltaFromStats = (() => {
          if (!fallbackRebuildTags.length) return 0
          return Object.entries(tagStats).reduce((acc, [tag, val]) => {
            if (fallbackRebuildTags.includes(tag)) {
              return acc + (val.correct || 0)
            }
            return acc
          }, 0)
        })()

        const rebuildTagStats = (() => {
          if (Object.keys(tagStats).length && zoneDeltaFromStats > 0) return tagStats
          if (!fallbackRebuildTags.length || !correctCount) return tagStats
          const cloned: Record<string, { answered: number, correct: number }> = {}
          // Pour éviter de sur-compter, on applique tout le delta sur un seul tag fallback.
          const tag = fallbackRebuildTags[0]
          cloned[tag] = { answered: correctCount, correct: correctCount }
          return cloned
        })()

        if (sessionKind === 'reconstruction_theme' && zoneMeta.subject && zoneMeta.theme) {
          try {
            const rebuildRes = await applyZoneRebuildProgress({
              uid: playerUid,
              sessionId: progress.attemptId || themeId,
              subject: zoneMeta.subject as SubjectId,
              theme: zoneMeta.theme,
              tagStats: rebuildTagStats,
            })
            if (rebuildRes.progress?.rebuiltAt) {
              setNpcEndLine(prev => prev ?? getNpcLine(npcId, 'streak_praise', {
                sessionId: progress.attemptId || themeId,
                streak: rebuildRes.progress.correctCount,
              }))
            }
          } catch (e) {
            console.warn('applyZoneRebuildProgress failed', e)
          }
        } else if (sessionKind === 'reconstruction_biome' && zoneMeta.subject) {
          try {
            const rebuildRes = await applyBiomeRebuildProgress({
              uid: playerUid,
              sessionId: progress.attemptId || themeId,
              subject: zoneMeta.subject as SubjectId,
              tagStats: rebuildTagStats,
            })
            if (rebuildRes.progress?.rebuiltAt) {
              setNpcEndLine(prev => prev ?? getNpcLine(npcId, 'streak_praise', {
                sessionId: progress.attemptId || themeId,
                streak: rebuildRes.progress.correctCount,
              }))
            }
          } catch (e) {
            console.warn('applyBiomeRebuildProgress failed', e)
          }
        }
        // TODO: branch here for futures (quests journalières v2, PNJ réactions, stats parents) without changing rewardEvents idempotence.
      } catch (e) {
        console.error('awardSessionRewards failed', e)
        // fallback: do not block UX
      }
      setSessionRewards({ deltaXp, levelUp, coinsEarned, newRewards, prevRewards, unlockedBadges, collectibleId: rolledCollectibleId, xpBreakdown: xpOutcome.breakdown, blockProgress })
      const blockLabel = blockProgress?.tagId ? getTagMeta(blockProgress.tagId)?.label || null : (sessionTargetTagId ? getTagMeta(sessionTargetTagId)?.label || null : null)
      setNpcEndLine(prev => {
        const endLine = getNpcLine(npcId, 'session_end', {
          blockId: blockProgress?.tagId || sessionTargetTagId,
          blockLabel,
          successRate: blockProgress?.successRate ?? null,
          masteryState: blockProgress?.state ?? null,
          xpBreakdown: xpOutcome.breakdown,
          sessionId: progress.attemptId || themeId,
        })
        if (prev && prev.text) {
          return { ...endLine, text: `${endLine.text} ${prev.text}` }
        }
        return endLine
      })

      const sessionTags = new Set<string>(exos.flatMap(ex => ex.tags || []))
      const sortedWeak = Object.values(progress.tagsUpdated || {})
        .filter(t => t && sessionTags.has(t.tagId || ''))
        .sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0))
        .slice(0, 3)
        .map(t => t.tagId!)

      setWeakTags(sortedWeak)
      setResult({ score: attemptRewards.score, outOf: attemptRewards.outOf, durationSec, ...attemptRewards, coinsGain: coinsEarned })

      // feedback: weakest tag from incorrect answers, improved from highest delta
      const incorrectTags = items.filter(i => !i.correct).flatMap(i => i.tags || [])
      const tagDelta = new Map<string, number>()
      items.forEach(i => {
        const delta = i.correct ? 8 : 2
        ;(i.tags || []).forEach(t => {
          tagDelta.set(t, (tagDelta.get(t) || 0) + delta)
        })
      })
      let improvedTag: string | undefined
      if (tagDelta.size) {
        improvedTag = Array.from(tagDelta.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
      }
      const accuracy = attemptRewards.outOf ? (attemptRewards.score / attemptRewards.outOf) * 100 : 0
      const fb = getSessionFeedback({
        accuracy,
        weakestTag: incorrectTags[0] || weakTags[0],
        improvedTag,
      })

      const fbDetails = exos.map((ex, idx) => {
        const userAns = answers[ex.id]
        const correct = isCorrect(ex, userAns)
        let expected = ''
        let userAnswer = ''
        const packLesson = (ex as any).packLesson || lessonReminder?.content || null
        const packLessonTitle = (ex as any).packLessonTitle || lessonReminder?.title || null
        if (ex.type === 'mcq') {
          const mcq = ex as ExerciseMCQ
          expected = mcq.choices[mcq.answerIndex] || ''
          userAnswer = typeof userAns === 'number' ? (mcq.choices[userAns] || '') : ''
        } else if (ex.type === 'short_text') {
          expected = (ex as ExerciseShortText).expected[0] || ''
          userAnswer = userAns || ''
        } else if (ex.type === 'fill_blank') {
          expected = (ex as ExerciseFillBlank).expected[0] || ''
          userAnswer = userAns || ''
        }
        const blockLabel = (ex.tags || []).map(t => getTagMeta(t)?.label).find(Boolean) || (sessionTargetTagId ? getTagMeta(sessionTargetTagId)?.label : null)
        const npcLine = !correct ? getNpcLine(npcId, 'wrong_answer', {
          blockId: (ex.tags || [])[0] || sessionTargetTagId,
          blockLabel: blockLabel || null,
          lessonRef: (ex as any).lessonRef || lessonReminder?.lessonRef || null,
          lessonAvailable: !!packLesson,
          sessionId: progress.attemptId || themeId,
          questionId: ex.id,
        }) : null
        return {
          id: ex.id,
          prompt: ex.prompt,
          correct,
          expected: expected || '—',
          userAnswer: (userAnswer ?? '').toString() || '—',
          idx: idx + 1,
          explanation: (ex as any).explanation || null,
          lessonRef: (ex as any).lessonRef || null,
          packLesson,
          packLessonTitle,
          npcLine,
        }
      })
      const firstIncorrectWithLesson = exos.find((ex, idx) => {
        const ans = answers[ex.id]
        return !isCorrect(ex, ans) && (ex as any).lessonRef
      })
      if (firstIncorrectWithLesson) {
        const packLesson = (firstIncorrectWithLesson as any).packLesson || lessonReminder?.content
        if (packLesson) {
          setLessonReminder(prev => ({
            title: (firstIncorrectWithLesson as any).packLessonTitle || prev?.title || null,
            content: packLesson,
            lessonRef: (firstIncorrectWithLesson as any).lessonRef || prev?.lessonRef || null,
            mode: 'contextual',
          }))
        }
      }
      setSessionFeedbackMsg(fb)
      setFeedback(fbDetails)
      setShowCorrections(true)
      setShowRewardModal(true)
    } catch (e: any) {
      console.error('submit session failed', e)
      setErrorMsg(e?.message || 'Enregistrement impossible. Vérifie la connexion ou les droits.')
    }
    setIsSubmitting(false)
  }

  const resetSessionView = () => {
    setShowCorrections(false)
    setFeedback([])
    setResult(null)
    setAnswers({})
    setOpenLessonByQuestion({})
    setReportStatuses({})
    setReportTarget(null)
    setReportMessage('')
    setReportReason('wrong_answer')
    setReportError('')
    setAttemptId(null)
    npcStartShownRef.current = false
    streakPraiseShownRef.current = false
    setNpcStartLine(null)
    setNpcEndLine(null)
  }

  const getReportContext = React.useCallback((questionId: string) => {
    const ex = exos.find(e => e.id === questionId) as any
    return {
      setId: ex?.setId,
      primaryTag: ex?.primaryTag || (Array.isArray(ex?.tags) ? ex.tags[0] : undefined),
      blockId: ex?.blockId || ex?.themeId,
      sessionId: attemptId || undefined,
      grade: (theme as any)?.grade || undefined,
    }
  }, [attemptId, exos, theme])

  const openReportDrawer = (item: FeedbackItem) => {
    setReportTarget(item)
    setReportReason('wrong_answer')
    setReportMessage('')
    setReportError('')
  }

  const closeReportDrawer = () => {
    setReportTarget(null)
    setReportMessage('')
    setReportError('')
  }

  const onSendReport = async () => {
    if (!playerUid || !reportTarget) return
    setReportSubmitting(true)
    setReportError('')
    const targetId = reportTarget.id
    try {
      const res = await createQuestionReport({
        questionId: targetId,
        uid: playerUid,
        reason: reportReason,
        message: reportMessage,
        context: getReportContext(targetId),
      })
      setReportStatuses(prev => ({ ...prev, [targetId]: res.alreadyExists ? 'already' : 'sent' }))
      closeReportDrawer()
    } catch (e: any) {
      if (e?.code === 'already-exists') {
        setReportStatuses(prev => ({ ...prev, [targetId]: 'already' }))
        closeReportDrawer()
      } else {
        setReportError(e?.message || 'Impossible d’envoyer le signalement.')
      }
    } finally {
      setReportSubmitting(false)
    }
  }

  if (!themeId) return <div className="container"><div className="card">Thème introuvable.</div></div>
  if (!playerUid) return <div className="container"><div className="card">Sélectionnez un enfant rattaché pour lancer une session.</div></div>

  if (showCorrections && feedback.length) {
    const prevXp = sessionRewards?.prevRewards?.xp ?? liveRewards?.xp ?? 0
    const newXp = sessionRewards?.newRewards?.xp ?? prevXp
    const xpBefore = prevXp
    const xpAfter = newXp
    const xpDelta = sessionRewards?.deltaXp ?? 0
    const message = result ? (() => {
      const rate = result.outOf ? (result.score / result.outOf) * 100 : 0
      if (rate >= 80) return 'Super ! Continue comme ça.'
      if (rate >= 50) return 'Bien joué ! On consolide et ça va monter.'
      return 'Bien essayé. On progresse en s’entraînant.'
    })() : ''
    const blockMeta = sessionRewards?.blockProgress?.tagId ? getTagMeta(sessionRewards.blockProgress.tagId) : null
    const blockFeedback = sessionRewards?.blockProgress ? (() => {
      const r = sessionRewards.blockProgress.successRate
      if (r >= 80) return 'Bloc presque réparé'
      if (r >= 50) return 'Bloc en bonne voie'
      if (r > 0) return 'Premiers pas sur ce bloc'
      return ''
    })() : ''

    const collectibleDef = sessionRewards?.collectibleId ? COLLECTIBLES.find(c => c.id === sessionRewards?.collectibleId) : null
    const rarityLabel = collectibleDef?.rarity === 'epic' ? 'Épique' : collectibleDef?.rarity === 'rare' ? 'Rare' : 'Commun'
    const lootDef = awardedLootId ? MALLOOT_CATALOG.find(l => l.id === awardedLootId) : null

    const onEquip = async () => {
      if (!user || !collectibleDef || collectibleDef.type !== 'avatar') return
      try {
        if (playerUid) await equipAvatar(playerUid, collectibleDef.id)
      } catch (e) {
        console.error('equipAvatar failed', e)
      }
      setShowRewardModal(false)
    }

    return (
      <div className="container grid" style={{ position: 'relative' }}>
        <Drawer open={!!reportTarget} onClose={closeReportDrawer} title="Signaler une question" width={520}>
          {reportTarget && (
            <div>
              <div className="small" style={{ marginBottom: 6 }}>Question {reportTarget.idx}</div>
              <div style={{ fontWeight:700 }}>{reportTarget.prompt}</div>
              <div style={{ marginTop: 12 }}>
                {(Object.entries(REPORT_REASON_LABELS) as Array<[ReportReason, string]>).map(([reason, label]) => (
                  <label key={reason} className="small row" style={{ gap: 8, alignItems:'center', marginBottom:6 }}>
                    <input
                      type="radio"
                      name="report-reason"
                      value={reason}
                      checked={reportReason === reason}
                      onChange={() => setReportReason(reason as ReportReason)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <label className="small" style={{ display:'block', marginTop: 10 }}>
                Commentaire (optionnel)
                <textarea
                  className="input"
                  value={reportMessage}
                  onChange={(e) => setReportMessage(e.target.value)}
                  maxLength={240}
                  placeholder="Détaille le problème (240 caractères max)"
                />
                <div className="small" style={{ textAlign:'right' }}>{reportMessage.length}/240</div>
              </label>
              {reportError && <div className="small" style={{ color:'#ff5a6f', marginTop: 6 }}>{reportError}</div>}
              <div className="row" style={{ gap: 8, marginTop: 12 }}>
                <button className="btn secondary" onClick={closeReportDrawer}>Annuler</button>
                <button className="btn" onClick={onSendReport} disabled={reportSubmitting}>Envoyer</button>
              </div>
            </div>
          )}
        </Drawer>
        {showRewardModal && (
          <div style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,0.55)',
            display:'flex', alignItems:'center', justifyContent:'center', zIndex:999
          }}>
            <div className="card" style={{ maxWidth: 460 }}>
              <h3 style={{ marginTop: 0 }}>Bravo {user?.displayName?.split(' ')[0] || '!'}</h3>
              <div className="small">Score {result?.score}/{result?.outOf}</div>
              <div className="small" style={{ marginTop: 6 }}>+{sessionRewards?.deltaXp ?? 0} XP</div>
              {sessionRewards?.coinsEarned !== undefined && (
                <div className="small" style={{ marginTop: 4 }}>+{sessionRewards.coinsEarned} coins</div>
              )}
              {sessionRewards?.xpBreakdown && (
                <div className="small" style={{ marginTop: 4 }}>
                  Base {sessionRewards.xpBreakdown.base} · série +{sessionRewards.xpBreakdown.streakBonus} · retour +{sessionRewards.xpBreakdown.comebackBonus} · session +{sessionRewards.xpBreakdown.completion}
                </div>
              )}
              {sessionRewards?.levelUp && (
                <div className="small" style={{ marginTop: 6 }}>🎉 Niveau {sessionRewards?.newRewards?.level}</div>
              )}
              {sessionRewards?.blockProgress && blockMeta && (
                <div className="small" style={{ marginTop: 6 }}>
                  {blockMeta.label} : {sessionRewards.blockProgress.successRate}% ({sessionRewards.blockProgress.attempts} q.) {blockFeedback ? `• ${blockFeedback}` : ''}
                </div>
              )}
              {collectibleDef && (
                <div className="pill" style={{ marginTop: 10, display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ fontSize: '1.6rem' }}>{collectibleDef.icon}</div>
                  <div>
                    <div style={{ fontWeight: 800 }}>🎁 Nouveau ! {collectibleDef.title}</div>
                    <div className="small">{collectibleDef.type === 'avatar' ? 'Avatar' : 'Sticker'} • {rarityLabel}</div>
                  </div>
                </div>
              )}
              {lootDef && (
                <div className="pill" style={{ marginTop: 10, display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ fontSize:'1.6rem' }}>{lootDef.icon}</div>
                  <div>
                    <div style={{ fontWeight:800 }}>Butin MaloCraft : {lootDef.title}</div>
                    <div className="small">{lootDef.type} • {lootDef.rarity === 'epic' ? 'Épique' : lootDef.rarity === 'rare' ? 'Rare' : 'Commun'}</div>
                  </div>
                </div>
              )}
              {sessionRewards?.unlockedBadges?.length ? (
                <div className="small" style={{ marginTop: 8 }}>
                  Nouveau badge : {sessionRewards.unlockedBadges.map(b => <span key={b} className="badge">{b}</span>)}
                </div>
              ) : null}
              {message && <div className="small" style={{ marginTop: 8 }}>{message}</div>}
              <div className="row" style={{ marginTop: 12, flexWrap:'wrap', gap:8 }}>
                {collectibleDef?.type === 'avatar' && (
                  <button className="btn" onClick={onEquip}>Équiper</button>
                )}
                <button className="btn" onClick={() => setShowRewardModal(false)}>Voir la correction</button>
              </div>
            </div>
          </div>
        )}
        <div className="card">
          <h2 style={{ margin:0 }}>Corrections – {theme?.title}</h2>
          {result && (
            <div className="small">
              Score <strong>{result.score}/{result.outOf}</strong> · {result.durationSec}s · +{result.xpGain} XP · +{result.coinsGain} pièces
            </div>
          )}
          {sessionRewards && (
            <div className="small" style={{ marginTop: 8 }}>
              +{sessionRewards.deltaXp} XP {sessionRewards.levelUp ? `· 🎉 Niveau ${sessionRewards.newRewards?.level}` : ''}
            </div>
          )}
          {sessionRewards?.coinsEarned !== undefined && (
            <div className="small" style={{ marginTop: 4 }}>
              +{sessionRewards.coinsEarned} coins gagnés
            </div>
          )}
          {sessionRewards?.xpBreakdown && (
            <div className="small" style={{ marginTop: 4 }}>
              Détail XP : base {sessionRewards.xpBreakdown.base} · série +{sessionRewards.xpBreakdown.streakBonus} · retour +{sessionRewards.xpBreakdown.comebackBonus} · session +{sessionRewards.xpBreakdown.completion}
            </div>
          )}
          {sessionRewards?.blockProgress && blockMeta && (
            <div className="small" style={{ marginTop: 6 }}>
              {blockMeta.label} : {sessionRewards.blockProgress.successRate}% ({sessionRewards.blockProgress.attempts} q.) {blockFeedback ? `• ${blockFeedback}` : ''}
            </div>
          )}
          <div className="row" style={{ gap:8, marginTop:10, flexWrap:'wrap' }}>
            {lootDef && <button className="btn secondary" onClick={() => nav('/chest')}>Voir mon coffre</button>}
            {collectibleDef && <button className="btn secondary" onClick={() => nav('/collection')}>Voir ma collection</button>}
          </div>
          {message && <div className="small" style={{ marginTop: 8 }}>{message}</div>}
        </div>

        {npcEndLine && (
          <div className="card mc-card" style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
            <div style={{ fontSize:'2rem' }}>{npcGuide.avatar}</div>
            <div>
              <div className="small" style={{ color:'var(--mc-muted)' }}>{npcGuide.name}</div>
              <div style={{ fontWeight:800 }}>{npcEndLine.text}</div>
            </div>
          </div>
        )}

        {lessonReminder?.content && (
          <LessonReminder
            title={lessonReminder.title}
            content={lessonReminder.content}
            lessonRef={lessonReminder.lessonRef}
            mode={lessonReminder.mode || 'full'}
          />
        )}

        <div className="card">
          <div className="grid">
            {feedback.map(f => (
              <div key={f.id} className="pill" style={{
                display:'flex', flexDirection:'column', alignItems:'flex-start', gap:6,
                background: f.correct ? 'rgba(46, 204, 113, 0.12)' : 'rgba(255, 90, 111, 0.12)',
                border: f.correct ? '1px solid rgba(46, 204, 113, 0.4)' : '1px solid rgba(255, 90, 111, 0.4)'
              }}>
                <div className="small">
                  Question {f.idx} • {f.correct ? <span className="badge" style={{ borderColor:'rgba(46,204,113,.6)', color:'#7fffb2' }}>✔️ Bonne réponse</span> : <span className="badge" style={{ borderColor:'rgba(255,90,111,.6)', color:'#ff9fb0' }}>❌ Mauvaise réponse</span>}
                </div>
                <div style={{ fontWeight: 700 }}>{f.prompt}</div>
                <div className="small">Ta réponse : <strong>{f.userAnswer}</strong></div>
                {!f.correct && (
                  <>
                    <div className="small">Correction : <strong>{f.expected}</strong></div>
                    {f.explanation && (
                      <div className="small" style={{ marginTop: 4 }}>Explication : {f.explanation}</div>
                    )}
                    {f.npcLine && (
                      <div className="pill" style={{
                        marginTop: 6,
                        display: 'flex',
                        gap: 8,
                        alignItems: 'flex-start',
                        background: 'rgba(122,162,255,0.08)',
                        border: '1px solid rgba(122,162,255,0.35)'
                      }}>
                        <div style={{ fontSize:'1.4rem' }}>{npcGuide.avatar}</div>
                        <div>
                          <div className="small" style={{ color:'var(--mc-muted)' }}>{npcGuide.name}</div>
                          <div className="small" style={{ fontWeight:700 }}>{f.npcLine.text}</div>
                          {f.npcLine.cta?.action === 'open_lesson' && f.packLesson && (
                            <button
                              className="mc-button secondary"
                              style={{ marginTop: 6, padding:'4px 8px', fontSize:'0.8rem' }}
                              onClick={() => setOpenLessonByQuestion(prev => ({ ...prev, [f.id]: true }))}
                            >
                              {f.npcLine.cta.label}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {f.packLesson && (
                      <div className="small" style={{ marginTop: 6 }}>
                        <button
                          className="btn secondary"
                          style={{ padding:'4px 8px', fontSize: '0.8rem' }}
                          onClick={() => setOpenLessonByQuestion(prev => ({ ...prev, [f.id]: !prev[f.id] }))}
                        >
                          {openLessonByQuestion[f.id] ? 'Masquer le rappel' : 'Voir le rappel de leçon'}
                        </button>
                        {openLessonByQuestion[f.id] && (
                          <div className="pill" style={{ marginTop: 6 }}>
                            <div className="small" style={{ color:'var(--mc-muted)' }}>
                              {f.packLessonTitle || 'Leçon'}
                            </div>
                            {(() => {
                              const section = f.lessonRef ? extractLessonSection(f.packLesson || '', f.lessonRef) : null
                              const html = markdownToHtml(section?.markdown || f.packLesson || '')
                              return (
                                <>
                                  {section?.title && <div style={{ fontWeight: 700 }}>{section.title}</div>}
                                  <div className="small" dangerouslySetInnerHTML={{ __html: html }} />
                                </>
                              )
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
                <div className="row" style={{ gap: 8, marginTop: 8, flexWrap:'wrap' }}>
                  <button
                    className="btn secondary"
                    onClick={() => openReportDrawer(f)}
                    disabled={!!reportStatuses[f.id]}
                  >
                    {reportStatuses[f.id] === 'sent' ? 'Signalée ✓' : reportStatuses[f.id] === 'already' ? 'Déjà signalée ✓' : 'Signaler'}
                  </button>
                  {reportStatuses[f.id] && (
                    <span className="small" style={{ color:'var(--mc-muted)' }}>
                      Merci pour ton aide !
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => nav('/')}>Retour à l’accueil</button>
            <button className="btn secondary" onClick={resetSessionView}>Refaire une session</button>
          </div>
        </div>

        {sessionRewards && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Progression XP</h3>
            <div className="small">XP : {xpBefore} → {xpAfter}</div>
            {sessionRewards.blockProgress && blockMeta && (
              <div className="small" style={{ marginTop: 6 }}>
                Bloc cible : {blockMeta.label} · {sessionRewards.blockProgress.successRate}% ({sessionRewards.blockProgress.attempts} q.) {blockFeedback ? `• ${blockFeedback}` : ''}
              </div>
            )}
            {(() => {
              const before = computeLevelFromXp(xpBefore)
              const after = computeLevelFromXp(xpAfter)
              const progress = Math.min(100, Math.max(0, Math.round(after.xpIntoLevel / after.xpForNext * 100)))
              return (
                <>
                  <div className="small">Niveau : {before.level} → {after.level}</div>
                  <div style={{ height: 12, background:'rgba(255,255,255,0.08)', borderRadius: 999, overflow:'hidden', marginTop: 8 }}>
                    <div style={{
                      height: '100%',
                      width: `${progress}%`,
                      background:'linear-gradient(90deg,#7aa2ff,#2ecc71)',
                      transition:'width 0.6s ease'
                    }} />
                  </div>
                </>
              )
            })()}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="container grid">
      <div className="card">
        <h2 style={{ margin:0 }}>{theme?.title || 'Session'}</h2>
        <div className="small">Fais de ton mieux. Objectif : régularité 🙂</div>
      </div>

      <RewardsHeader rewards={liveRewards} />

      {npcStartLine && !lessonReminder?.content && (
        <div className="card mc-card" style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
          <div style={{ fontSize:'2rem' }}>{npcGuide.avatar}</div>
          <div>
            <div className="small" style={{ color:'var(--mc-muted)' }}>{npcGuide.name}</div>
            <div style={{ fontWeight:800 }}>{npcStartLine.text}</div>
          </div>
        </div>
      )}

      {lessonReminder?.content && (
        <LessonReminder
          title={lessonReminder.title}
          content={lessonReminder.content}
          lessonRef={lessonReminder.lessonRef}
          mode={lessonReminder.mode || 'full'}
          npcGuide={npcStartLine ? {
            avatar: npcGuide.avatar,
            name: npcGuide.name,
            line: npcStartLine.text,
            ctaLabel: npcStartLine.cta?.action === 'open_lesson' ? npcStartLine.cta.label : undefined,
            onCta: npcStartLine.cta?.action === 'open_lesson'
              ? () => setLessonReminder(prev => prev ? { ...prev, mode: 'contextual' } : prev)
              : undefined,
          } : null}
        />
      )}

      {errorMsg && (
        <div className="card" style={{ background:'rgba(255,90,111,0.08)', border:'1px solid rgba(255,90,111,0.4)' }}>
          <div className="small">{errorMsg}</div>
        </div>
      )}

      {exos.length === 0 && (
        <div className="card">
          <div className="small">Aucune question publiée pour ce bloc. Essaie un autre bloc ou reviens après la modération.</div>
        </div>
      )}

      {exos.map((ex, idx) => {
        const readingCtx = (ex as any).readingContext
        const showReading = readingCtx && (idx === 0 || (exos[idx - 1] as any).readingContext?.readingId !== readingCtx.readingId)
        return (
          <div className="card" key={ex.id}>
            {showReading && readingCtx && (
              <div style={{ marginBottom: 10 }}>
                <div className="small" style={{ marginBottom: 4 }}>Lecture : {readingCtx.title}</div>
                <div className="small" dangerouslySetInnerHTML={{ __html: markdownToHtml(readingCtx.text || '') }} />
                <hr />
              </div>
            )}
            <div className="small">Question {idx + 1} / {exos.length} <span className="badge">Difficulté {ex.difficulty}</span></div>
            <div style={{ fontWeight: 800, marginTop: 6 }} dangerouslySetInnerHTML={{ __html: markdownToHtml(ex.prompt || '') }} />

            {ex.type === 'mcq' && (
              <div className="grid" style={{ marginTop: 10 }}>
                {(ex as ExerciseMCQ).choices.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    className={"btn " + ((answers[ex.id] === i) ? '' : 'secondary')}
                    onClick={() => setAnswers(a => ({ ...a, [ex.id]: i }))}
                    style={{ textAlign: 'left', opacity: answers[ex.id] === i ? 1 : 0.85 }}
                    aria-pressed={answers[ex.id] === i}
                  >
                    <span dangerouslySetInnerHTML={{ __html: markdownToHtml(c || '') }} />
                  </button>
                ))}
              </div>
            )}

            {(ex.type === 'short_text') && (
              <div style={{ marginTop: 10 }}>
                <input
                  className="input"
                  placeholder="Ta réponse…"
                  value={answers[ex.id] ?? ''}
                  onChange={(e) => setAnswers(a => ({ ...a, [ex.id]: e.target.value }))}
                />
              </div>
            )}

            {(ex.type === 'fill_blank') && (
              <div style={{ marginTop: 10 }}>
                <div className="small" dangerouslySetInnerHTML={{ __html: markdownToHtml((ex as ExerciseFillBlank).text || '') }} />
                <input
                  className="input"
                  placeholder="Le mot manquant…"
                  value={answers[ex.id] ?? ''}
                  onChange={(e) => setAnswers(a => ({ ...a, [ex.id]: e.target.value }))}
                />
              </div>
            )}
          </div>
        )
      })}

      <div className="card">
        <div className="row">
          <button className="btn" onClick={submit}>Corriger et enregistrer</button>
          {result && (
            <div className="small">
              Score <strong>{result.score}/{result.outOf}</strong> · {result.durationSec}s
            </div>
          )}
        </div>
        {result?.badges?.length ? (
          <div className="row" style={{ marginTop: 10 }}>
            {result.badges.map((b: string) => <span key={b} className="badge">{b}</span>)}
          </div>
        ) : null}
        {weakTags.length ? (
          <div className="small" style={{ marginTop: 10 }}>
            Tags à renforcer (thème) : {weakTags.map(t => <span key={t} className="badge">{t}</span>)}
          </div>
        ) : null}
      </div>

      {feedback.length ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Corrections</h3>
          {errorMsg && <div className="small" style={{ color:'#ff5a6f', marginBottom: 8 }}>{errorMsg}</div>}
          <div className="grid">
            {feedback.map(f => (
              <div key={f.id} className="pill" style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:6 }}>
                <div className="small">Question {f.idx} • {f.correct ? <span className="badge">✔️ Bonne réponse</span> : <span className="badge">❌ Mauvaise réponse</span>}</div>
                <div style={{ fontWeight: 700 }}>{f.prompt}</div>
                <div className="small">Ta réponse : <strong>{f.userAnswer}</strong></div>
                {!f.correct && (
                  <>
                    <div className="small">Correction : <strong>{f.expected}</strong></div>
                    {f.npcLine && (
                      <div className="pill" style={{
                        marginTop: 6,
                        display:'flex',
                        gap:8,
                        alignItems:'flex-start',
                        background:'rgba(122,162,255,0.08)',
                        border:'1px solid rgba(122,162,255,0.35)'
                      }}>
                        <div style={{ fontSize:'1.4rem' }}>{npcGuide.avatar}</div>
                        <div>
                          <div className="small" style={{ color:'var(--mc-muted)' }}>{npcGuide.name}</div>
                          <div className="small" style={{ fontWeight:700 }}>{f.npcLine.text}</div>
                          {f.npcLine.cta?.action === 'open_lesson' && f.packLesson && (
                            <button
                              className="mc-button secondary"
                              style={{ marginTop: 6, padding:'4px 8px', fontSize:'0.8rem' }}
                              onClick={() => setOpenLessonByQuestion(prev => ({ ...prev, [f.id]: true }))}
                            >
                              {f.npcLine.cta.label}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {f.explanation && <div className="small" style={{ marginTop: 4 }}>Explication : {f.explanation}</div>}
                    {f.packLesson && (
                      <div className="small" style={{ marginTop: 6 }}>
                        <button
                          className="btn secondary"
                          style={{ padding:'4px 8px', fontSize: '0.8rem' }}
                          onClick={() => setOpenLessonByQuestion(prev => ({ ...prev, [f.id]: !prev[f.id] }))}
                        >
                          {openLessonByQuestion[f.id] ? 'Masquer le rappel' : 'Voir le rappel de leçon'}
                        </button>
                        {openLessonByQuestion[f.id] && (
                          <div className="pill" style={{ marginTop: 6 }}>
                            <div className="small" style={{ color:'var(--mc-muted)' }}>
                              {f.packLessonTitle || 'Leçon'}
                            </div>
                            {(() => {
                              const section = f.lessonRef ? extractLessonSection(f.packLesson || '', f.lessonRef) : null
                              const html = markdownToHtml(section?.markdown || f.packLesson || '')
                              return (
                                <>
                                  {section?.title && <div style={{ fontWeight: 700 }}>{section.title}</div>}
                                  <div className="small" dangerouslySetInnerHTML={{ __html: html }} />
                                </>
                              )
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
