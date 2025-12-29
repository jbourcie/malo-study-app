import { getTagMeta, type SubjectId } from '../../taxonomy/tagCatalog'
import type { UserRewards } from '../../rewards/rewards'
import type { BiomeId } from '../biomeCatalog'
import type { BiomeVisualState, ZoneVisualState } from '../visualProgress'

/**
 * Audit rapide (phase 2 — pt7)
 * - PNJ guide rendu via <NpcGuideCard /> sur HomePage (quêtes journalières existantes).
 * - États visuels + rebuild calculés dans src/game/visualProgress.ts et affichés sur WorldMapPage/BiomePage/ZonePage.
 * - Sessions ciblées : expéditions classiques (/theme/expedition), reconstruction zone/biome via sessionKind reconstruction_theme / reconstruction_biome.
 */

export type NpcGuideActionType = 'reconstruction_theme' | 'reconstruction_biome' | 'tag_session' | 'explore'

export type NpcGuideDecision = {
  adviceId: string
  messageKey: string
  message: string
  ctaLabel: string
  actionType: NpcGuideActionType
  payload?: {
    theme?: string
    tagId?: string
    expeditionType?: 'mine' | 'repair'
  }
}

export type LastAdvice = {
  adviceId: string
  actionType: NpcGuideActionType
  messageKey?: string | null
}

export type NpcGuideAdvisorInput = {
  biomeId: BiomeId
  subjectId: SubjectId
  zones: Array<{ theme: string, tagIds: string[], visual: ZoneVisualState }>
  biomeVisual: BiomeVisualState
  masteryByTag: UserRewards['masteryByTag']
  blockProgress: UserRewards['blockProgress']
  allowedTags?: Set<string>
  seed: string
  lastAdvice?: LastAdvice | null
}

type TagChoice = { tagId: string, score: number, zoneTheme: string | null, zoneState: ZoneVisualState['state'] }
type AdviceOption = {
  adviceId: string
  actionType: NpcGuideActionType
  payload?: NpcGuideDecision['payload']
  messageCode: string
  messageVariants: string[]
  meta?: { zoneState?: ZoneVisualState['state'], score?: number }
}

const messageVariants: Record<string, string[]> = {
  zone_rebuild: [
    'Cette zone est presque prête. Chaque bonne réponse aide à la reconstruire.',
    'On peut rebâtir cette zone ensemble. Tes réponses consolident les blocs.',
    'Encore un effort et la zone sera reconstruite.'
  ],
  biome_rebuild: [
    'Une grande reconstruction est possible dans ce biome.',
    'Le biome peut renaître : lançons la reconstruction.',
    'C’est le moment de réparer tout le biome.'
  ],
  remediation: [
    'Ce bloc est fragile. Le réparer aidera tout le biome.',
    'On répare ce bloc avant qu’il ne s’effondre.',
    'Ce bloc fissuré a besoin de toi.'
  ],
  progression: [
    'Continuons ce bloc pour stabiliser la zone.',
    'On avance sur ce bloc pour faire progresser le biome.',
    'Encore un peu de travail sur ce bloc.'
  ],
  fallback: [
    'Tu peux choisir ce que tu veux travailler.',
    'Libre à toi d’explorer le biome.',
    'Choisis le bloc qui t’inspire aujourd’hui.'
  ],
}

function pickScore(tagId: string, masteryByTag: UserRewards['masteryByTag'], blockProgress: UserRewards['blockProgress']): number {
  const masteryScore = masteryByTag?.[tagId]?.score
  const progressScore = (blockProgress as any)?.[tagId]?.score ?? (blockProgress as any)?.[tagId]?.masteryScore
  const score = typeof masteryScore === 'number' ? masteryScore : typeof progressScore === 'number' ? progressScore : 0
  if (Number.isNaN(score)) return 0
  return Math.max(0, Math.min(100, Math.round(score)))
}

function isZoneAllowed(zoneTags: string[], allowed: Set<string> | undefined): boolean {
  if (!allowed || allowed.size === 0) return true
  return zoneTags.some(t => allowed.has(t))
}

function findTagChoices(zones: NpcGuideAdvisorInput['zones'], rewards: Pick<NpcGuideAdvisorInput, 'masteryByTag' | 'blockProgress'>, allowed: Set<string> | undefined): TagChoice[] {
  const tags: TagChoice[] = []
  zones.forEach((zone) => {
    zone.tagIds.forEach((tagId) => {
      if (allowed && allowed.size && !allowed.has(tagId)) return
      const score = pickScore(tagId, rewards.masteryByTag, rewards.blockProgress)
      tags.push({ tagId, score, zoneTheme: zone.theme, zoneState: zone.visual.state })
    })
  })
  return tags
}

export function buildEligibleOptions(input: NpcGuideAdvisorInput): AdviceOption[] {
  const allowed = input.allowedTags && input.allowedTags.size ? input.allowedTags : undefined
  const tagChoices = findTagChoices(input.zones, input, allowed)
  const options: AdviceOption[] = []

  input.zones.forEach((z) => {
    const allowedZone = isZoneAllowed(z.tagIds, allowed)
    if (!allowedZone) return
    if (z.visual.state === 'rebuilt_ready' || z.visual.state === 'rebuilding') {
      options.push({
        adviceId: `zone_rebuild_${input.subjectId}__${z.theme}`,
        actionType: 'reconstruction_theme',
        payload: { theme: z.theme, expeditionType: 'repair' },
        messageCode: 'zone_rebuild',
        messageVariants: messageVariants.zone_rebuild,
        meta: { zoneState: z.visual.state },
      })
    }
  })

  const biomeRebuild = input.biomeVisual.rebuild
  const biomeProgress = biomeRebuild?.correctCount || 0
  const biomeTarget = biomeRebuild?.target || 100
  const biomeReady = biomeRebuild && (biomeRebuild.status === 'ready' || biomeRebuild.status === 'rebuilding') && biomeProgress < biomeTarget
  if (biomeReady) {
    options.push({
      adviceId: `biome_rebuild_${input.subjectId}`,
      actionType: 'reconstruction_biome',
      payload: { expeditionType: 'repair' },
      messageCode: 'biome_rebuild',
      messageVariants: messageVariants.biome_rebuild,
      meta: { zoneState: biomeRebuild.status },
    })
  }

  const remediationTargets = tagChoices.filter(t => t.score < 50)
  remediationTargets.forEach((t) => {
    const meta = getTagMeta(t.tagId)
    options.push({
      adviceId: `remediate_${t.tagId}`,
      actionType: 'tag_session',
      payload: { tagId: t.tagId, expeditionType: 'repair' },
      messageCode: 'remediation',
      messageVariants: messageVariants.remediation.map(msg => msg.replace('ce bloc', meta?.label || 'ce bloc')),
      meta: { score: t.score, zoneState: t.zoneState },
    })
  })

  const progressionTargets = tagChoices.filter(t => t.score >= 30 && t.score < 80 && t.zoneState !== 'rebuilt')
  progressionTargets.forEach((t) => {
    const meta = getTagMeta(t.tagId)
    options.push({
      adviceId: `progress_${t.tagId}`,
      actionType: 'tag_session',
      payload: { tagId: t.tagId, expeditionType: 'mine' },
      messageCode: 'progression',
      messageVariants: messageVariants.progression.map(msg => msg.replace('ce bloc', meta?.label || 'ce bloc')),
      meta: { score: t.score, zoneState: t.zoneState },
    })
  })

  options.push({
    adviceId: `explore_${input.subjectId}`,
    actionType: 'explore',
    messageCode: 'fallback',
    messageVariants: messageVariants.fallback,
  })

  return options
}

function getBaseWeights(hasThemeRebuild: boolean, themeRebuilding: boolean): Record<'theme' | 'remediation' | 'progress' | 'biome' | 'fallback', number> {
  if (hasThemeRebuild && themeRebuilding) {
    return { theme: 0.55, remediation: 0.20, progress: 0.20, biome: 0.05, fallback: 0.05 }
  }
  if (hasThemeRebuild) {
    return { theme: 0.45, remediation: 0.25, progress: 0.25, biome: 0.05, fallback: 0.05 }
  }
  return { theme: 0.20, remediation: 0.25, progress: 0.30, biome: 0.15, fallback: 0.10 }
}

export function computeWeights(options: AdviceOption[], biomeVisual: BiomeVisualState): Map<string, number> {
  const hasThemeRebuild = options.some(o => o.actionType === 'reconstruction_theme')
  const anyRebuilding = options.some(o => o.actionType === 'reconstruction_theme' && o.meta?.zoneState === 'rebuilding')
  const base = getBaseWeights(hasThemeRebuild, anyRebuilding)
  const biomeRebuild = biomeVisual.rebuild
  const biomeProgress = biomeRebuild?.correctCount || 0
  const biomeTarget = biomeRebuild?.target || 100
  const biomeReady = biomeRebuild && (biomeRebuild.status === 'ready' || biomeRebuild.status === 'rebuilding') && biomeProgress < biomeTarget
  let biomeWeight = biomeReady ? base.biome : 0
  if (biomeReady && biomeTarget) {
    const pct = (biomeProgress / biomeTarget) * 100
    if (pct >= 90) biomeWeight *= 2
    else if (pct >= 70) biomeWeight *= 1.5
  }

  const byCategory: Record<'theme' | 'remediation' | 'progress' | 'biome' | 'fallback', AdviceOption[]> = {
    theme: [],
    remediation: [],
    progress: [],
    biome: [],
    fallback: [],
  }
  options.forEach((opt) => {
    if (opt.actionType === 'reconstruction_theme') byCategory.theme.push(opt)
    else if (opt.actionType === 'reconstruction_biome') byCategory.biome.push(opt)
    else if (opt.actionType === 'tag_session' && opt.adviceId.startsWith('remediate_')) byCategory.remediation.push(opt)
    else if (opt.actionType === 'tag_session' && opt.adviceId.startsWith('progress_')) byCategory.progress.push(opt)
    else byCategory.fallback.push(opt)
  })

  const weightMap = new Map<string, number>()
  const distribute = (opts: AdviceOption[], weight: number) => {
    if (!opts.length || weight <= 0) return
    const per = weight / opts.length
    opts.forEach(o => weightMap.set(o.adviceId, per))
  }

  distribute(byCategory.theme, base.theme)
  distribute(byCategory.remediation, base.remediation)
  distribute(byCategory.progress, base.progress)
  distribute(byCategory.biome, biomeWeight)
  distribute(byCategory.fallback, base.fallback)

  const total = Array.from(weightMap.values()).reduce((acc, v) => acc + v, 0)
  if (total === 0 && options.length) {
    const per = 1 / options.length
    options.forEach(o => weightMap.set(o.adviceId, per))
    return weightMap
  }

  // Renormalise sur les options réellement éligibles
  if (total > 0) {
    options.forEach((o) => {
      const w = weightMap.get(o.adviceId) || 0
      weightMap.set(o.adviceId, w / total)
    })
  }

  return weightMap
}

// fnv1a hash string -> uint32
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function mulberry32(a: number): () => number {
  return function() {
    let t = a += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function weightedRandom(options: AdviceOption[], weights: Map<string, number>, rng: () => number): AdviceOption {
  const entries = options.map(o => ({ opt: o, w: weights.get(o.adviceId) ?? 0 }))
  const total = entries.reduce((acc, e) => acc + e.w, 0)
  if (total <= 0) return options[0]
  const r = rng() * total
  let acc = 0
  for (const e of entries) {
    acc += e.w
    if (r <= acc) return e.opt
  }
  return entries[entries.length - 1].opt
}

function withAntiRepeatPenalty(options: AdviceOption[], weights: Map<string, number>, lastAdvice?: LastAdvice | null): Map<string, number> {
  if (!lastAdvice) return weights
  const penalized = new Map(weights)
  const targetIds = options.filter(o => o.adviceId === lastAdvice.adviceId || o.actionType === lastAdvice.actionType).map(o => o.adviceId)
  if (!targetIds.length) return weights
  targetIds.forEach(id => {
    const w = penalized.get(id)
    if (typeof w === 'number') penalized.set(id, w * 0.25)
  })
  const total = Array.from(penalized.values()).reduce((acc, v) => acc + v, 0)
  if (total === 0) return weights
  penalized.forEach((v, key) => penalized.set(key, v / total))
  return penalized
}

export function weightedPick(options: AdviceOption[], weights: Map<string, number>, rng: () => number, lastAdvice?: LastAdvice | null): AdviceOption {
  if (!options.length) {
    throw new Error('No options available for NPC advisor')
  }
  if (options.length === 1) return options[0]

  const initial = weightedRandom(options, weights, rng)
  const isRepeat = lastAdvice && (initial.adviceId === lastAdvice.adviceId || initial.actionType === lastAdvice.actionType)
  if (!isRepeat) return initial

  const penalized = withAntiRepeatPenalty(options, weights, lastAdvice)
  const second = weightedRandom(options, penalized, rng)
  return second
}

export function adviseNpcAction(input: NpcGuideAdvisorInput): NpcGuideDecision {
  const options = buildEligibleOptions(input)
  const weights = computeWeights(options, input.biomeVisual)
  const seedValue = hashSeed(input.seed)
  const rng = mulberry32(seedValue || 1)
  const chosen = weightedPick(options, weights, rng, input.lastAdvice)
  const previousKey = input.lastAdvice?.messageKey || null

  const messageFromKey = (key: string | null | undefined) => {
    if (!key || !key.startsWith(`${chosen.messageCode}:`)) return null
    const idx = Number(key.split(':')[1] || 0)
    if (!Number.isFinite(idx) || idx < 0 || idx >= chosen.messageVariants.length) return null
    return { messageKey: key, message: chosen.messageVariants[idx] }
  }

  const reuseSameAdvice = input.lastAdvice?.adviceId === chosen.adviceId ? messageFromKey(previousKey) : null
  const { messageKey, message } = reuseSameAdvice || (() => {
    if (chosen.messageVariants.length === 0) return { messageKey: `${chosen.messageCode}:0`, message: '' }
    let idx = 0
    if (previousKey?.startsWith(`${chosen.messageCode}:`)) {
      const prev = Number(previousKey.split(':')[1] || 0)
      if (Number.isFinite(prev) && prev >= 0) idx = (prev + 1) % chosen.messageVariants.length
    }
    return { messageKey: `${chosen.messageCode}:${idx}`, message: chosen.messageVariants[idx] }
  })()
  return {
    adviceId: chosen.adviceId,
    messageKey,
    message,
    ctaLabel:
      chosen.actionType === 'reconstruction_theme'
        ? 'Continuer la reconstruction'
        : chosen.actionType === 'reconstruction_biome'
          ? 'Reconstruire le biome'
          : chosen.actionType === 'tag_session' && chosen.payload?.expeditionType === 'repair'
            ? 'Réparer ce bloc'
            : chosen.actionType === 'tag_session'
              ? 'Continuer la progression'
              : 'Explorer le biome',
    actionType: chosen.actionType,
    payload: chosen.payload,
  }
}
