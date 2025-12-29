import { describe, it, expect } from 'vitest'
import type { RewardStore, RewardStoreTransaction, RewardEventData } from '../src/rewards/rewardStore'
import type { UserRewards } from '../src/rewards/rewards'
import { applyZoneRebuildProgress, applyBiomeRebuildProgress } from '../src/game/rebuildService'

function validateNoUndefined(obj: any, path: string[] = []) {
  if (obj === undefined) {
    throw new Error(`undefined at ${path.join('.') || 'root'}`)
  }
  if (obj && typeof obj === 'object') {
    Object.entries(obj).forEach(([k, v]) => validateNoUndefined(v, [...path, k]))
  }
}

class StrictRewardStore implements RewardStore {
  private rewards = new Map<string, UserRewards>()
  private events = new Map<string, Map<string, RewardEventData>>()
  constructor(private tsFactory: () => any = () => new Date()) {}

  createTimestamp() {
    return this.tsFactory()
  }

  async runTransaction<T>(fn: (tx: RewardStoreTransaction) => Promise<T>): Promise<T> {
    const tx: RewardStoreTransaction = {
      getRewards: async (uid: string) => {
        const data = this.rewards.get(uid)
        return data ? { ...data } : null
      },
      setRewards: (uid: string, rewards: Partial<UserRewards>) => {
        validateNoUndefined(rewards)
        const prev = this.rewards.get(uid) || ({} as UserRewards)
        const next = { ...(prev as any), ...rewards } as UserRewards
        validateNoUndefined(next)
        this.rewards.set(uid, next)
      },
      getRewardEvent: async (uid: string, eventId: string) => {
        const byUser = this.events.get(uid)
        const ev = byUser?.get(eventId) || null
        return ev ? { ...ev } : null
      },
      setRewardEvent: (uid: string, eventId: string, data: RewardEventData) => {
        validateNoUndefined(data)
        let byUser = this.events.get(uid)
        if (!byUser) {
          byUser = new Map()
          this.events.set(uid, byUser)
        }
        byUser.set(eventId, { ...data })
      },
    }
    return fn(tx)
  }

  getState(uid: string) {
    return this.rewards.get(uid) || null
  }
}

describe('rebuildService strict store (Firestore-like validation)', () => {
  it('creates rewards doc when missing and avoids undefined fields (zone)', async () => {
    const store = new StrictRewardStore(() => new Date('2024-01-01T00:00:00Z'))
    const res = await applyZoneRebuildProgress({
      uid: 'u1',
      sessionId: 'sess1',
      subject: 'fr',
      theme: 'Compréhension',
      tagStats: { fr_comprehension_idee_principale: { answered: 3, correct: 3 } },
      store,
    })
    expect(res.deltaApplied).toBe(3)
    const rewards = store.getState('u1')
    expect(rewards?.zoneRebuildProgress?.['fr__Compréhension']?.correctCount).toBe(3)
    expect(rewards?.zoneRebuildProgress?.['fr__Compréhension']?.rebuiltAt).toBeUndefined()
  })

  it('handles biome rebuild without undefined and respects idempotence', async () => {
    const store = new StrictRewardStore(() => new Date('2024-01-01T00:00:00Z'))
    const first = await applyBiomeRebuildProgress({
      uid: 'u2',
      sessionId: 'b1',
      subject: 'fr',
      tagStats: { fr_comprehension_idee_principale: { answered: 10, correct: 10 } },
      store,
    })
    expect(first.deltaApplied).toBe(10)
    const dup = await applyBiomeRebuildProgress({
      uid: 'u2',
      sessionId: 'b1',
      subject: 'fr',
      tagStats: { fr_comprehension_idee_principale: { answered: 5, correct: 5 } },
      store,
    })
    expect(dup.deltaApplied).toBe(0)
    const rewards = store.getState('u2')
    expect(rewards?.biomeRebuildProgress?.fr?.correctCount).toBe(10)
    expect(rewards?.biomeRebuildProgress?.fr?.rebuiltAt).toBeUndefined()
  })
})
