import React from 'react'
import { joinUrl, trimTrailingSlash } from '../graphicPacks/url'
import { assetExists } from './assetExistsCache'
import { ZoneTile } from '../map/ZoneTile'
import { computeZoneConstructionStage, shouldShowConstruction } from './constructionStages'
import type { ZoneVisualState } from './progressionStates'
import { useZoneRebuiltSparkle } from './useZoneRebuiltSparkle'

type ZoneMonumentState = ZoneVisualState

type ZoneMonumentProps = {
  subjectId: 'fr' | 'math' | 'en' | 'es' | 'hist'
  zoneSlug: string
  label: string
  state: ZoneMonumentState
  progressPct: number
  highlight?: boolean
  onOpen?: () => void
  packBaseUrl: string
}

function buildMonumentUrl(packBaseUrl: string, subjectId: string, zoneSlug: string, state: string) {
  const base = trimTrailingSlash(packBaseUrl || '/')
  return joinUrl(base, `monuments/${subjectId}/${zoneSlug}/monument_${state}.svg`)
}

export function ZoneMonument({
  subjectId,
  zoneSlug,
  label,
  state,
  progressPct,
  highlight,
  onOpen,
  packBaseUrl,
}: ZoneMonumentProps) {
  const [assetUrl, setAssetUrl] = React.useState<string | null>(null)
  const [missing, setMissing] = React.useState(false)
  const [overlayUrl, setOverlayUrl] = React.useState<string | null>(null)
  const [overlayMissing, setOverlayMissing] = React.useState(false)
  const [sparkleUrl, setSparkleUrl] = React.useState<string | null>(null)
  const [sparkleMissing, setSparkleMissing] = React.useState(false)
  const pct = Math.min(100, Math.max(0, Math.round(progressPct || 0)))
  const stage = computeZoneConstructionStage(pct)
  const showConstruction = shouldShowConstruction(stage, state)
  const { sparkle } = useZoneRebuiltSparkle(zoneSlug, state === 'rebuilt')

  React.useEffect(() => {
    let cancelled = false
    const preferred = buildMonumentUrl(packBaseUrl, subjectId, zoneSlug, state)
    const lockedUrl = state === 'locked' ? preferred : buildMonumentUrl(packBaseUrl, subjectId, zoneSlug, 'locked')

    setMissing(false)
    setAssetUrl(null)

    async function run() {
      const hasPreferred = await assetExists(preferred)
      if (cancelled) return
      if (hasPreferred) {
        setAssetUrl(preferred)
        return
      }
      const hasLocked = await assetExists(lockedUrl)
      if (cancelled) return
      if (hasLocked) {
        setAssetUrl(lockedUrl)
        return
      }
      setMissing(true)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [packBaseUrl, subjectId, zoneSlug, state])

  React.useEffect(() => {
    let cancelled = false
    if (!showConstruction) {
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

  React.useEffect(() => {
    let cancelled = false
    if (!sparkle) {
      setSparkleUrl(null)
      setSparkleMissing(false)
      return
    }
    const base = trimTrailingSlash(packBaseUrl || '/')
    const primary = joinUrl(base, `monuments/${subjectId}/${zoneSlug}/sparkle.svg`)
    const fallback = joinUrl(base, 'effects/sparkle.svg')
    async function run() {
      const hasPrimary = await assetExists(primary)
      if (cancelled) return
      if (hasPrimary) {
        setSparkleUrl(primary)
        setSparkleMissing(false)
        return
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

  if (missing) {
    return (
      <ZoneTile
        label={label}
        state={state === 'locked' ? 'locked' : state === 'weathered' ? 'weathered' : state}
        progressPct={pct}
        highlight={highlight}
        onOpenZone={onOpen}
        subjectId={subjectId}
        zoneSlug={zoneSlug}
        packBaseUrl={packBaseUrl}
      />
    )
  }

  const classes = ['mc-monument', `is-${state}`]
  if (highlight) classes.push('is-highlighted')
  if (overlayMissing && showConstruction) classes.push(`mc-construction-stage-${stage}`)
  if (sparkleMissing && sparkle) classes.push('mc-zone-sparkle--fallback')

  return (
    <button
      type="button"
      className={classes.join(' ')}
      aria-label={`Ouvrir la zone ${label}, progression ${pct}%`}
      onClick={onOpen}
    >
      {state === 'rebuilding' && (
        <div className="mc-monument__badge" aria-hidden>
          🛠️
        </div>
      )}
      <div className="mc-monument__art" aria-hidden>
        {assetUrl ? <img src={assetUrl} alt="" loading="lazy" /> : <div className="mc-monument__placeholder" />}
        {showConstruction && overlayUrl && (
          <img className="mc-monument__overlay" src={overlayUrl} alt="" loading="lazy" />
        )}
        {showConstruction && overlayMissing && (
          <div className="mc-construction-overlay" />
        )}
        {sparkle && sparkleUrl && (
          <img className="mc-zone-sparkle" src={sparkleUrl} alt="" loading="lazy" />
        )}
        {sparkle && !sparkleUrl && sparkleMissing && (
          <div className="mc-zone-sparkle mc-zone-sparkle--fallback" />
        )}
      </div>
      <div className="mc-monument__label">{label}</div>
      <div className="mc-monument__progress" data-pct={pct} aria-hidden>
        <svg viewBox="0 0 42 42" className="mc-monument__ring">
          <circle className="mc-monument__ring-bg" cx="21" cy="21" r="18" />
          <circle
            className="mc-monument__ring-fg"
            cx="21"
            cy="21"
            r="18"
            strokeDasharray={`${(pct / 100) * 113}, 200`}
          />
        </svg>
        <span className="mc-monument__pct">{pct}%</span>
      </div>
    </button>
  )
}
