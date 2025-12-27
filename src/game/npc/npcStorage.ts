import { NpcId } from './npcCatalog'
import { NpcRecommendation, buildNpcRecommendation, formatDateKeyParis } from './npcRecommendation'

const NPC_PREF_KEY = 'malocraft.npc.preferredId'

export function getPreferredNpcId(): NpcId {
  if (typeof localStorage === 'undefined') return 'scout'
  const stored = localStorage.getItem(NPC_PREF_KEY) as NpcId | null
  return (stored === 'robot' || stored === 'goblin' || stored === 'scout') ? stored : 'scout'
}

export function setPreferredNpcId(id: NpcId) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(NPC_PREF_KEY, id)
}

function dailyKey(dateKey: string) {
  return `malocraft.npc.daily.${dateKey}`
}

function rerollKey(dateKey: string) {
  return `malocraft.npc.dailyReroll.${dateKey}`
}

export function getDailyRerollUsed(dateKey: string): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(rerollKey(dateKey)) === '1'
}

export function setDailyRerollUsed(dateKey: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(rerollKey(dateKey), '1')
}

export function getDailyRecommendation(dateKey: string): NpcRecommendation | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(dailyKey(dateKey))
    return raw ? JSON.parse(raw) as NpcRecommendation : null
  } catch {
    return null
  }
}

export function clearDailyRecommendation(dateKey: string) {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(dailyKey(dateKey))
}

export function setDailyRecommendation(dateKey: string, rec: NpcRecommendation) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(dailyKey(dateKey), JSON.stringify(rec))
}

export function getOrCreateDailyRecommendation(params: {
  npcId: NpcId
  masteryByTag: Record<string, { state: 'discovering' | 'progressing' | 'mastered' }>
  history: Array<{ tagIds: string[]; correct: boolean; ts: number }>
  nowTs: number
}): NpcRecommendation | null {
  const dateKey = formatDateKeyParis(params.nowTs)
  const existing = getDailyRecommendation(dateKey)
  if (existing) return existing
  const rec = buildNpcRecommendation(params)
  if (rec) setDailyRecommendation(dateKey, rec)
  return rec
}
