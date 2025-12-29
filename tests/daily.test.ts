import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { todayKeyParis, buildDailyQuestsFromMastery } from '../src/rewards/daily'

// Mock tag catalog to control published tags + labels
vi.mock('../src/taxonomy/tagCatalog', () => ({
  TAG_CATALOG: {
    published_weak: { id: 'published_weak' },
    published_mastered: { id: 'published_mastered' },
    unpublished_weak: { id: 'unpublished_weak' },
    published_mid: { id: 'published_mid' },
    unpublished_mid: { id: 'unpublished_mid' },
  },
  getTagMeta: (id: string) => {
    if (id.startsWith('published')) return { id, label: `${id}-label` }
    return null
  },
}))

describe('todayKeyParis', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the Paris date key when UTC late evening is already next day in Paris (winter offset)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T23:30:00.000Z')) // 00:30 Paris (+1) → should be next day
    expect(todayKeyParis()).toBe('2024-01-02')
  })

  it('returns the Paris date key across DST forward (UTC late evening → Paris next day)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-03-31T22:30:00.000Z')) // 00:30 Paris (+2) → next day (Apr 1)
    expect(todayKeyParis()).toBe('2024-04-01')
  })
})

describe('daily quest generation with tag hints', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('uses weak published tag for remediation and skips mastered/unknown tags', () => {
    const quests = buildDailyQuestsFromMastery({
      published_weak: { score: 20, state: 'discovering' },
      published_mastered: { score: 90, state: 'mastered' },
      unpublished_weak: { score: 10, state: 'discovering' }, // filtered out by getTagMeta mock
    })
    const remediation = quests.find(q => q.type === 'remediation')
    expect(remediation?.tagId).toBe('published_weak')
    expect(remediation?.tagHint).toBe('published_weak-label')
  })

  it('uses in-progress published tag for progress quest and ignores unknown tags', () => {
    const quests = buildDailyQuestsFromMastery({
      published_mid: { score: 55, state: 'progressing' },
      unpublished_mid: { score: 60, state: 'progressing' },
    })
    const progress = quests.find(q => q.type === 'progress')
    expect(progress?.tagId).toBe('published_mid')
    expect(progress?.tagHint).toBe('published_mid-label')
  })

  it('never picks a tag outside priorityTags', () => {
    const quests = buildDailyQuestsFromMastery({
      published_weak: { score: 10, state: 'discovering' },
      published_mid: { score: 50, state: 'progressing' },
    }, { priorityTags: new Set(['published_mid']) })
    const remediation = quests.find(q => q.type === 'remediation')
    expect(remediation?.tagId).toBeNull()
    const progress = quests.find(q => q.type === 'progress')
    expect(progress?.tagId).toBe('published_mid')
  })

  it('falls back to generic quests when priorityTags is empty', () => {
    const quests = buildDailyQuestsFromMastery({
      published_weak: { score: 10, state: 'discovering' },
      published_mid: { score: 50, state: 'progressing' },
    }, { priorityTags: new Set() })
    const remediation = quests.find(q => q.type === 'remediation')
    const progress = quests.find(q => q.type === 'progress')
    expect(remediation?.tagId).toBeNull()
    expect(progress?.tagId).toBeNull()
    expect(remediation?.description).toMatch(/s’entraîne un peu/i)
  })
})
