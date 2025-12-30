import { describe, expect, it } from 'vitest'
import { awardSessionRewards, applyMasteryEvents } from '../src/rewards/rewardsService'
import { InMemoryRewardStore } from '../src/rewards/rewardStore'

describe('session replay idempotence', () => {
  it('ignores duplicate submissions for the same session payload', async () => {
    const store = new InMemoryRewardStore(() => new Date('2024-01-02T00:00:00Z'))
    const uid = 'user-2'
    const sessionId = 'session-repeat'
    const items = [
      { exerciseId: 'q1', tags: ['math_fractions'], correct: true },
      { exerciseId: 'q2', tags: ['math_fractions'], correct: false },
    ]

    await awardSessionRewards(uid, sessionId, 18, 1, store)
    await applyMasteryEvents({ uid, sessionId, items }, store)
    const afterFirst = store.getState(uid)

    await awardSessionRewards(uid, sessionId, 18, 1, store)
    await applyMasteryEvents({ uid, sessionId, items }, store)
    const afterSecond = store.getState(uid)

    expect(afterSecond.rewards?.xp).toBe(afterFirst.rewards?.xp)
    expect(afterSecond.rewards?.coins).toBe(afterFirst.rewards?.coins)
    expect(afterSecond.rewards?.masteryByTag?.math_fractions?.score).toBe(afterFirst.rewards?.masteryByTag?.math_fractions?.score)
    expect(afterSecond.rewards?.blockProgress?.math_fractions?.attempts).toBe(afterFirst.rewards?.blockProgress?.math_fractions?.attempts)
    expect(Array.from(afterSecond.events.keys()).sort()).toEqual([
      sessionId,
      `${sessionId}_q1`,
      `${sessionId}_q2`,
    ])
  })
})
