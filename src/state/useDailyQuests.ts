import React from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { ensureDailyState, type DailyState } from '../rewards/daily'

export function useDailyQuests(uid: string | null) {
  const [daily, setDaily] = React.useState<DailyState | null>(null)
  const [loading, setLoading] = React.useState<boolean>(!!uid)

  React.useEffect(() => {
    let unsub: (() => void) | null = null
    if (!uid) {
      setDaily(null)
      setLoading(false)
      return
    }
    ;(async () => {
      try {
        await ensureDailyState(uid)
      } catch {
        // ignore ensure errors; snapshot may still succeed
      }
      const ref = doc(db, 'users', uid, 'meta', 'daily')
      unsub = onSnapshot(ref, (snap) => {
        if (snap.exists()) {
          setDaily(snap.data() as DailyState)
        } else {
          setDaily(null)
        }
        setLoading(false)
      }, () => setLoading(false))
    })()
    return () => {
      if (unsub) unsub()
    }
  }, [uid])

  return { daily, loading }
}
