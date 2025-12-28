import { describe, expect, it } from 'vitest'
import { computeSessionXp } from '../src/rewards/rewards'

describe('computeSessionXp completion bonus', () => {
  it('includes completion bonus only when every question is answered', () => {
    const completed = computeSessionXp({
      answeredCount: 3,
      correctCount: 3,
      streaks: [3],
      comebackCount: 1,
      isCompleted: true,
    })
    expect(completed.breakdown.completion).toBe(10)
    expect(completed.total).toBe(25) // 12 base + 10 completion + 1 streak + 2 comeback
  })

  it('omits completion bonus when a question is skipped', () => {
    const partial = computeSessionXp({
      answeredCount: 2,
      correctCount: 2,
      streaks: [2],
      comebackCount: 0,
      isCompleted: false,
    })
    expect(partial.breakdown.completion).toBe(0)
    expect(partial.breakdown.base).toBe(8)
    expect(partial.total).toBe(8)
  })
})
