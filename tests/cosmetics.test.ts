import { describe, expect, it } from 'vitest'
import { computeCoinsEarned, isCosmeticOwned, purchaseCosmetic } from '../src/rewards/cosmeticsService'
import { InMemoryRewardStore } from '../src/rewards/rewardStore'
import { getCosmeticById } from '../src/game/cosmeticsCatalog'
import type { UserRewards } from '../src/rewards/rewards'

describe('coins & cosmetics', () => {
  it('computeCoinsEarned mirrors correct answers', () => {
    expect(computeCoinsEarned(7)).toBe(7)
    expect(computeCoinsEarned(0)).toBe(0)
  })

  it('purchaseCosmetic debits once and refuses when coins are missing', async () => {
    const store = new InMemoryRewardStore(() => new Date('2024-01-01T00:00:00Z'))
    const uid = 'player-1'

    await store.runTransaction(async (tx) => {
      tx.setRewards(uid, { coins: 50, xp: 0, level: 1, ownedCosmetics: {}, equippedCosmetics: {} })
    })

    await expect(purchaseCosmetic(uid, 'tile_effect_spark', store)).rejects.toThrow(/Coins insuffisants/)

    await purchaseCosmetic(uid, 'tile_effect_glow', store)
    const afterFirst = store.getState(uid).rewards
    expect(afterFirst?.coins).toBe(10)

    await purchaseCosmetic(uid, 'tile_effect_glow', store)
    const afterSecond = store.getState(uid).rewards
    expect(afterSecond?.coins).toBe(10)
  })

  it('unlock by level treats cosmetics as owned', () => {
    const cosmetic = getCosmeticById('biome_skin_stone')
    if (!cosmetic) throw new Error('Missing cosmetic')
    const rewards: UserRewards = {
      xp: 0,
      level: 5,
      coins: 0,
      ownedCosmetics: {},
      equippedCosmetics: {},
      masteryByTag: {},
      blockProgress: {},
    }
    expect(isCosmeticOwned(cosmetic, rewards)).toBe(true)
  })
})
