import { WORLD_5E_MAP } from './world_5e'
import type { WorldMapConfig } from './types'

export function getWorldMapConfig(grade?: string | null): WorldMapConfig | null {
  if (!grade) return null
  if (grade === '5e') return WORLD_5E_MAP
  return null
}
