import { describe, expect, it } from 'vitest'
import {
  addAnchorsForTags,
  extractNewTagIdsFromDiff,
  resolveZoneKey,
} from '../../../scripts/autoAddNewFrBlockAnchors'
import type { GraphicPackManifest } from './types'

const NEW_TAGS = [
  'fr_comprehension_types_textes',
  'fr_lexique_champ_lexical',
  'fr_orthographe_lexicale',
] as const

function buildManifest(): GraphicPackManifest {
  return {
    id: 'pack-test',
    label: 'Pack test',
    grade: '5e',
    version: '0.0.0',
    map: { baseLayer: 'base/map.png', width: 1920, height: 1080 },
    maps: {
      zones: {
        'fr:comprehension': { baseLayer: 'zones/fr/comprehension/map.png', width: 1500, height: 1000 },
        'fr:lexique': { baseLayer: 'zones/fr/lexique/map.svg', width: 1920, height: 1080 },
        'fr:orthographe': { baseLayer: 'zones/fr/orthographe/map.svg', width: 1920, height: 1080 },
      },
    },
    css: [],
    anchors: {
      zones: {
        'fr:comprehension': {
          safeArea: { left: 60, top: 60, right: 60, bottom: 60 },
          blocks: {
            fr_comprehension_idee_principale: { x: 300, y: 320, radius: 24 },
          },
        },
        'fr:lexique': {
          safeArea: { left: 60, top: 60, right: 60, bottom: 60 },
          blocks: {
            fr_lexique_synonyme: { x: 400, y: 360, radius: 24 },
          },
        },
      },
    },
  }
}

describe('autoAddNewFrBlockAnchors helpers', () => {
  it('extracts the three new FR tag ids from git diff', () => {
    const diff = `
diff --git a/src/taxonomy/tagCatalog.ts b/src/taxonomy/tagCatalog.ts
@@
+  fr_comprehension_types_textes: {
+    id: "fr_comprehension_types_textes",
+    label: "Types de textes",
+  },
+  fr_lexique_champ_lexical: {
+    id: "fr_lexique_champ_lexical",
+    label: "Champ lexical",
+  },
+  fr_orthographe_lexicale: {
+    id: "fr_orthographe_lexicale",
+    label: "Orthographe lexicale",
+  },
`
    const detected = extractNewTagIdsFromDiff(diff)
    expect(detected.sort()).toEqual([...NEW_TAGS].sort())
  })

  it('places anchors under the correct zone keys', () => {
    const manifest = buildManifest()
    const { added } = addAnchorsForTags(manifest, [...NEW_TAGS])
    const zones = manifest.anchors?.zones ?? {}

    expect(Object.keys(zones['fr:comprehension']?.blocks ?? {})).toContain('fr_comprehension_types_textes')
    expect(Object.keys(zones['fr:lexique']?.blocks ?? {})).toContain('fr_lexique_champ_lexical')
    expect(Object.keys(zones['fr:orthographe']?.blocks ?? {})).toContain('fr_orthographe_lexicale')

    expect(resolveZoneKey('fr_comprehension_types_textes')).toBe('fr:comprehension')
    expect(resolveZoneKey('fr_lexique_champ_lexical')).toBe('fr:lexique')
    expect(resolveZoneKey('fr_orthographe_lexicale')).toBe('fr:orthographe')
    expect(added).toHaveLength(3)
  })

  it('does not overwrite an existing anchor', () => {
    const manifest = buildManifest()
    manifest.anchors!.zones!['fr:orthographe'] = {
      safeArea: { left: 60, top: 60, right: 60, bottom: 60 },
      blocks: { fr_orthographe_lexicale: { x: 11, y: 22, radius: 33 } },
    }

    const { added } = addAnchorsForTags(manifest, [...NEW_TAGS])
    expect(manifest.anchors!.zones!['fr:orthographe']!.blocks!.fr_orthographe_lexicale).toEqual({
      x: 11,
      y: 22,
      radius: 33,
    })
    expect(added.find((entry) => entry.tagId === 'fr_orthographe_lexicale')).toBeUndefined()
  })

  it('is idempotent when run twice', () => {
    const manifest = buildManifest()
    addAnchorsForTags(manifest, [...NEW_TAGS])
    const once = JSON.stringify(manifest)
    const { added } = addAnchorsForTags(manifest, [...NEW_TAGS])
    const twice = JSON.stringify(manifest)

    expect(added).toHaveLength(0)
    expect(twice).toBe(once)
  })
})
