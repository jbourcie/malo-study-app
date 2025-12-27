import { NPC_CATALOG, type NpcId } from './npcCatalog'
import { pickNpcLine, type ReasonCode } from './npcLines'
import { getBlockDef } from '../blockCatalog'
import { subjectToBiomeId } from '../biomeCatalog'
import { shouldRepair } from '../../pedagogy/questionSelector'
import { inferSubject } from '../../taxonomy/tagCatalog'

export type ExpeditionType = 'mine' | 'repair' | 'craft'

export type NpcRecommendation = {
  npcId: NpcId
  title: string
  message: string
  reasonCode: ReasonCode
  expedition: {
    type: ExpeditionType
    biomeId: string
    targetTagId: string
    secondaryTagIds?: string[]
    estimatedMinutes: number
  }
}

const PRIORITY_TAGS = [
  'math_fractions_addition',
  'math_fractions_soustraction',
  'math_fractions_equivalentes',
  'fr_grammaire_phrase_simple_complexe',
  'fr_grammaire_proposition_relative',
  'fr_grammaire_negation',
  'fr_conjugaison_present',
  'fr_comprehension_inference',
  'fr_comprehension_idee_principale',
]

function formatDateKeyParis(ts: number): string {
  try {
    const d = new Date(ts)
    const parts = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
    const y = parts.find(p => p.type === 'year')?.value
    const m = parts.find(p => p.type === 'month')?.value
    const day = parts.find(p => p.type === 'day')?.value
    if (y && m && day) return `${y}-${m}-${day}`
  } catch {
    // fallback
  }
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function lastTsForTag(history: Array<{ tagIds: string[]; correct: boolean; ts: number }>, tagId: string): number {
  let max = 0
  history.forEach(h => {
    if (h.tagIds?.includes(tagId)) {
      max = Math.max(max, h.ts || 0)
    }
  })
  return max
}

function lastIncorrectTs(history: Array<{ tagIds: string[]; correct: boolean; ts: number }>, tagId: string): number {
  let max = 0
  history.forEach(h => {
    if (h.tagIds?.includes(tagId) && !h.correct) {
      max = Math.max(max, h.ts || 0)
    }
  })
  return max
}

export function buildNpcRecommendation(params: {
  npcId: NpcId
  masteryByTag: Record<string, { state: 'discovering' | 'progressing' | 'mastered' }>
  history: Array<{ tagIds: string[]; correct: boolean; ts: number }>
  nowTs: number
}): NpcRecommendation | null {
  const { npcId, masteryByTag, history, nowTs } = params
  const dateKey = formatDateKeyParis(nowTs)
  const tagIds = Object.keys(masteryByTag || {})
  const poolSet = new Set([...tagIds, ...history.flatMap(h => h.tagIds || [])])
  const pool = Array.from(poolSet)

  // Step 1: repair
  const repairable = pool.filter(tag => shouldRepair(tag, history))
  const priorityRepair = repairable.find(tag => PRIORITY_TAGS.includes(tag)) || null
  const bestRepair = priorityRepair || repairable.sort((a, b) => (lastIncorrectTs(history, b) - lastIncorrectTs(history, a)))[0]
  if (bestRepair) {
    const biomeId = getBlockDef(bestRepair).biomeId || subjectToBiomeId(inferSubject(bestRepair))
    return {
      npcId,
      title: `Mission de ${NPC_CATALOG[npcId].name}`,
      message: pickNpcLine({ npcId, reason: 'repair', dateKey }),
      reasonCode: 'repair',
      expedition: {
        type: 'repair',
        biomeId,
        targetTagId: bestRepair,
        estimatedMinutes: 10,
      },
    }
  }

  // Step 2: priority mine
  const notMasteredPriority = PRIORITY_TAGS.find(tag => (masteryByTag[tag]?.state || 'discovering') !== 'mastered')
  const discovering = pool.find(tag => (masteryByTag[tag]?.state || 'discovering') === 'discovering')
  const mineTag = notMasteredPriority || discovering
  if (mineTag) {
    const biomeId = getBlockDef(mineTag).biomeId || subjectToBiomeId(inferSubject(mineTag))
    return {
      npcId,
      title: `Mission de ${NPC_CATALOG[npcId].name}`,
      message: pickNpcLine({ npcId, reason: 'priority', dateKey }),
      reasonCode: 'priority',
      expedition: {
        type: 'mine',
        biomeId,
        targetTagId: mineTag,
        estimatedMinutes: 10,
      },
    }
  }

  // Step 3: spaced mine
  const fiveDays = 5 * 24 * 60 * 60 * 1000
  const spaced = pool
    .map(tag => ({ tag, last: lastTsForTag(history, tag) }))
    .filter(t => t.last > 0 && nowTs - t.last > fiveDays)
    .sort((a, b) => a.last - b.last)
  const spacedTag = spaced.find(t => (masteryByTag[t.tag]?.state || 'discovering') !== 'mastered') || spaced[0]
  if (spacedTag) {
    const biomeId = getBlockDef(spacedTag.tag).biomeId || subjectToBiomeId(inferSubject(spacedTag.tag))
    return {
      npcId,
      title: `Mission de ${NPC_CATALOG[npcId].name}`,
      message: pickNpcLine({ npcId, reason: 'spaced', dateKey }),
      reasonCode: 'spaced',
      expedition: {
        type: 'mine',
        biomeId,
        targetTagId: spacedTag.tag,
        estimatedMinutes: 8,
      },
    }
  }

  // Step 4: craft
  const progressTags = pool.filter(tag => {
    const st = masteryByTag[tag]?.state || 'discovering'
    return st === 'progressing' || st === 'mastered'
  })
  const bySubject = new Map<string, string[]>()
  progressTags.forEach(tag => {
    const subj = inferSubject(tag)
    bySubject.set(subj, [...(bySubject.get(subj) || []), tag])
  })
  let craftPair: string[] | null = null
  for (const [, tags] of bySubject) {
    if (tags.length >= 2) {
      craftPair = tags.slice(0, 2)
      break
    }
  }
  if (craftPair) {
    const biomeId = getBlockDef(craftPair[0]).biomeId || subjectToBiomeId(inferSubject(craftPair[0]))
    return {
      npcId,
      title: `Mission de ${NPC_CATALOG[npcId].name}`,
      message: pickNpcLine({ npcId, reason: 'craft', dateKey }),
      reasonCode: 'craft',
      expedition: {
        type: 'craft',
        biomeId,
        targetTagId: craftPair[0],
        secondaryTagIds: [craftPair[1]],
        estimatedMinutes: 13,
      },
    }
  }

  return null
}

export { formatDateKeyParis }
