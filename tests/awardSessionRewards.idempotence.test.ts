import { describe, expect, it } from 'vitest'
import { awardSessionRewards } from '../src/rewards/rewardsService'
import { InMemoryRewardStore } from '../src/rewards/rewardStore'

describe('awardSessionRewards idempotence', () => {
  it('applies XP once per sessionId and reuses the same reward event', async () => {
    const store = new InMemoryRewardStore(() => new Date('2024-01-01T00:00:00Z'))
    const uid = 'user-1'
    const sessionId = 'session-123'

    await awardSessionRewards(uid, sessionId, 24, 10, store)
    const afterFirst = store.getState(uid)

    await awardSessionRewards(uid, sessionId, 24, 10, store)
    const afterSecond = store.getState(uid)

    expect(afterFirst.rewards?.xp).toBe(24)
    expect(afterSecond.rewards?.xp).toBe(24)
    expect(afterSecond.rewards?.coins).toBe(10)
    expect(Array.from(afterSecond.events.keys())).toEqual([sessionId])
  })
})
