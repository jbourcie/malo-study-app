import React from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import type { UserRewards } from '../rewards/rewards'

const defaultRewards: UserRewards = { xp: 0, level: 1 }

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
        setRewards(snap.data() as UserRewards)
      } else {
        setRewards(defaultRewards)
      }
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [uid])

  return { rewards, loading }
}
