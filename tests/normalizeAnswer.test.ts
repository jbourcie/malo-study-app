import { describe, expect, it } from 'vitest'
import { normalize } from '../src/utils/normalize'

describe('normalize (open answer)', () => {
  const cases: Array<{ input: string, expected: string }> = [
    { input: 'école', expected: 'ecole' },
    { input: "l'école", expected: "l'ecole" },
    { input: 'l’ecole', expected: "l'ecole" },
    { input: '  bon   jour ', expected: 'bon jour' },
    { input: 'Paris', expected: 'paris' },
    { input: 'ÇA VA', expected: 'ca va' },
    { input: "rock'n’roll", expected: "rock'n'roll" },
    { input: 'déjà-vu', expected: 'deja-vu' },
    { input: ' accentué   ?', expected: 'accentue ?' },
    { input: 'hello ?!', expected: 'hello ?!' },
    { input: '  multi   lignes\nTest  ', expected: 'multi lignes test' },
  ]

  cases.forEach(({ input, expected }) => {
    it(`normalizes "${input}"`, () => {
      expect(normalize(input)).toBe(expected)
    })
  })
})
