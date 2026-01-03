import React from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { getBiome } from '../../game/biomeCatalog'
import { useAuth } from '../../state/useAuth'
import { useUserRewards } from '../../state/useUserRewards'
import { getDefaultGraphicPackManifestUrl } from '../../world/graphicPacks/registry'
import { loadGraphicPack } from '../../world/graphicPacks/loadGraphicPack'
import type { LoadedGraphicPack } from '../../world/graphicPacks/types'
import { resolveZoneMap, hasZoneMap } from '../../world/map/resolveMap'
import { MapBaseLayer } from '../../world/map/MapBaseLayer'
import { MapOverlayLayout } from '../../world/map/MapOverlayLayout'
import { MapAnchorsDebugLayer } from '../../world/map/MapAnchorsDebugLayer'
import { getTagsForZone } from '../../world/map/getTagsForZone'
import { BlockTile } from '../../world/map/BlockTile'
import { nudgeRectPlacement, type Rect } from '../../world/overlay/layout/nudgePlacement'
import { computeZoneProgress } from '../../world/map/zoneProgress'
import { BlockPOI } from '../../world/v3/BlockPOI'
import { ZoneMonument } from '../../world/v3/ZoneMonument'
import { pickPoiTags } from '../../world/v3/pickPoiTags'
import { computeBlockVisualState, computeBiomeVisualState, computeZoneVisualState } from '../../world/v3/progressionStates'
import { slugifyZoneLabel } from '../../world/slug'

type PoiVisualState = 'cracked' | 'repairing' | 'repaired' | 'enhanced' | 'weathered'
const MONUMENT_RATIO = 1.35

function toMillis(value: any): number | null {
  if (!value) return null
  if (typeof value === 'number') return value
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  if (typeof value.seconds === 'number') return value.seconds * 1000 + (value.nanoseconds ? value.nanoseconds / 1e6 : 0)
  return null
}

export function ZoneMapPage() {
  const { biomeId = '', zoneKey = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, activeChild } = useAuth()
  const playerUid = activeChild?.id || user?.uid || null
  const { rewards } = useUserRewards(playerUid)
  const [pack, setPack] = React.useState<LoadedGraphicPack | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const overlayRef = React.useRef<HTMLDivElement | null>(null)
  const [isRedirecting, setIsRedirecting] = React.useState(false)
  const [overlaySize, setOverlaySize] = React.useState<{ width: number, height: number } | null>(null)
  const [debugAnchors, setDebugAnchors] = React.useState<Record<string, { x: number; y: number; radius?: number }>>({})

  React.useLayoutEffect(() => {
    const el = overlayRef.current
    if (!el) return
    const updateSize = () => {
      const rect = el.getBoundingClientRect()
      setOverlaySize({ width: rect.width, height: rect.height })
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    const url = getDefaultGraphicPackManifestUrl()
    loadGraphicPack(url)
      .then((p) => {
        setPack(p)
      })
      .catch((e) => setError(e?.message || 'Pack indisponible'))
  }, [])

  const query = React.useMemo(() => new URLSearchParams(location.search), [location.search])
  const mapDebug = React.useMemo(() => {
    const envFlag = ((import.meta as any)?.env?.VITE_MAP_DEBUG || '').toString() === 'true'
    const queryFlag = query.get('mapDebug') === '1'
    return envFlag || queryFlag
  }, [query])
  const labelParam = query.get('label') || ''
  const themeLabel = labelParam || zoneKey

  const biome = biomeId ? (getBiome(biomeId as any) || null) : null
  const hasMap = pack && biome ? hasZoneMap(pack.manifest, biomeId, zoneKey, biome.subject, themeLabel) : false
  const resolvedMap = pack && biome && hasMap ? resolveZoneMap(pack.manifest, pack.packRootUrl, biomeId, zoneKey, biome.subject, themeLabel) : null
  const packBaseUrl = pack?.packRootUrl || ''
  const nowRef = React.useRef(new Date())

  React.useEffect(() => {
    if (pack && !hasMap && biomeId && zoneKey) {
      setIsRedirecting(true)
      navigate(`/biome/${biomeId}?zone=${encodeURIComponent(zoneKey)}`, { replace: true })
    }
  }, [pack, hasMap, biomeId, zoneKey, navigate])

  const tags = React.useMemo(() => biome ? getTagsForZone(biome.subject as any, themeLabel) : [], [biome, themeLabel])
  const zoneKeyStorage = biome ? `${biome.subject}__${themeLabel}` : themeLabel
  const progress = React.useMemo(() => computeZoneProgress({
      zoneKey: zoneKeyStorage,
      subjectId: (biome?.subject as any) || 'fr',
      themeLabel,
      anchor: { x: 0, y: 0 },
      tagIds: tags.map(t => t.id),
    } as any, { blockProgress: rewards.blockProgress || {}, zoneRebuildProgress: rewards.zoneRebuildProgress || {} }),
    [biome?.subject, rewards.blockProgress, rewards.zoneRebuildProgress, tags, themeLabel, zoneKeyStorage])

  const anchorsRoot = pack?.manifest?.anchors?.zones || {}
  const slugLabel = slugifyZoneLabel(themeLabel)
  const candidateKeys = [
    `${biomeId}:${zoneKey}`,
    `${biomeId}:${themeLabel}`,
    `${biomeId}:${slugLabel}`,
    `${biome?.subject}:${zoneKey}`,
    `${biome?.subject}:${themeLabel}`,
    `${biome?.subject}:${slugLabel}`,
  ]
  const zoneAnchorsEntry = candidateKeys.map(k => anchorsRoot[k]).find(Boolean)
  const blockAnchors = zoneAnchorsEntry?.blocks || {}

  const zoneLastActivity = React.useMemo(() => {
    const entry = rewards.zoneRebuildProgress?.[zoneKey]
    const base = toMillis(entry?.updatedAt) || toMillis(entry?.rebuiltAt) || 0
    let latest = base
    tags.forEach((tag) => {
      const ts = toMillis(rewards.blockProgress?.[tag.id]?.updatedAt)
      if (ts && ts > latest) latest = ts
    })
    return latest ? new Date(latest) : null
  }, [rewards.blockProgress, rewards.zoneRebuildProgress, tags, zoneKey])

  const biomeState = React.useMemo(() => {
    if (!biome) return null
    const entry = rewards.biomeRebuildProgress?.[biome.subject]
    const pct = entry ? Math.min(100, Math.round((entry.correctCount / (entry.target || 100)) * 100)) : 0
    const last = entry?.updatedAt || entry?.rebuiltAt || zoneLastActivity
    return computeBiomeVisualState({
      biomeRebuiltPct: pct,
      biomeLastActivityAt: last || undefined,
      now: nowRef.current,
    })
  }, [biome, rewards.biomeRebuildProgress, zoneLastActivity])

  const blocksWithAnchors = React.useMemo(() => tags.map((tag) => {
    const candKeys = [tag.id, slugifyZoneLabel(tag.label || ''), slugifyZoneLabel(tag.theme || '')]
    const baseAnchor = candKeys.map(k => (blockAnchors as any)[k]).find(Boolean)
    const override = mapDebug ? debugAnchors[tag.id] : null
    const anchor = override || baseAnchor
    return anchor ? { tag, anchor } : null
  }).filter(Boolean) as Array<{ tag: typeof tags[number]; anchor: { x: number; y: number; radius?: number } }>, [tags, blockAnchors, debugAnchors, mapDebug])

  const anchorByTagId = React.useMemo(() => {
    const map = new Map<string, { tag: typeof tags[number]; anchor: { x: number; y: number; radius?: number } }>()
    blocksWithAnchors.forEach(entry => map.set(entry.tag.id, entry))
    return map
  }, [blocksWithAnchors])

  const recentlyPlayedTags = React.useMemo(() => {
    const entries = Object.entries(rewards.blockProgress || {})
      .map(([tagId, entry]) => ({ tagId, ts: toMillis(entry?.updatedAt) || 0 }))
      .filter(e => e.ts > 0)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 8)
      .map(e => e.tagId)
    return entries
  }, [rewards.blockProgress])

  const poiAnchored = React.useMemo(() => {
    const selected = pickPoiTags({
      tags: blocksWithAnchors.map(b => b.tag),
      masteryByTag: rewards.masteryByTag,
      blockProgress: rewards.blockProgress,
      recentlyPlayed: recentlyPlayedTags,
      limit: 10,
    })
    return selected
      .map(tag => anchorByTagId.get(tag.id))
      .filter(Boolean) as Array<{ tag: typeof tags[number]; anchor: { x: number; y: number; radius?: number } }>
  }, [anchorByTagId, blocksWithAnchors, recentlyPlayedTags, rewards.blockProgress, rewards.masteryByTag])

  // Anti-overlap: deterministic nudge on blocks (does not touch anchors, only render positions)
  const blocksNudged = React.useMemo(() => {
    if (!resolvedMap) return poiAnchored
    const safe = resolvedMap.safeArea || { left: 0, top: 0, right: 0, bottom: 0 }
    const margin = 16
    const monumentSize = Math.min(220, Math.max(160, Math.round(resolvedMap.width * 0.12)))
    const monumentHeight = monumentSize * MONUMENT_RATIO
    const occupied: Rect[] = []
    const bounds = {
      left: 0 + (safe.left || 0) + monumentSize * 0.85,
      top: 0 + (safe.top || 0) + monumentHeight * 0.4,
      right: resolvedMap.width - (safe.right || 0),
      bottom: resolvedMap.height - (safe.bottom || 0),
    }
    return [...poiAnchored]
      .sort((a, b) => a.tag.id.localeCompare(b.tag.id))
      .map((item) => {
        // Estimation taille tuile : largeur fixe, hauteur dépend du label (2 lignes max)
        const label = item.tag.label || ''
        const approxCharsPerLine = 12
        const lines = Math.min(2, Math.ceil(label.length / approxCharsPerLine) || 1)
        const w = 96
        const h = 70 + (lines - 1) * 14
        const desiredTopLeft = { x: item.anchor.x - w / 2, y: item.anchor.y - h / 2 }
        const nudged = nudgeRectPlacement(desiredTopLeft, { w, h }, occupied, bounds, { stepPx: 18, growthEvery: 2, maxTries: 14 })
        occupied.push({ x: nudged.x, y: nudged.y, w, h })
        const center = { x: nudged.x + w / 2, y: nudged.y + h / 2 }
        return { ...item, renderAnchor: center, nudged, size: { w, h } }
      })
  }, [poiAnchored, resolvedMap])

  const blockMasteryPct = React.useCallback((tagId: string) => {
    const mastery = rewards.masteryByTag?.[tagId]?.score
    if (typeof mastery === 'number') return mastery
    const blockScore = rewards.blockProgress?.[tagId]?.score
    if (typeof blockScore === 'number') return blockScore
    return 0
  }, [rewards.blockProgress, rewards.masteryByTag])

  const blockLastActivity = React.useCallback((tagId: string) => {
    return toMillis(rewards.blockProgress?.[tagId]?.updatedAt)
  }, [rewards.blockProgress])

  const blockTileState = React.useCallback((tagId: string) => {
    const state = computeBlockVisualState({
      masteryPct: blockMasteryPct(tagId),
      tagLastActivityAt: blockLastActivity(tagId) || undefined,
      now: nowRef.current,
    })
    if (state === 'enhanced') return 'enhanced' as const
    if (state === 'repaired') return 'repaired' as const
    if (state === 'repairing') return 'repairing' as const
    return 'cracked' as const
  }, [blockLastActivity, blockMasteryPct])

  const blockPoiState = React.useCallback((tagId: string): PoiVisualState => {
    return computeBlockVisualState({
      masteryPct: blockMasteryPct(tagId),
      tagLastActivityAt: blockLastActivity(tagId) || undefined,
      now: nowRef.current,
    })
  }, [blockLastActivity, blockMasteryPct])

  const [showAllBlocks, setShowAllBlocks] = React.useState(blocksWithAnchors.length === 0)
  React.useEffect(() => {
    if (blocksWithAnchors.length === 0) setShowAllBlocks(true)
  }, [blocksWithAnchors.length])

  const monumentState: 'locked' | 'foundation' | 'rebuilding' | 'rebuilt' | 'weathered' =
    computeZoneVisualState({
      zoneProgressCorrect: progress.correctCount,
      zoneLastActivityAt: zoneLastActivity || undefined,
      now: nowRef.current,
    })

  const overlayCount = blocksNudged.length
  const anchoredCount = blocksWithAnchors.length
  const overlayCap = anchoredCount > 0 ? Math.min(10, anchoredCount) : 10
  const monumentSize = React.useMemo(() => {
    if (!resolvedMap) return 0
    return Math.min(220, Math.max(160, Math.round(resolvedMap.width * 0.12)))
  }, [resolvedMap])
  const monumentHeightEstimate = monumentSize * MONUMENT_RATIO
  const monumentAnchor = null

  const lastOverlayLogRef = React.useRef<string>('')
  React.useEffect(() => {
    if (!resolvedMap) return
    const entries = blocksNudged.map((b) => ({
      tagId: b.tag.id,
      label: b.tag.label,
      anchor: b.anchor,
      render: b.renderAnchor,
      size: b.size,
    }))
    const summary = {
      map: { width: resolvedMap.width, height: resolvedMap.height, safeArea: resolvedMap.safeArea || null },
      monument: null,
      poiCount: entries.length,
      poiSample: entries.slice(0, 12),
    }
    const stamp = JSON.stringify(summary)
    if (stamp !== lastOverlayLogRef.current) {
      lastOverlayLogRef.current = stamp
      console.info('[ZoneMap overlay]', summary)
    }
  }, [blocksNudged, resolvedMap])

  const lastDomLogRef = React.useRef<string>('')
  React.useEffect(() => {
    const overlayEl = overlayRef.current
    if (!overlayEl) return
    const frame = requestAnimationFrame(() => {
      const containerRect = overlayEl.getBoundingClientRect()
      const poiEls = Array.from(overlayEl.querySelectorAll('.mc-poi')) as HTMLElement[]
      const poiRects = poiEls.map((el) => {
        const rect = el.getBoundingClientRect()
        return {
          tagId: el.dataset.tagId,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          left: Math.round(rect.left - containerRect.left),
          top: Math.round(rect.top - containerRect.top),
        }
      })
      const payload = {
        container: { width: Math.round(containerRect.width), height: Math.round(containerRect.height) },
        monument: null,
        pois: poiRects,
      }
      const stamp = JSON.stringify(payload)
      if (stamp !== lastDomLogRef.current) {
        lastDomLogRef.current = stamp
        console.info('[ZoneMap overlay DOM]', payload)
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [blocksNudged.length])

  if (!biomeId || !zoneKey) {
    return <div className="container"><div className="card">Zone inconnue.</div></div>
  }
  if (error) return <div className="container"><div className="card">Pack indisponible : {error}</div></div>
  if (!pack || (!resolvedMap && hasMap)) return <div className="container"><div className="card">Chargement map...</div></div>
  if (!hasMap || isRedirecting) return null // redirection initiée

  return (
    <div className={`container grid ${biomeState ? `mc-biome-state-${biomeState}` : ''}`} style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <button className="mc-button secondary" onClick={() => navigate(`/biome/${biomeId}?zone=${encodeURIComponent(zoneKey)}`)}>← Retour biome</button>
          <div className="small" style={{ color: 'var(--mc-muted)' }}>{biomeId} / {zoneKey}</div>
        </div>
      </div>

      <div style={{ position: 'relative', aspectRatio: `${resolvedMap?.width || 16}/${resolvedMap?.height || 9}`, width: '100%', overflow: 'hidden' }}>
        {resolvedMap && (
          <MapBaseLayer baseLayerUrl={resolvedMap.baseLayerUrl} width={resolvedMap.width} height={resolvedMap.height} />
        )}
        <div ref={overlayRef} style={{ position: 'absolute', inset: 0 }}>
          {resolvedMap && (
            <div className="mc-zone-miniProgress" aria-hidden style={{ position: 'absolute', top: 10, left: 10, zIndex: 3 }}>
              <div className="mc-zone-miniProgress__badge">
                <div className="mc-zone-miniProgress__label" title={themeLabel}>{themeLabel}</div>
                <div className="mc-zone-miniProgress__circle">
                  <svg viewBox="0 0 40 40" className="mc-zone-miniProgress__ring">
                    <circle className="mc-zone-miniProgress__ring-bg" cx="20" cy="20" r="15" />
                    <circle
                      className="mc-zone-miniProgress__ring-fg"
                      cx="20"
                      cy="20"
                      r="15"
                      strokeDasharray={`${(Math.min(100, Math.max(0, Math.round(progress.progressPct))) / 100) * 94}, 180`}
                    />
                  </svg>
                  <div className="mc-zone-miniProgress__pct">{Math.round(progress.progressPct)}%</div>
                </div>
              </div>
            </div>
          )}
          {resolvedMap && (
            <MapOverlayLayout width={resolvedMap.width} height={resolvedMap.height} safeArea={resolvedMap.safeArea}>
              {(toCssPos) => (
                <>
                  {blocksNudged.map(({ tag, renderAnchor }) => (
                    <div key={tag.id} style={{ ...toCssPos(renderAnchor), pointerEvents: 'auto' }}>
                      <BlockPOI
                        tagId={tag.id}
                        label={tag.label}
                        masteryPct={blockMasteryPct(tag.id)}
                        state={blockPoiState(tag.id)}
                        highlight={recentlyPlayedTags.includes(tag.id)}
                        onStart={() => navigate(`/theme/expedition?targetTagId=${encodeURIComponent(tag.id)}`)}
                        packBaseUrl={packBaseUrl}
                        mapDebug={mapDebug}
                      />
                    </div>
                  ))}
                </>
              )}
            </MapOverlayLayout>
          )}
          {mapDebug && resolvedMap && (
            <MapAnchorsDebugLayer
              width={resolvedMap.width}
              height={resolvedMap.height}
              anchors={blocksWithAnchors.map(b => ({ id: b.tag.id, anchor: b.anchor }))}
              safeArea={resolvedMap.safeArea}
              containerRef={overlayRef}
              onAnchorChange={(id, anchor) => {
                setDebugAnchors(prev => ({ ...prev, [id]: anchor }))
              }}
            />
          )}
          {mapDebug && blocksWithAnchors.length > 0 && (
            <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 8, alignItems: 'center', zIndex: 5 }}>
              <button
                className="mc-button secondary"
                onClick={() => {
                  const blocksObj: Record<string, { x: number; y: number; radius?: number }> = {}
                  blocksWithAnchors.forEach((b) => {
                    const override = debugAnchors[b.tag.id]
                    const anchor = override || b.anchor
                    blocksObj[b.tag.id] = {
                      x: Math.round(anchor.x),
                      y: Math.round(anchor.y),
                      ...(typeof anchor.radius === 'number' ? { radius: Math.round(anchor.radius) } : {}),
                    }
                  })
                  const payload = {
                    anchors: {
                      zones: {
                        [`${biomeId}:${zoneKey}`]: {
                          ...(resolvedMap.safeArea ? { safeArea: resolvedMap.safeArea } : {}),
                          blocks: blocksObj,
                        },
                      },
                    },
                  }
                  const json = JSON.stringify(payload, null, 2)
                  const doPrompt = () => prompt('Copier les anchors blocs dans pack.json', json)
                  const copyViaTextarea = () => {
                    const ta = document.createElement('textarea')
                    ta.value = json
                    ta.style.position = 'fixed'
                    ta.style.opacity = '0'
                    document.body.appendChild(ta)
                    ta.select()
                    try {
                      document.execCommand('copy')
                      console.info('[ZoneMap mapDebug] anchors copied via execCommand')
                    } catch (err) {
                      console.warn('[ZoneMap mapDebug] execCommand copy failed', err)
                      doPrompt()
                    } finally {
                      document.body.removeChild(ta)
                    }
                  }
                  if (navigator?.clipboard?.writeText) {
                    navigator.clipboard.writeText(json)
                      .then(() => console.info('[ZoneMap mapDebug] anchors copied to clipboard'))
                      .catch((err) => {
                        console.warn('[ZoneMap mapDebug] clipboard.writeText failed', err)
                        copyViaTextarea()
                      })
                  } else {
                    copyViaTextarea()
                  }
                }}
              >
                Copy JSON
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div className="small" style={{ color: 'var(--mc-muted)' }}>
          POI affichés {overlayCount}/{overlayCap || 0} · Total blocs {tags.length}{anchoredCount < tags.length ? ` · ${tags.length - anchoredCount} sans ancre` : ''}
        </div>
        <div className="row" style={{ gap: 8 }}>
          {anchoredCount === 0 && <span className="mc-chip muted">Aucun anchor de bloc sur la carte</span>}
          <button
            className="mc-button"
            onClick={() => setShowAllBlocks((v) => !v)}
            aria-expanded={showAllBlocks}
          >
            {showAllBlocks ? 'Masquer la liste' : `Voir tous les blocs (${tags.length})`}
          </button>
        </div>
      </div>

      {showAllBlocks && (
        <div className="grid2">
          {tags.map(tag => (
            <BlockTile
              key={tag.id}
              tagId={tag.id}
              label={tag.label}
              masteryPct={blockMasteryPct(tag.id)}
              state={blockTileState(tag.id)}
              variant="list"
              onStartSession={() => navigate(`/theme/expedition?targetTagId=${encodeURIComponent(tag.id)}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
