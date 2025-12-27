import { MALLOOT_CATALOG, type LootRarity, type MalocraftLoot } from './malocraftLootCatalog'

function rarityRoll(base: { common: number; rare: number; epic: number }, boosters: { correctRate?: number; levelUp?: boolean; expedition?: string }) {
  let { common, rare, epic } = base
  const cr = boosters.correctRate ?? 0
  if (cr >= 0.85) rare += 5
  if (cr >= 0.9) epic += 1
  if (boosters.levelUp) {
    rare += 5
    epic += 2
  }
  if (boosters.expedition === 'craft') {
    rare += 4
    epic += 1
  }
  const total = common + rare + epic
  const r = Math.random() * total
  if (r < epic) return 'epic'
  if (r < epic + rare) return 'rare'
  return 'common'
}

export function pickLoot(opts: {
  owned: Set<string>
  biomeId?: string
  correctRate?: number
  levelUp?: boolean
  expedition?: string
}): MalocraftLoot | null {
  const rarity = rarityRoll({ common: 80, rare: 18, epic: 2 }, { correctRate: opts.correctRate, levelUp: opts.levelUp, expedition: opts.expedition })
  const candidates = MALLOOT_CATALOG.filter(l => l.rarity === rarity)
  if (!candidates.length) return null

  const biomeCandidates = candidates.filter(l => !opts.biomeId || !l.biomeId || l.biomeId === opts.biomeId)
  const pool = biomeCandidates.length ? biomeCandidates : candidates

  let picked: MalocraftLoot | null = null
  for (let i = 0; i < 3; i++) {
    const candidate = pool[Math.floor(Math.random() * pool.length)]
    if (!opts.owned.has(candidate.id)) {
      picked = candidate
      break
    }
  }

  if (!picked) {
    const commons = MALLOOT_CATALOG.filter(l => l.rarity === 'common' && (!opts.biomeId || !l.biomeId || l.biomeId === opts.biomeId)).filter(l => !opts.owned.has(l.id))
    picked = commons[0] || pool[0]
  }
  return picked
}
