import React from 'react'
import { joinUrl, trimTrailingSlash } from '../graphicPacks/url'
import type { BiomeVisualState } from './progressionStates'
import { assetExists } from './assetExistsCache'
import { PoiTooltip } from './PoiTooltip'
import { PoiInfoPanel } from './PoiInfoPanel'
import { clampPct, shouldShowHalo } from './poiVisuals'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

type BiomePoiProps = {
  biomeId: string
  subjectId?: string
  label: string
  progressPct: number
  state?: BiomeVisualState
  isHighlighted?: boolean
  anchor?: { radius?: number }
  onOpen: () => void
  debug?: boolean
  packBaseUrl?: string
}

type PoiState = 'low' | 'mid' | 'high' | 'max' | 'weathered'

function mapState(state?: BiomeVisualState): PoiState {
  if (!state) return 'low'
  if (state === 'weathered') return 'weathered'
  return state
}

function buildBiomePoiCandidates(packBaseUrl: string | undefined, biomeId: string, subjectId?: string): string[] {
  if (!packBaseUrl) return []
  const base = trimTrailingSlash(packBaseUrl || '/')
  return [
    ...(subjectId ? [
      joinUrl(base, `biomes/${subjectId}/poi.png`),
      joinUrl(base, `biomes/${subjectId}/poi.svg`),
      joinUrl(base, `poi/biomes/${subjectId}.png`),
      joinUrl(base, `poi/biomes/${subjectId}.svg`),
    ] : []),
    joinUrl(base, `biomes/${biomeId}/poi.png`),
    joinUrl(base, `biomes/${biomeId}/poi.svg`),
    joinUrl(base, `poi/biomes/${biomeId}.png`),
    joinUrl(base, `poi/biomes/${biomeId}.svg`),
    joinUrl(base, `poi/biome_${biomeId}.png`),
    joinUrl(base, `poi/biome_${biomeId}.svg`),
    joinUrl(base, `poi/${biomeId}.png`),
    joinUrl(base, `poi/${biomeId}.svg`),
  ]
}

export function BiomePOI({
  biomeId,
  subjectId,
  label,
  progressPct,
  state,
  isHighlighted,
  anchor,
  onOpen,
  debug,
  packBaseUrl,
}: BiomePoiProps) {
  const pct = clampPct(progressPct)
  const visualState = mapState(state)
  const [assetUrl, setAssetUrl] = React.useState<string | null>(null)
  const [showTooltip, setShowTooltip] = React.useState(false)
  const [showPanel, setShowPanel] = React.useState(false)
  const [isMobile, setIsMobile] = React.useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()
  const anchorRef = React.useRef<HTMLButtonElement | null>(null)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 900px)')
    const apply = () => setIsMobile(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  React.useEffect(() => {
    let cancelled = false
    const candidates = buildBiomePoiCandidates(packBaseUrl, biomeId, subjectId)
    if (typeof console !== 'undefined') {
      console.info('[BiomePOI] asset candidates', { biomeId, subjectId, candidates })
    }
    setAssetUrl(null)
    async function run() {
      for (const url of candidates) {
        const ok = await assetExists(url)
        if (cancelled) return
        if (ok) {
          setAssetUrl(url)
          if (typeof console !== 'undefined') {
            console.info('[BiomePOI] using asset', { biomeId, subjectId, url })
          }
          return
        }
      }
      if (typeof console !== 'undefined') {
        console.info('[BiomePOI] no asset found, fallback to dot', { biomeId, subjectId })
      }
    }
    run()
    return () => { cancelled = true }
  }, [packBaseUrl, biomeId, subjectId])

  const classes = ['mc-poi', 'mc-biome-poi', `mc-poi-state-${visualState}`]
  if (isHighlighted) classes.push('mc-biome-poi-highlight')
  if (shouldShowHalo(visualState, isHighlighted, prefersReducedMotion, ['mid', 'high', 'max'])) classes.push('has-halo')

  const ariaLabel = `${label}, progression ${pct}%`
  const sizeStyle = (debug && anchor?.radius)
    ? { width: `${Math.max(46, Math.min(90, anchor.radius * 0.9))}px`, height: `${Math.max(46, Math.min(90, anchor.radius * 0.9))}px` }
    : undefined

  const openPanel = () => {
    setShowPanel(true)
    setShowTooltip(false)
  }

  return (
    <>
      <button
        type="button"
        className={classes.join(' ')}
        aria-label={ariaLabel}
        title={ariaLabel}
        ref={anchorRef}
        style={{ ...sizeStyle, pointerEvents: debug ? 'none' : 'auto' }}
        onClick={(e) => {
          if (isMobile) {
            e.preventDefault()
            openPanel()
            return
          }
          onOpen()
        }}
        onMouseEnter={() => !isMobile && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => !isMobile && setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setShowTooltip(false)
            setShowPanel(false)
          }
          if ((e.key === 'Enter' || e.key === ' ') && isMobile) {
            e.preventDefault()
            openPanel()
          }
          if ((e.key === 'Enter' || e.key === ' ') && !isMobile) {
            e.preventDefault()
            onOpen()
          }
        }}
      >
        <span className="mc-poi-icon" aria-hidden>
          {assetUrl ? <img src={assetUrl} alt="" loading="lazy" onError={() => setAssetUrl(null)} /> : <span className="mc-poi-dot" />}
          <svg viewBox="0 0 36 36" className="mc-poi-ring mc-biome-poi-ring" aria-hidden>
            <circle className="mc-poi-ring-bg" cx="18" cy="18" r="14" />
            <circle
              className="mc-poi-ring-fg"
              cx="18"
              cy="18"
              r="14"
              strokeDasharray={`${(pct / 100) * 88}, 140`}
            />
          </svg>
        </span>
        <span className="mc-poi-meter" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </span>
        <span className="mc-poi-label mc-biome-poi-label" aria-hidden>
          {label}
        </span>
        {debug && <span className="mc-poi-debugLabel">{label}</span>}
      </button>
      <PoiTooltip
        label={label}
        masteryPct={pct}
        state={visualState}
        anchorRef={anchorRef}
        visible={showTooltip && !showPanel && !isMobile}
        onHoverStart={() => setShowTooltip(true)}
        onHoverEnd={() => setShowTooltip(false)}
      />
      <PoiInfoPanel
        open={showPanel || (isMobile && showTooltip)}
        label={label}
        masteryPct={pct}
        state={visualState as any}
        onClose={() => { setShowPanel(false); setShowTooltip(false) }}
        onStart={isMobile ? onOpen : undefined}
        entityLabel="Biome"
        metricLabel="Progression"
      />
    </>
  )
}
