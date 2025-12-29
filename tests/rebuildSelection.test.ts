import { describe, it, expect, vi } from 'vitest'
import { selectRebuildZoneQuestions } from '../src/pages/ThemeSession'

const makeQuestion = (id: string, tags: string[], difficulty = 1) => ({ id, tags, difficulty })

describe('selectRebuildZoneQuestions', () => {
  it('mixes tags across the zone', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1) // deterministic shuffle
    const zoneTags = ['tag_a', 'tag_b']
    const content = [
      makeQuestion('q1', ['tag_a'], 1),
      makeQuestion('q2', ['tag_a'], 2),
      makeQuestion('q3', ['tag_b'], 1),
      makeQuestion('q4', ['tag_b'], 2),
      makeQuestion('q5', ['tag_a'], 1),
      makeQuestion('q6', ['tag_b'], 1),
    ]
    const picked = selectRebuildZoneQuestions(content, zoneTags, 6, false)
    const tagsPicked = picked.map(q => (q.tags || [])[0])
    expect(tagsPicked.filter(t => t === 'tag_a').length).toBeGreaterThan(0)
    expect(tagsPicked.filter(t => t === 'tag_b').length).toBeGreaterThan(0)
    vi.restoreAllMocks()
  })

  it('limits difficulty 3 when allowHarder is true', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2)
    const zoneTags = ['tag_a', 'tag_b']
    const content = [
      makeQuestion('q1', ['tag_a'], 3),
      makeQuestion('q2', ['tag_a'], 3),
      makeQuestion('q3', ['tag_a'], 3),
      makeQuestion('q4', ['tag_b'], 1),
      makeQuestion('q5', ['tag_b'], 2),
      makeQuestion('q6', ['tag_b'], 1),
      makeQuestion('q7', ['tag_a'], 1),
      makeQuestion('q8', ['tag_b'], 2),
    ]
    const picked = selectRebuildZoneQuestions(content, zoneTags, 6, true)
    const diff3Count = picked.filter(q => (q as any).difficulty === 3).length
    expect(diff3Count).toBeLessThanOrEqual(2) // ~20% cap
    vi.restoreAllMocks()
  })
})
