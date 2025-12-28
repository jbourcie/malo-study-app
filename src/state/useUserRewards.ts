import React from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import type { UserRewards } from '../rewards/rewards'

const defaultRewards: UserRewards = {
  xp: 0,
  level: 1,
  badges: [],
  masteryByTag: {},
  blockProgress: {},
  collectibles: { owned: [], equippedAvatarId: null },
  malocraft: { ownedLootIds: [], equippedAvatarId: null, biomeMilestones: {} },
}

export function useUserRewards(uid: string | null) {
  const [rewards, setRewards] = React.useState<UserRewards>(defaultRewards)
  const [loading, setLoading] = React.useState<boolean>(!!uid)

  React.useEffect(() => {
    if (!uid) {
      setRewards(defaultRewards)
      setLoading(false)
      return
    }
    const ref = doc(db, 'users', uid, 'meta', 'rewards')
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserRewards
        setRewards({
          ...defaultRewards,
          ...data,
          blockProgress: data.blockProgress || defaultRewards.blockProgress,
          collectibles: data.collectibles || defaultRewards.collectibles,
          malocraft: data.malocraft || defaultRewards.malocraft,
        })
      } else {
        setRewards(defaultRewards)
      }
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [uid])

  return { rewards, loading }
}
