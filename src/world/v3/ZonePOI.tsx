import React from 'react'
import { joinUrl, trimTrailingSlash } from '../graphicPacks/url'
import type { ZoneVisualState } from './progressionStates'
import { assetExists } from './assetExistsCache'
import { PoiTooltip } from './PoiTooltip'
import { PoiInfoPanel } from './PoiInfoPanel'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'
import { clampPct, shouldShowHalo } from './poiVisuals'
import { slugifyZoneLabel } from '../slug'

type ZonePoiVisualState = 'discovering' | 'progressing' | 'rebuilt' | 'weathered' | 'rebuilding'

type ZonePoiProps = {
  label: string
  progressPct: number
  state: ZoneVisualState
  highlight?: boolean
  onEnter?: () => void
  onShowPanel?: () => void
  packBaseUrl: string
  subjectId?: 'fr' | 'math' | 'en' | 'es' | 'hist'
  zoneSlug?: string
  mapDebug?: boolean
  radiusPx?: number
}

function mapZoneState(state: ZoneVisualState, pct: number): ZonePoiVisualState {
  if (state === 'weathered') return 'weathered'
  if (state === 'rebuilt') return 'rebuilt'
  if (state === 'rebuilding') return pct >= 35 ? 'progressing' : 'rebuilding'
  return 'discovering'
}

function buildZonePoiCandidates(packBaseUrl: string, subjectId?: string, zoneSlug?: string, label?: string): string[] {
  const base = trimTrailingSlash(packBaseUrl || '/')
  const paths: string[] = []
  const fromLabel = label ? slugifyZoneLabel(label) : ''
  const rawSlug = zoneSlug || ''
  const slugTail = rawSlug.includes(':') ? rawSlug.split(':').pop() || '' : rawSlug
  const slugParts = Array.from(new Set([fromLabel, slugTail].filter(Boolean)))

  if (subjectId) {
    slugParts.forEach((slug) => {
      paths.push(joinUrl(base, `zones/${subjectId}/${slug}/poi.png`))
      paths.push(joinUrl(base, `zones/${subjectId}/${slug}/poi.svg`))
      paths.push(joinUrl(base, `poi/zones/${subjectId}/${slug}.png`))
      paths.push(joinUrl(base, `poi/zones/${subjectId}/${slug}.svg`))
    })
  }
  slugParts.forEach((slug) => {
    paths.push(joinUrl(base, `poi/zones/${slug}.png`))
    paths.push(joinUrl(base, `poi/zones/${slug}.svg`))
  })
  if (subjectId && zoneSlug) {
    paths.push(joinUrl(base, `monuments/${subjectId}/${zoneSlug}/poi.png`))
    paths.push(joinUrl(base, `monuments/${subjectId}/${zoneSlug}/poi.svg`))
  }
  return paths
}

export function ZonePOI({
  label,
  progressPct,
  state,
  highlight,
  onEnter,
  onShowPanel,
  packBaseUrl,
  subjectId,
  zoneSlug,
  mapDebug,
  radiusPx,
}: ZonePoiProps) {
  const pct = clampPct(progressPct)
  const visualState = mapZoneState(state, pct)
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
    const candidates = buildZonePoiCandidates(packBaseUrl, subjectId, zoneSlug, label)
    if (typeof console !== 'undefined') {
      console.info('[ZonePOI] asset candidates', { zoneSlug, subjectId, label, candidates })
    }
    setAssetUrl(null)
    async function run() {
      for (const url of candidates) {
        const ok = await assetExists(url)
        if (cancelled) return
        if (ok) {
          setAssetUrl(url)
          if (typeof console !== 'undefined') {
            console.info('[ZonePOI] using asset', { zoneSlug, subjectId, label, url })
          }
          return
        }
      }
      setAssetUrl(null)
      if (typeof console !== 'undefined') {
        console.info('[ZonePOI] no asset found, fallback to dot', { zoneSlug, subjectId, label })
      }
    }
    run()
    return () => { cancelled = true }
  }, [packBaseUrl, subjectId, zoneSlug, label])

  const classes = ['mc-poi', 'mc-zone-poi', `mc-poi-state-${visualState}`]
  if (highlight) classes.push('is-highlighted')
  if (shouldShowHalo(visualState, highlight, prefersReducedMotion, ['progressing'])) classes.push('has-halo')
  if (visualState === 'weathered') classes.push('has-weather')

  const sizeStyle = (mapDebug && radiusPx)
    ? { width: `${Math.max(50, Math.min(96, radiusPx * 1.1))}px`, height: `${Math.max(50, Math.min(96, radiusPx * 1.1))}px` }
    : undefined

  const handlePanel = () => {
    setShowPanel(true)
    setShowTooltip(false)
    onShowPanel?.()
  }

  const ariaLabel = `Zone ${label}, progression ${pct}%`

  return (
    <>
      <button
        type="button"
        className={classes.join(' ')}
        aria-label={ariaLabel}
        title={ariaLabel}
        style={sizeStyle}
        onClick={(e) => {
          if (isMobile) {
            e.preventDefault()
            handlePanel()
            return
          }
          onEnter?.()
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
            handlePanel()
          }
        }}
        ref={anchorRef}
      >
        <span className="mc-poi-icon" aria-hidden>
          {assetUrl ? <img src={assetUrl} alt="" loading="lazy" onError={() => setAssetUrl(null)} /> : <span className="mc-poi-dot" />}
          <svg viewBox="0 0 44 44" className="mc-poi-ring" aria-hidden>
            <circle className="mc-poi-ring-bg" cx="22" cy="22" r="18" />
            <circle
              className="mc-poi-ring-fg"
              cx="22"
              cy="22"
              r="18"
              strokeDasharray={`${(pct / 100) * 113}, 160`}
            />
          </svg>
          {visualState === 'rebuilding' && (
            <span className="mc-poi-badge" aria-hidden>🛠️</span>
          )}
        </span>
        <span className="mc-poi-label mc-zone-poi-label" aria-hidden>
          {label}
        </span>
        {mapDebug && <span className="mc-poi-debugLabel">{label}</span>}
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
        onStart={isMobile ? onEnter : undefined}
        entityLabel="Zone"
        metricLabel="Progression"
      />
    </>
  )
}
