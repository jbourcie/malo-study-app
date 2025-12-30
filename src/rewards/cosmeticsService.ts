import type { UserRewards } from './rewards'
import { createFirestoreRewardStore, type RewardStore } from './rewardStore'
import { COSMETICS_CATALOG, getCosmeticById, type Cosmetic } from '../game/cosmeticsCatalog'

const SLOT_BY_TYPE: Record<Cosmetic['type'], keyof NonNullable<UserRewards['equippedCosmetics']>> = {
  monument_skin_biome: 'biomeMonumentSkin',
  monument_skin_zone: 'zoneMonumentSkin',
  tile_effect: 'tileEffect',
  npc_style: 'npcStyle',
}

export function computeCoinsEarned(correctCount: number): number {
  return Math.max(0, Math.floor(correctCount))
}

export function isCosmeticOwned(cosmetic: Cosmetic, rewards: UserRewards | null | undefined): boolean {
  if (!cosmetic) return false
  const level = rewards?.level || 1
  const ownedMap = rewards?.ownedCosmetics || {}
  if (ownedMap[cosmetic.id]) return true
  if (cosmetic.unlockLevel && level >= cosmetic.unlockLevel) return true
  return false
}

export async function purchaseCosmetic(uid: string, cosmeticId: string, store: RewardStore = createFirestoreRewardStore()): Promise<UserRewards> {
  const cosmetic = getCosmeticById(cosmeticId)
  if (!cosmetic) throw new Error('Cosmétique introuvable')
  const cost = cosmetic.costCoins || 0
  let result: UserRewards | null = null

  await store.runTransaction(async (tx) => {
    const [existing, purchaseEvent] = await Promise.all([
      tx.getRewards(uid),
      tx.getRewardEvent(uid, `purchase_${cosmeticId}`),
    ])
    const current: UserRewards = {
      xp: existing?.xp || 0,
      level: existing?.level || 1,
      coins: existing?.coins || 0,
      badges: existing?.badges || [],
      masteryByTag: existing?.masteryByTag || {},
      blockProgress: existing?.blockProgress || {},
      collectibles: existing?.collectibles || { owned: [], equippedAvatarId: null },
      ownedCosmetics: existing?.ownedCosmetics || {},
      equippedCosmetics: existing?.equippedCosmetics || {},
      malocraft: existing?.malocraft,
      zoneRebuildProgress: existing?.zoneRebuildProgress,
      biomeRebuildProgress: existing?.biomeRebuildProgress,
      updatedAt: existing?.updatedAt,
    }

    if (purchaseEvent || isCosmeticOwned(cosmetic, current)) {
      const ownedCosmetics = { ...(current.ownedCosmetics || {}), [cosmeticId]: true }
      tx.setRewards(uid, { ownedCosmetics })
      result = { ...current, ownedCosmetics }
      return
    }

    if (cost > (current.coins || 0)) {
      throw new Error('Coins insuffisants')
    }

    const ownedCosmetics = { ...(current.ownedCosmetics || {}), [cosmeticId]: true }
    const nextCoins = Math.max(0, (current.coins || 0) - cost)

    tx.setRewards(uid, {
      coins: nextCoins,
      ownedCosmetics,
      equippedCosmetics: current.equippedCosmetics || {},
      updatedAt: store.createTimestamp(),
    })
    tx.setRewardEvent(uid, `purchase_${cosmeticId}`, {
      type: 'cosmetic_purchase',
      cosmeticId,
      costCoins: cost,
      createdAt: store.createTimestamp(),
    })
    result = { ...current, coins: nextCoins, ownedCosmetics }
  })

  return result || { xp: 0, level: 1, coins: 0, ownedCosmetics: {}, equippedCosmetics: {} }
}

export async function equipCosmetic(uid: string, cosmeticId: string, store: RewardStore = createFirestoreRewardStore()): Promise<UserRewards> {
  const cosmetic = getCosmeticById(cosmeticId)
  if (!cosmetic) throw new Error('Cosmétique introuvable')
  const slot = SLOT_BY_TYPE[cosmetic.type]
  let result: UserRewards | null = null

  await store.runTransaction(async (tx) => {
    const existing = await tx.getRewards(uid)
    const current: UserRewards = {
      xp: existing?.xp || 0,
      level: existing?.level || 1,
      coins: existing?.coins || 0,
      badges: existing?.badges || [],
      masteryByTag: existing?.masteryByTag || {},
      blockProgress: existing?.blockProgress || {},
      collectibles: existing?.collectibles || { owned: [], equippedAvatarId: null },
      ownedCosmetics: existing?.ownedCosmetics || {},
      equippedCosmetics: existing?.equippedCosmetics || {},
      malocraft: existing?.malocraft,
      zoneRebuildProgress: existing?.zoneRebuildProgress,
      biomeRebuildProgress: existing?.biomeRebuildProgress,
      updatedAt: existing?.updatedAt,
    }

    if (!isCosmeticOwned(cosmetic, current)) {
      throw new Error('Cosmétique non débloqué')
    }

    const ownedCosmetics = { ...(current.ownedCosmetics || {}), [cosmeticId]: true }
    const equippedCosmetics = { ...(current.equippedCosmetics || {}) }
    equippedCosmetics[slot] = cosmeticId

    tx.setRewards(uid, { ownedCosmetics, equippedCosmetics, updatedAt: store.createTimestamp() })
    result = { ...current, ownedCosmetics, equippedCosmetics }
  })

  return result || { xp: 0, level: 1, coins: 0, ownedCosmetics: {}, equippedCosmetics: {} }
}

export function listCosmetics() {
  return COSMETICS_CATALOG
}
