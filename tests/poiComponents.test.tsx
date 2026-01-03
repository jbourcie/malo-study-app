import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BlockPOI } from '../src/world/v3/BlockPOI'
import { ZonePOI } from '../src/world/v3/ZonePOI'
import { shouldShowHalo } from '../src/world/v3/poiVisuals'
import { BiomePOI } from '../src/world/v3/BiomePOI'

describe('POI aria labels', () => {
  it('renders block aria label with mastery', () => {
    const html = renderToStaticMarkup(
      <BlockPOI
        tagId="t1"
        label="Bloc Test"
        state="repairing"
        masteryPct={42}
        onStart={() => {}}
        packBaseUrl="/assets"
      />,
    )
    expect(html).toContain('Bloc Bloc Test, maîtrise 42%')
  })

  it('renders zone aria label with progression', () => {
    const html = renderToStaticMarkup(
      <ZonePOI
        label="Zone Test"
        progressPct={68}
        state="rebuilding"
        packBaseUrl="/assets"
        subjectId="fr"
        zoneSlug="zone-test"
      />,
    )
    expect(html).toContain('Zone Zone Test, progression 68%')
  })

  it('renders biome aria label with progression', () => {
    const html = renderToStaticMarkup(
      <BiomePOI
        biomeId="biome_fr_foret_langue"
        label="Français"
        progressPct={62}
        onOpen={() => {}}
      />,
    )
    expect(html).toContain('Français, progression 62%')
  })
})

describe('POI visual helpers', () => {
  it('disables halo when prefers-reduced-motion', () => {
    expect(shouldShowHalo('progressing', false, true, ['progressing'])).toBe(false)
    expect(shouldShowHalo('repairing', true, true, ['repairing'])).toBe(false)
  })
})
