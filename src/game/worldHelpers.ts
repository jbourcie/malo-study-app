import type { BiomeId } from './biomeCatalog'
import { getBlocksForBiome } from './blockCatalog'
import type { MasteryState, UserRewards } from '../rewards/rewards'

export function getAllTagIdsForBiome(biomeId: BiomeId): string[] {
  return getBlocksForBiome(biomeId).map(block => block.tagId)
}

export function getMasteryState(
  masteryByTag: UserRewards['masteryByTag'] | undefined,
  tagId: string
): MasteryState {
  return (masteryByTag?.[tagId]?.state || 'discovering') as MasteryState
}

export function stateToUiLabel(state: MasteryState): string {
  switch (state) {
    case 'mastered':
      return 'Brillant'
    case 'progressing':
      return 'Solide'
    default:
      return 'Fissuré'
  }
}
