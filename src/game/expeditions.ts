import type { BiomeId } from './biomeCatalog'
import type { MasteryState } from '../rewards/rewards'

export type ExpeditionType = 'mine' | 'repair' | 'craft'

export type Expedition = {
  type: ExpeditionType
  biomeId: BiomeId
  targetTagId: string
  secondaryTagIds?: string[]
  estimatedMinutes: number
  recommended?: boolean
}

export function getAvailableExpeditionsForBlock(opts: {
  tagId: string
  biomeId: BiomeId
  masteryState: MasteryState
  shouldRepair: boolean
}): Expedition[] {
  const { tagId, biomeId, masteryState, shouldRepair } = opts
  const expeditions: Expedition[] = []

  expeditions.push({
    type: 'mine',
    biomeId,
    targetTagId: tagId,
    estimatedMinutes: 10,
    recommended: false,
  })

  if (shouldRepair) {
    expeditions.push({
      type: 'repair',
      biomeId,
      targetTagId: tagId,
      estimatedMinutes: 8,
      recommended: true,
    })
  }

  if (masteryState !== 'discovering') {
    expeditions.push({
      type: 'craft',
      biomeId,
      targetTagId: tagId,
      estimatedMinutes: 12,
      recommended: false,
    })
  }

  // ensure only one recommended
  let recommendedSet = false
  expeditions.forEach(exp => {
    if (exp.recommended && !recommendedSet) {
      recommendedSet = true
    } else {
      exp.recommended = false
    }
  })

  if (!recommendedSet && expeditions.length) {
    expeditions[0].recommended = true
  }

  return expeditions
}
