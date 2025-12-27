// MaloCraft blockCatalog.ts
// Génère automatiquement les blocs à partir de la taxonomie (tagCatalog)

import { subjectToBiomeId } from './biomeCatalog'
import { TAG_CATALOG, getTagMeta } from '../taxonomy/tagCatalog'
import type { BiomeId } from './biomeCatalog'

export type BlockDef = {
  tagId: string
  blockName: string
  biomeId: BiomeId
  icon: string
  theme: string
}

const BLOCK_OVERRIDES: Partial<Record<string, Partial<BlockDef>>> = {
  fr_comprehension_inference: {
    blockName: 'Bloc Déduction',
    icon: '🧠',
  },
  math_fractions_addition: {
    blockName: 'Bloc Somme',
    icon: '➕',
  },
}

function buildDefaultBlock(tagId: string): BlockDef {
  const meta = getTagMeta(tagId)
  const blockName = `Bloc ${meta.label}`
  return {
    tagId,
    blockName,
    biomeId: subjectToBiomeId(meta.subject),
    icon: '🧱',
    theme: meta.theme,
  }
}

export function getBlockDef(tagId: string): BlockDef {
  const base = buildDefaultBlock(tagId)
  const override = BLOCK_OVERRIDES[tagId]
  return {
    ...base,
    ...(override || {}),
  }
}

export function getBlocksForBiome(biomeId: BiomeId): BlockDef[] {
  return Object.keys(TAG_CATALOG)
    .map(tagId => getBlockDef(tagId))
    .filter(block => block.biomeId === biomeId)
    .sort((a, b) => {
      const themeDiff = a.theme.localeCompare(b.theme)
      if (themeDiff !== 0) return themeDiff
      return a.blockName.localeCompare(b.blockName)
    })
}
