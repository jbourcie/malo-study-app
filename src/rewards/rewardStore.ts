import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import type { UserRewards } from './rewards'

export type RewardEventData = Record<string, any>

export interface RewardStoreTransaction {
  getRewards(uid: string): Promise<UserRewards | null>
  setRewards(uid: string, rewards: Partial<UserRewards>): void
  getRewardEvent(uid: string, eventId: string): Promise<RewardEventData | null>
  setRewardEvent(uid: string, eventId: string, data: RewardEventData): void
}

export interface RewardStore {
  createTimestamp(): any
  runTransaction<T>(fn: (tx: RewardStoreTransaction) => Promise<T>): Promise<T>
}

export function createFirestoreRewardStore(): RewardStore {
  return {
    createTimestamp: () => serverTimestamp() as any,
    async runTransaction<T>(fn: (tx: RewardStoreTransaction) => Promise<T>): Promise<T> {
      return runTransaction(db, async (fireTx) => {
        const txAdapter: RewardStoreTransaction = {
          async getRewards(uid: string) {
            const ref = doc(db, 'users', uid, 'meta', 'rewards')
            const snap = await fireTx.get(ref)
            return snap.exists() ? (snap.data() as UserRewards) : null
          },
          setRewards(uid: string, rewards: Partial<UserRewards>) {
            const ref = doc(db, 'users', uid, 'meta', 'rewards')
            fireTx.set(ref, rewards, { merge: true })
          },
          async getRewardEvent(uid: string, eventId: string) {
            const ref = doc(db, 'users', uid, 'rewardEvents', eventId)
            const snap = await fireTx.get(ref)
            return snap.exists() ? (snap.data() as RewardEventData) : null
          },
          setRewardEvent(uid: string, eventId: string, data: RewardEventData) {
            const ref = doc(db, 'users', uid, 'rewardEvents', eventId)
            fireTx.set(ref, data)
          },
        }
        return fn(txAdapter)
      })
    },
  }
}

class InMemoryRewardTransaction implements RewardStoreTransaction {
  constructor(
    private rewards: Map<string, UserRewards>,
    private events: Map<string, Map<string, RewardEventData>>,
    private timestampFactory: () => any,
  ) {}

  async getRewards(uid: string): Promise<UserRewards | null> {
    const data = this.rewards.get(uid)
    return data ? { ...data } : null
  }

  setRewards(uid: string, rewards: Partial<UserRewards>) {
    const prev = this.rewards.get(uid) || null
    const next = { ...(prev || {}), ...rewards } as UserRewards
    this.rewards.set(uid, next)
  }

  async getRewardEvent(uid: string, eventId: string): Promise<RewardEventData | null> {
    const byUser = this.events.get(uid)
    const ev = byUser?.get(eventId) || null
    return ev ? { ...ev } : null
  }

  setRewardEvent(uid: string, eventId: string, data: RewardEventData) {
    let byUser = this.events.get(uid)
    if (!byUser) {
      byUser = new Map()
      this.events.set(uid, byUser)
    }
    byUser.set(eventId, { ...data, createdAt: data?.createdAt ?? this.timestampFactory() })
  }
}

export class InMemoryRewardStore implements RewardStore {
  private rewards = new Map<string, UserRewards>()
  private events = new Map<string, Map<string, RewardEventData>>()

  constructor(private timestampFactory: () => any = () => new Date('2024-01-01T00:00:00Z')) {}

  createTimestamp() {
    return this.timestampFactory()
  }

  async runTransaction<T>(fn: (tx: RewardStoreTransaction) => Promise<T>): Promise<T> {
    const tx = new InMemoryRewardTransaction(this.rewards, this.events, this.timestampFactory)
    return fn(tx)
  }

  getState(uid: string) {
    const rewards = this.rewards.get(uid)
    const events = this.events.get(uid)
    return {
      rewards: rewards ? { ...rewards } : null,
      events: events ? new Map(events) : new Map<string, RewardEventData>(),
    }
  }
}
