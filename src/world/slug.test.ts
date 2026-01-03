import { describe, expect, it } from 'vitest'
import { slugifyZoneLabel, zoneKey } from './slug'

const cases: Array<[string, string]> = [
  ['Grandeurs & mesures', 'grandeurs_et_mesures'],
  ['Nombres & calcul', 'nombres_et_calcul'],
  ['Histoire-Géographie', 'histoire_geographie'],
  ['Méthodes', 'methodes'],
  ['Repères', 'reperes'],
  ['Géométrie', 'geometrie'],
  ['  Conjugaison  ', 'conjugaison'],
  ['Compréhension', 'comprehension'],
  ["L’école", 'lecole'],
  ["C'est l’été", 'cest_lete'],
  ['Proportionnalité / %', 'proportionnalite'],
  ['Nombres: entiers', 'nombres_entiers'],
  ['À 100% !', 'a_100'],
  ['___', 'zone'],
  ['éèêëàâîïôöùûç', 'eeeeaaiioouuc'],
]

describe('slugifyZoneLabel', () => {
  cases.forEach(([input, expected]) => {
    it(`slugifies "${input}"`, () => {
      expect(slugifyZoneLabel(input)).toBe(expected)
    })
  })

  it('falls back to "zone" on empty', () => {
    expect(slugifyZoneLabel('')).toBe('zone')
  })
})

describe('zoneKey', () => {
  it('builds subject + slug', () => {
    expect(zoneKey('math', 'Grandeurs & mesures')).toBe('math:grandeurs_et_mesures')
  })
})
