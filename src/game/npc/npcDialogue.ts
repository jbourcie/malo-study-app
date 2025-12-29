import { NPC_CATALOG, type NpcId } from './npcCatalog'
import { pickNpcLine, type ReasonCode } from './npcLines'
import type { SessionXpBreakdown, MasteryState } from '../../rewards/rewards'

export type NpcEvent = 'daily_quest' | 'session_start' | 'wrong_answer' | 'session_end' | 'streak_praise'

export type NpcDialogueLine = {
  text: string
  tone?: string
  cta?: { label: string, action: 'open_lesson' | 'open_streak' }
}

export type NpcDialogueContext = {
  reasonCode?: ReasonCode
  blockId?: string | null
  blockLabel?: string | null
  masteryState?: MasteryState | null
  successRate?: number | null
  xpBreakdown?: SessionXpBreakdown | null
  lessonRef?: string | null
  lessonAvailable?: boolean
  streak?: number | null
  sessionId?: string | null
  questionId?: string | null
}

type DialogueEntry = (ctx: NpcDialogueContext) => string

type DialoguePools = Record<NpcId, {
  session_start: DialogueEntry[]
  wrong_answer: DialogueEntry[]
  session_end: DialogueEntry[]
  streak_praise: DialogueEntry[]
}>

const STORAGE_PREFIX = 'malocraft.npc.dialogue'

const NPC_DIALOGUE_LINES: DialoguePools = {
  scout: {
    session_start: [
      (ctx) => `On vise ${ctx.blockLabel || 'le bloc du jour'}. Objectif rapide, je reste à côté si tu veux un rappel.`,
      (ctx) => `Je trace le chemin vers ${ctx.blockLabel || 'le bloc cible'}. On démarre tranquille et on ajuste.`,
      () => 'On commence calmement, tu peux ouvrir le rappel dès que tu sens un doute.',
      () => 'Briefing express : on avance, on observe, on corrige vite si besoin.',
    ],
    wrong_answer: [
      (ctx) => `Pas grave, on note ce point sur ${ctx.blockLabel || 'le bloc'} et on repart.`,
      () => 'On ajuste et on retente. Regarde l’astuce si tu bloques.',
      () => 'On cale le bon réflexe et on continue. Tu peux ouvrir le rappel.',
      () => 'Petite embûche, on la contourne ensemble. Un coup d’œil au rappel ?',
    ],
    session_end: [
      (ctx) => {
        const rate = ctx.successRate != null ? `${ctx.successRate}%` : null
        return `Session terminée${rate ? ` (${rate})` : ''}. On consolide ${ctx.blockLabel || 'le bloc ciblé'} et on garde l’élan.`
      },
      (ctx) => {
        const xp = ctx.xpBreakdown?.base ?? null
        return `Bilan rapide : ${ctx.blockLabel || 'bloc'} en cours, ${xp != null ? `${xp} XP base` : 'XP gagné'}. On continue demain.`
      },
      () => 'Fin de session notée. On debrief et on repartira plus haut la prochaine fois.',
    ],
    streak_praise: [
      () => 'Belle série ! On garde ce rythme.',
      () => 'Trois bonnes réponses d’affilée, on continue sur cette lancée.',
    ],
  },
  robot: {
    session_start: [
      (ctx) => `Chargement du plan sur ${ctx.blockLabel || 'le bloc cible'}. Je garde le rappel prêt au besoin.`,
      () => 'Séquence démarrage : questions courtes, validation rapide.',
      (ctx) => `Objectif clair : sécuriser ${ctx.blockLabel || 'le bloc'}. On mesure et on ajuste.`,
      () => 'Checklist prête. Si un doute, on ouvre le rappel contextualisé.',
    ],
    wrong_answer: [
      () => 'Écart détecté. Consulter l’astuce peut corriger la trajectoire.',
      () => 'Correction appliquée. Un rappel rapide est disponible.',
      () => 'On stabilise : lis l’explication puis l’astuce si besoin.',
      () => 'Erreur notée, on met à jour le modèle et on continue.',
    ],
    session_end: [
      (ctx) => {
        const rate = ctx.successRate != null ? `${ctx.successRate}%` : ''
        return `Session clôturée. ${ctx.blockLabel ? `${ctx.blockLabel} stabilisé` : 'Bloc stabilisé'} ${rate ? `(${rate})` : ''}.`
      },
      (ctx) => {
        const xp = ctx.xpBreakdown?.completion ?? null
        return `Résultat : progression enregistrée${xp != null ? `, +${xp} XP session` : ''}. Prochaine étape planifiée.`
      },
      () => 'Fin du cycle. Les données de progression sont à jour.',
    ],
    streak_praise: [
      () => 'Série validée. Continuer sur ce pattern est optimal.',
      () => 'Trois succès consécutifs : modèle stable.',
    ],
  },
  goblin: {
    session_start: [
      (ctx) => `On saute sur ${ctx.blockLabel || 'le bloc du jour'} ! Si tu coinces, j’ai une astuce prête.`,
      () => 'Allez, on démarre. Je glisse un rappel si ça bloque.',
      (ctx) => `On attaque ${ctx.blockLabel || 'ce bloc'} en mode malin. Tu peux appeler l’astuce à tout moment.`,
      () => 'On teste, on rigole, on corrige vite si ça dérape.',
    ],
    wrong_answer: [
      () => 'Oups ! Lis l’explication et je te montre l’astuce si tu veux.',
      () => 'Pas de panique, on ajuste. L’astuce est juste là.',
      () => 'On rebondit ! Clique sur l’astuce et on repart.',
      () => 'Erreur gobeline repérée, on la retourne avec le rappel.',
    ],
    session_end: [
      (ctx) => {
        const rate = ctx.successRate != null ? `${ctx.successRate}%` : null
        return `Session pliée${rate ? ` (${rate})` : ''} ! ${ctx.blockLabel ? `${ctx.blockLabel} avance` : 'Le bloc avance'}.`
      },
      (ctx) => {
        const xp = ctx.xpBreakdown?.base ?? null
        return `XP en poche${xp != null ? ` (+${xp} base)` : ''}. On fête ça et on revient demain.`
      },
      () => 'Fin de run. On garde l’énergie pour la suite !',
    ],
    streak_praise: [
      () => 'Belle série, tu crames la piste !',
      () => 'Triplé réussi. On enchaîne ?',
    ],
  },
}

function storageKey(npcId: NpcId, event: NpcEvent) {
  return `${STORAGE_PREFIX}.${npcId}.${event}`
}

function loadRecent(npcId: NpcId, event: NpcEvent): number[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(storageKey(npcId, event))
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((n: any) => typeof n === 'number') : []
  } catch {
    return []
  }
}

function saveRecent(npcId: NpcId, event: NpcEvent, indices: number[]) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(storageKey(npcId, event), JSON.stringify(indices.slice(-3)))
}

function pickWithMemory(params: { npcId: NpcId, event: NpcEvent, pool: DialogueEntry[] }): DialogueEntry | null {
  const { npcId, event, pool } = params
  if (!pool.length) return null
  const recent = loadRecent(npcId, event)
  let chosen = 0
  for (let attempt = 0; attempt < 5; attempt++) {
    const idx = Math.floor(Math.random() * pool.length)
    if (!recent.includes(idx) || attempt === 4) {
      chosen = idx
      break
    }
  }
  saveRecent(npcId, event, [...recent, chosen])
  return pool[chosen]
}

export function getNpcLine(npcId: NpcId, event: NpcEvent, context: NpcDialogueContext = {}): NpcDialogueLine {
  if (event === 'daily_quest') {
    const reason = context.reasonCode || 'priority'
    return {
      text: pickNpcLine({ npcId, reason, dateKey: new Date().toISOString().slice(0, 10) }),
      tone: NPC_CATALOG[npcId].tone,
    }
  }

  const pool = NPC_DIALOGUE_LINES[npcId]?.[event] || []
  const entry = pickWithMemory({ npcId, event, pool })
  const text = entry ? entry(context) : 'Je reste dispo si tu veux un rappel.'
  const cta = event === 'wrong_answer' && context.lessonAvailable ? { label: 'Voir l’astuce', action: 'open_lesson' as const } : undefined
  return { text, tone: NPC_CATALOG[npcId].tone, cta }
}
