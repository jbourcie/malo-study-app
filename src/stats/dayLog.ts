import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { todayKeyParis } from '../rewards/daily'

export type DayStat = {
  dateKey: string
  sessions: number
  xp: number
  updatedAt?: any
}

export async function upsertDayStat(opts: { uid: string, dateKey?: string, sessionsDelta?: number, xpDelta?: number }) {
  const { uid } = opts
  const dateKey = opts.dateKey || todayKeyParis()
  const sessionsDelta = opts.sessionsDelta ?? 0
  const xpDelta = opts.xpDelta ?? 0
  const ref = doc(db, 'users', uid, 'statsDays', dateKey)
  await setDoc(ref, {
    dateKey,
    sessions: sessionsDelta,
    xp: xpDelta,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

export async function listLast7Days(uid: string): Promise<DayStat[]> {
  const ref = collection(db, 'users', uid, 'statsDays')
  const snap = await getDocs(query(ref, orderBy('dateKey', 'desc'), limit(7)))
  const list = snap.docs.map(d => d.data() as DayStat)
  return list.sort((a, b) => a.dateKey.localeCompare(b.dateKey)) // ascending for timeline
}
