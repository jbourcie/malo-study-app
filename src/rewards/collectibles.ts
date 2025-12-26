import { COLLECTIBLES, CollectibleDef } from './collectiblesCatalog'

type RollContext = { rng?: () => number }

const RARITY_WEIGHTS: Array<{ rarity: CollectibleDef['rarity'], weight: number }> = [
  { rarity: 'common', weight: 0.8 },
  { rarity: 'rare', weight: 0.18 },
  { rarity: 'epic', weight: 0.02 },
]

function pickRarity(rng: () => number) {
  const r = rng()
  let acc = 0
  for (const { rarity, weight } of RARITY_WEIGHTS) {
    acc += weight
    if (r <= acc) return rarity
  }
  return 'common'
}

export function rollCollectible(ownedIds: string[] = [], ctx: RollContext = {}): string | null {
  const rng = ctx.rng || Math.random
  const owned = new Set(ownedIds || [])

  let picked: string | null = null
  let attempts = 0

  while (attempts < 4 && picked === null) {
    const rarity = pickRarity(rng)
    const candidates = COLLECTIBLES.filter(c => c.rarity === rarity && !owned.has(c.id))
    if (candidates.length) {
      const c = candidates[Math.floor(rng() * candidates.length)]
      picked = c.id
      break
    }
    attempts++
  }

  if (picked) return picked

  const commonFallback = COLLECTIBLES.filter(c => c.rarity === 'common' && !owned.has(c.id))
  if (commonFallback.length) {
    const c = commonFallback[Math.floor((ctx.rng || Math.random)() * commonFallback.length)]
    return c.id
  }

  return null
}
