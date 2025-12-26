import { collection, doc, getDoc, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { getOrInitStats } from './firestore'

export type RewardItem = {
  id: string
  title: string
  description: string
  priceCoins: number
  requiresXp?: number
}

const REWARD_ITEMS: RewardItem[] = [
  { id: 'badge_dragon', title: 'Badge Dragon', description: 'Un badge épique à afficher', priceCoins: 10 },
  { id: 'skin_bleu', title: 'Skin Bleu', description: 'Personnalisation bleue de ton avatar', priceCoins: 15 },
  { id: 'skin_or', title: 'Skin Or', description: 'Style doré rare', priceCoins: 25, requiresXp: 150 },
  { id: 'pack_stickers', title: 'Pack Stickers', description: 'Stickers virtuels à collectionner', priceCoins: 8 },
  { id: 'titre_champion', title: 'Titre Champion', description: 'Titre spécial dans ton profil', priceCoins: 20, requiresXp: 100 },
]

export function listRewardItems(): RewardItem[] {
  return REWARD_ITEMS
}

export async function listInventory(uid: string) {
  const snap = await getDocs(collection(db, 'users', uid, 'inventory'))
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
}

export async function purchaseReward(uid: string, itemId: string) {
  const item = REWARD_ITEMS.find(i => i.id === itemId)
  if (!item) throw new Error('Item inconnu')

  const statsRef = doc(db, 'users', uid, 'stats', 'main')
  const invRef = doc(db, 'users', uid, 'inventory', itemId)

  const result = await runTransaction(db, async (tx) => {
    const [statsSnap, invSnap] = await Promise.all([tx.get(statsRef), tx.get(invRef)])
    const stats = statsSnap.exists() ? (statsSnap.data() as any) : await getOrInitStats(uid)
    if (invSnap.exists()) throw new Error('Déjà possédé')
    const coins = stats.coins || 0
    const xp = stats.xp || 0
    if (coins < item.priceCoins) throw new Error('Pas assez de pièces')
    if (item.requiresXp && xp < item.requiresXp) throw new Error('XP insuffisant')

    tx.set(invRef, {
      acquiredAt: serverTimestamp(),
      title: item.title,
      description: item.description,
      priceCoins: item.priceCoins,
      requiresXp: item.requiresXp || null,
    })
    tx.set(statsRef, {
      coins: coins - item.priceCoins,
      xp,
      updatedAt: serverTimestamp(),
    }, { merge: true })

    return { coins: coins - item.priceCoins, xp }
  })

  return result
}
