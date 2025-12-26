import { collection, doc, getDoc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { UserRewards } from './rewards'
import { computeLevelFromXp } from './rewards'

export async function getOrInitRewards(uid: string): Promise<UserRewards> {
  const ref = doc(db, 'users', uid, 'meta', 'rewards')
  const snap = await getDoc(ref)
  if (snap.exists()) return snap.data() as UserRewards
  const initial: UserRewards = { xp: 0, level: 1, updatedAt: serverTimestamp() as any }
  await setDoc(ref, initial)
  return initial
}

export async function awardSessionRewards(uid: string, sessionId: string | null, deltaXp: number): Promise<UserRewards> {
  if (deltaXp <= 0) return await getOrInitRewards(uid)
  const rewardsRef = doc(db, 'users', uid, 'meta', 'rewards')
  const eventsRef = sessionId ? doc(db, 'users', uid, 'rewardEvents', sessionId) : null

  let result: UserRewards | null = null

  await runTransaction(db, async (tx) => {
    if (eventsRef) {
      const evSnap = await tx.get(eventsRef)
      if (evSnap.exists()) {
        const rewardsSnap = await tx.get(rewardsRef)
        result = rewardsSnap.exists() ? (rewardsSnap.data() as UserRewards) : { xp: 0, level: 1 }
        return
      }
    }

    const rewardsSnap = await tx.get(rewardsRef)
    const current = rewardsSnap.exists() ? (rewardsSnap.data() as UserRewards) : { xp: 0, level: 1 }
    const newXp = Math.max(0, (current.xp || 0) + deltaXp)
    const levelInfo = computeLevelFromXp(newXp)
    const nextRewards: UserRewards = {
      xp: newXp,
      level: levelInfo.level,
      updatedAt: serverTimestamp() as any,
    }

    tx.set(rewardsRef, nextRewards, { merge: true })
    if (eventsRef) {
      tx.set(eventsRef, {
        sessionId,
        deltaXp,
        awardedAt: serverTimestamp(),
      })
    }
    result = nextRewards
  })

  return result || { xp: 0, level: 1 }
}
