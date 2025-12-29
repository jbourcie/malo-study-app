import { describe, it, expect } from 'vitest'
import { applyZoneRebuildProgress, applyBiomeRebuildProgress, zoneKey } from '../src/game/rebuildService'
import { InMemoryRewardStore } from '../src/rewards/rewardStore'

describe('applyZoneRebuildProgress', () => {
  it('applies delta, caps to 35 and is idempotent per session', async () => {
    const store = new InMemoryRewardStore(() => new Date('2024-01-01T00:00:00Z'))
    const uid = 'user1'
    const sessionId = 's1'
    const subject = 'fr' as const
    const theme = 'Compréhension'
    const tag = 'fr_comprehension_idee_principale'

    const res1 = await applyZoneRebuildProgress({
      uid,
      sessionId,
      subject,
      theme,
      tagStats: { [tag]: { correct: 5 } },
      store,
    })
    expect(res1.deltaApplied).toBe(5)
    expect(res1.progress?.correctCount).toBe(5)

    const res2 = await applyZoneRebuildProgress({
      uid,
      sessionId,
      subject,
      theme,
      tagStats: { [tag]: { correct: 10 } },
      store,
    })
    expect(res2.deltaApplied).toBe(0) // idempotent
    expect(res2.progress?.correctCount).toBe(5)

    const res3 = await applyZoneRebuildProgress({
      uid,
      sessionId: 's2',
      subject,
      theme,
      tagStats: { [tag]: { correct: 40 } }, // > target
      store,
    })
    expect(res3.progress?.correctCount).toBe(35)

    const state = store.getState(uid)
    expect(state.rewards?.zoneRebuildProgress?.[zoneKey(subject, theme)]?.correctCount).toBe(35)
  })
})

describe('applyBiomeRebuildProgress', () => {
  it('counts only subject tags, caps at 100, idempotent', async () => {
    const store = new InMemoryRewardStore(() => new Date('2024-01-01T00:00:00Z'))
    const uid = 'user2'
    const subject = 'fr' as const

    const first = await applyBiomeRebuildProgress({
      uid,
      sessionId: 'b1',
      subject,
      tagStats: {
        fr_comprehension_idee_principale: { correct: 30 },
        math_fractions_addition: { correct: 20 }, // other subject ignored
      },
      store,
    })
    expect(first.deltaApplied).toBe(30)
    expect(first.progress?.correctCount).toBe(30)

    const dup = await applyBiomeRebuildProgress({
      uid,
      sessionId: 'b1',
      subject,
      tagStats: { fr_lexique_synonyme: { correct: 10 } },
      store,
    })
    expect(dup.deltaApplied).toBe(0)
    expect(dup.progress?.correctCount).toBe(30)

    const next = await applyBiomeRebuildProgress({
      uid,
      sessionId: 'b2',
      subject,
      tagStats: { fr_lexique_synonyme: { correct: 90 } },
      store,
    })
    expect(next.progress?.correctCount).toBe(100)
    const state = store.getState(uid)
    expect(state.rewards?.biomeRebuildProgress?.[subject]?.correctCount).toBe(100)
    expect(state.rewards?.biomeRebuildProgress?.[subject]?.rebuiltAt).toBeTruthy()
  })
})
