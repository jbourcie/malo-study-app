import { describe, expect, it } from 'vitest'
import { getTagsForZone } from '../src/world/map/getTagsForZone'

describe('getTagsForZone', () => {
  it('matches theme by slug (accent/slug-safe)', () => {
    const tags = getTagsForZone('fr', 'comprehension')
    const ids = tags.map((t) => t.id).sort()
    expect(ids).toContain('fr_comprehension_idee_principale')
    expect(ids).toContain('fr_comprehension_types_textes')
  })

  it('keeps subject filter intact', () => {
    const tags = getTagsForZone('math', 'Fractions')
    expect(tags.every((t) => t.subject === 'math')).toBe(true)
  })
})
