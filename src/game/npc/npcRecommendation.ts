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

export const PRIORITY_TAGS = [
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

function pickWeighted<T>(items: T[], weightFn: (item: T) => number): T | null {
  const weighted = items.map(item => ({ item, w: Math.max(0, weightFn(item)) }))
  const total = weighted.reduce((acc, cur) => acc + cur.w, 0)
  if (!total) return items[0] || null
  const r = Math.random() * total
  let acc = 0
  for (const it of weighted) {
    acc += it.w
    if (r <= acc) return it.item
  }
  return weighted[0]?.item || null
}

export function buildNpcRecommendation(params: {
  npcId: NpcId
  masteryByTag: Record<string, { state: 'discovering' | 'progressing' | 'mastered' }>
  history: Array<{ tagIds: string[]; correct: boolean; ts: number }>
  nowTs: number
  excludeTagIds?: string[]
  availableTagIds?: string[]
}): NpcRecommendation | null {
  const { npcId, masteryByTag, history, nowTs, excludeTagIds = [], availableTagIds } = params
  const dateKey = formatDateKeyParis(nowTs)
  const tagIds = Object.keys(masteryByTag || {})
  const poolSet = new Set([...tagIds, ...history.flatMap(h => h.tagIds || []), ...PRIORITY_TAGS].filter(t => !excludeTagIds.includes(t)))
  const pool = Array.from(poolSet).filter(t => !availableTagIds || availableTagIds.includes(t))
  if (!pool.length) return null

  // Step 1: repair
  const repairable = pool.filter(tag => shouldRepair(tag, history))
  if (repairable.length) {
    const bestRepair = pickWeighted(repairable, (tag) => {
      const priorityBoost = PRIORITY_TAGS.includes(tag) ? 5 : 1
      const recency = Math.max(1, (nowTs - lastIncorrectTs(history, tag)) / (24 * 60 * 60 * 1000))
      return priorityBoost + 2 / recency
    })
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
  }

  // Step 2: priority mine
  const priorityCandidates = PRIORITY_TAGS.filter(tag => !excludeTagIds.includes(tag) && (masteryByTag[tag]?.state || 'discovering') !== 'mastered')
  const discovering = pool.filter(tag => (masteryByTag[tag]?.state || 'discovering') === 'discovering')
  const mineTag = priorityCandidates.length
    ? pickWeighted(priorityCandidates, (tag) => (masteryByTag[tag]?.state === 'discovering' ? 3 : 1))
    : (discovering.length ? pickWeighted(discovering, () => 1) : null)
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
  const spacedTag = spaced.length
    ? pickWeighted(spaced, (t) => {
        const ageDays = Math.max(1, (nowTs - t.last) / (24 * 60 * 60 * 1000))
        const notMasteredBoost = (masteryByTag[t.tag]?.state || 'discovering') !== 'mastered' ? 2 : 1
        return ageDays * notMasteredBoost
      })
    : null
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
  const craftPairs: string[][] = []
  for (const [, tags] of bySubject) {
    if (tags.length >= 2) {
      craftPairs.push(tags.slice(0, 2))
    }
  }
  let craftPair: string[] | null = craftPairs.length ? craftPairs[Math.floor(Math.random() * craftPairs.length)] : null
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
