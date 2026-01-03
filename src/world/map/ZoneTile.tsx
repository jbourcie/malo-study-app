import React from 'react'
import { joinUrl, trimTrailingSlash } from '../graphicPacks/url'
import { computeZoneConstructionStage, shouldShowConstruction } from '../v3/constructionStages'
import type { ZoneVisualState } from '../v3/progressionStates'
import { assetExists } from '../v3/assetExistsCache'
import { useZoneRebuiltSparkle } from '../v3/useZoneRebuiltSparkle'

type ZoneTileState = ZoneVisualState
type ZoneTileVariant = 'overlay' | 'debug'

type ZoneTileProps = {
  label: string
  state: ZoneTileState
  progressPct: number
  highlight?: boolean
  variant?: ZoneTileVariant
  radiusPx?: number
  onOpenZone?: () => void
  subjectId?: string
  zoneSlug?: string
  packBaseUrl?: string
}

export function ZoneTile({
  label,
  state,
  progressPct,
  highlight,
  variant = 'overlay',
  radiusPx,
  onOpenZone,
  subjectId,
  zoneSlug,
  packBaseUrl,
}: ZoneTileProps) {
  const pct = Math.min(100, Math.max(0, Math.round(progressPct || 0)))
  const classes = ['mc-zoneTile', `mc-zoneTile--${variant}`, `is-${state}`]
  if (highlight) classes.push('is-highlighted')
  const size = radiusPx ? Math.max(72, Math.min(140, radiusPx * 2.2)) : undefined

  const badge = state === 'locked'
    ? '🔒'
    : state === 'foundation'
    ? '🧱'
    : state === 'rebuilding'
    ? '🛠️'
    : state === 'rebuilt'
    ? '✨'
    : '🌧️'

  const stage = computeZoneConstructionStage(pct)
  const showConstruction = shouldShowConstruction(stage, state)
  const [overlayUrl, setOverlayUrl] = React.useState<string | null>(null)
  const [overlayMissing, setOverlayMissing] = React.useState(false)
  const [sparkleUrl, setSparkleUrl] = React.useState<string | null>(null)
  const [sparkleMissing, setSparkleMissing] = React.useState(false)
  const { sparkle } = useZoneRebuiltSparkle(zoneSlug || label, state === 'rebuilt' && pct >= 100)

  React.useEffect(() => {
    let cancelled = false
    if (!showConstruction || !subjectId || !zoneSlug || !packBaseUrl) {
      setOverlayUrl(null)
      setOverlayMissing(false)
      return
    }
    const base = trimTrailingSlash(packBaseUrl || '/')
    const url = joinUrl(base, `monuments/${subjectId}/${zoneSlug}/construction_stage${stage}.svg`)
    setOverlayUrl(null)
    setOverlayMissing(false)
    assetExists(url).then((ok) => {
      if (cancelled) return
      if (ok) setOverlayUrl(url)
      else setOverlayMissing(true)
    })
    return () => { cancelled = true }
  }, [packBaseUrl, showConstruction, stage, subjectId, zoneSlug])
  if (overlayMissing && showConstruction) classes.push(`mc-construction-stage-${stage}`)

  React.useEffect(() => {
    let cancelled = false
    if (!sparkle || !packBaseUrl) {
      setSparkleUrl(null)
      setSparkleMissing(false)
      return
    }
    const base = trimTrailingSlash(packBaseUrl || '/')
    const primary = subjectId && zoneSlug ? joinUrl(base, `monuments/${subjectId}/${zoneSlug}/sparkle.svg`) : null
    const fallback = joinUrl(base, 'effects/sparkle.svg')
    async function run() {
      if (primary) {
        const hasPrimary = await assetExists(primary)
        if (cancelled) return
        if (hasPrimary) {
          setSparkleUrl(primary)
          setSparkleMissing(false)
          return
        }
      }
      const hasFallback = await assetExists(fallback)
      if (cancelled) return
      if (hasFallback) {
        setSparkleUrl(fallback)
        setSparkleMissing(false)
        return
      }
      setSparkleUrl(null)
      setSparkleMissing(true)
    }
    run()
    return () => { cancelled = true }
  }, [packBaseUrl, sparkle, subjectId, zoneSlug])
  if (sparkleMissing && sparkle) classes.push('mc-zone-sparkle--fallback')

  return (
    <button
      className={classes.join(' ')}
      style={size ? { width: size, height: size } : undefined}
      aria-label={`Ouvrir la zone ${label}, progression ${pct}%`}
      title={`${label} (${pct}%)`}
      onClick={onOpenZone}
      data-stage={showConstruction ? stage : undefined}
    >
      <span className="mc-zoneTile__badge" aria-hidden>{badge}</span>
      {showConstruction && overlayUrl && (
        <img className="mc-zoneTile__overlay" src={overlayUrl} alt="" loading="lazy" />
      )}
      {showConstruction && overlayMissing && (
        <span className={`mc-construction-overlay mc-construction-stage-${stage}`} aria-hidden />
      )}
      {sparkle && sparkleUrl && (
        <img className="mc-zoneTile__sparkle" src={sparkleUrl} alt="" loading="lazy" />
      )}
      {sparkle && !sparkleUrl && sparkleMissing && (
        <span className="mc-zoneTile__sparkle mc-zone-sparkle--fallback" aria-hidden />
      )}
      <span className="mc-zoneTile__label">{label}</span>
      <span className="mc-zoneTile__progress" data-pct={pct}>
        <svg viewBox="0 0 42 42" className="mc-zoneTile__ring" aria-hidden>
          <circle className="mc-zoneTile__ring-bg" cx="21" cy="21" r="18" />
          <circle
            className="mc-zoneTile__ring-fg"
            cx="21"
            cy="21"
            r="18"
            strokeDasharray={`${(pct / 100) * 113}, 200`}
          />
        </svg>
        <span className="mc-zoneTile__pct">{pct}%</span>
      </span>
    </button>
  )
}
