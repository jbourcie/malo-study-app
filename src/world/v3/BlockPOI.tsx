import React from 'react'
import { joinUrl, trimTrailingSlash } from '../graphicPacks/url'
import { assetExists } from './assetExistsCache'
import { PoiTooltip } from './PoiTooltip'
import { PoiInfoPanel } from './PoiInfoPanel'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'
import { clampPct, shouldShowHalo } from './poiVisuals'

type BlockPoiState = 'cracked' | 'repairing' | 'repaired' | 'enhanced' | 'weathered'

type BlockPoiProps = {
  tagId: string
  label: string
  state: BlockPoiState
  masteryPct: number
  highlight?: boolean
  onStart: () => void
  packBaseUrl: string
  mapDebug?: boolean
}

function buildPoiCandidates(packBaseUrl: string, state: string) {
  const base = trimTrailingSlash(packBaseUrl || '/')
  return [
    joinUrl(base, `poi/poi_${state}.png`),
    joinUrl(base, `poi/poi_${state}.svg`),
  ]
}

export function BlockPOI({ tagId, label, state, masteryPct, highlight, onStart, packBaseUrl, mapDebug }: BlockPoiProps) {
  const pct = clampPct(masteryPct)
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
    const primary = buildPoiCandidates(packBaseUrl, state)
    const fallback = state === 'weathered' ? buildPoiCandidates(packBaseUrl, 'cracked') : []
    const candidates = [...primary, ...fallback].filter(Boolean) as string[]
    setAssetUrl(null)
    async function run() {
      for (const url of candidates) {
        const ok = await assetExists(url)
        if (cancelled) return
        if (ok) {
          setAssetUrl(url)
          return
        }
      }
      setAssetUrl(null)
    }
    run()
    return () => { cancelled = true }
  }, [packBaseUrl, state])

  const classes = ['mc-poi', 'mc-block-poi', `mc-poi-state-${state}`]
  if (highlight) classes.push('is-highlighted')
  if (shouldShowHalo(state, highlight, prefersReducedMotion, ['repairing', 'enhanced'])) classes.push('has-halo')
  if (state === 'weathered') classes.push('has-weather')

  const ariaLabel = `Bloc ${label}, maîtrise ${pct}%`

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
        data-tag-id={tagId}
        onClick={(e) => {
          if (isMobile) {
            e.preventDefault()
            openPanel()
            return
          }
          onStart()
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
        }}
        ref={anchorRef}
      >
        <span className="mc-poi-icon" aria-hidden>
          {assetUrl ? <img src={assetUrl} alt="" loading="lazy" onError={() => setAssetUrl(null)} /> : <span className="mc-poi-dot" />}
          <svg viewBox="0 0 32 32" className="mc-poi-ring" aria-hidden>
            <circle className="mc-poi-ring-bg" cx="16" cy="16" r="12" />
            <circle
              className="mc-poi-ring-fg"
              cx="16"
              cy="16"
              r="12"
              strokeDasharray={`${(pct / 100) * 75}, 120`}
            />
          </svg>
        </span>
        <span className="mc-poi-meter" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </span>
        <span className="mc-poi-label mc-block-poi-label" aria-hidden>
          {label}
        </span>
        {mapDebug && <span className="mc-poi-debugLabel">{label}</span>}
      </button>
      <PoiTooltip
        label={label}
        masteryPct={pct}
        state={state}
        anchorRef={anchorRef}
        visible={showTooltip && !showPanel && !isMobile}
        onHoverStart={() => setShowTooltip(true)}
        onHoverEnd={() => setShowTooltip(false)}
      />
      <PoiInfoPanel
        open={showPanel || (isMobile && showTooltip)}
        label={label}
        masteryPct={pct}
        state={state}
        onClose={() => { setShowPanel(false); setShowTooltip(false) }}
        onStart={isMobile ? onStart : undefined}
        entityLabel="Bloc"
        metricLabel="Maîtrise"
      />
    </>
  )
}
