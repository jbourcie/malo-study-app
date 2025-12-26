import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { COLLECTIBLES } from './collectiblesCatalog'
import type { UserRewards } from './rewards'

export async function unlockCollectible(uid: string, collectibleId: string, eventId?: string) {
  const def = COLLECTIBLES.find(c => c.id === collectibleId)
  if (!def) throw new Error('Collectible inconnu')
  const rewardsRef = doc(db, 'users', uid, 'meta', 'rewards')
  const evRef = eventId ? doc(db, 'users', uid, 'rewardEvents', eventId) : null

  await runTransaction(db, async (tx) => {
    const [rewardsSnap, evSnap] = await Promise.all([
      tx.get(rewardsRef),
      evRef ? tx.get(evRef) : Promise.resolve(null as any)
    ])
    if (evSnap && evSnap.exists()) return
    const existing = rewardsSnap.exists() ? (rewardsSnap.data() as any) : null
    const current: UserRewards = {
      xp: existing?.xp || 0,
      level: existing?.level || 1,
      badges: Array.isArray(existing?.badges) ? existing.badges : [],
      masteryByTag: typeof existing?.masteryByTag === 'object' && existing?.masteryByTag ? existing.masteryByTag : {},
      collectibles: existing?.collectibles && Array.isArray(existing.collectibles.owned)
        ? existing.collectibles
        : { owned: [], equippedAvatarId: undefined },
      updatedAt: existing?.updatedAt,
    }
    const owned = new Set(current.collectibles?.owned || [])
    owned.add(collectibleId)

    const equipAvatar = def.type === 'avatar' && !current.collectibles?.equippedAvatarId
    tx.set(rewardsRef, {
      collectibles: {
        owned: Array.from(owned),
        equippedAvatarId: equipAvatar ? collectibleId : current.collectibles?.equippedAvatarId,
      },
      updatedAt: serverTimestamp(),
    }, { merge: true })
    if (evRef) {
      tx.set(evRef, { type: 'collectible', collectibleId, createdAt: serverTimestamp() })
    }
  })
}

export async function equipAvatar(uid: string, avatarId: string) {
  const def = COLLECTIBLES.find(c => c.id === avatarId && c.type === 'avatar')
  if (!def) throw new Error('Avatar inconnu')
  const rewardsRef = doc(db, 'users', uid, 'meta', 'rewards')
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(rewardsRef)
    const data = snap.exists() ? (snap.data() as any) : null
    const owned = new Set<string>(data?.collectibles?.owned || [])
    if (!owned.has(avatarId)) throw new Error('Avatar non possédé')
    tx.set(rewardsRef, {
      collectibles: {
        owned: Array.from(owned),
        equippedAvatarId: avatarId,
      },
      updatedAt: serverTimestamp(),
    }, { merge: true })
  })
}
