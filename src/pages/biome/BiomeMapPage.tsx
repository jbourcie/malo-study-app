import React from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { getBiome, subjectToBiomeId } from '../../game/biomeCatalog'
import { resolveBiomeAnchor } from '../../world/map/resolveBiomeAnchor'
import { resolveZoneAnchors } from '../../world/map/resolveZoneAnchors'
import { MapOverlayLayout } from '../../world/map/MapOverlayLayout'
import { MapBaseLayer } from '../../world/map/MapBaseLayer'
import { computeZoneProgress } from '../../world/map/zoneProgress'
import { useUserRewards } from '../../state/useUserRewards'
import { useAuth } from '../../state/useAuth'
import { loadGraphicPack } from '../../world/graphicPacks/loadGraphicPack'
import { getDefaultGraphicPackManifestUrl } from '../../world/graphicPacks/registry'
import type { LoadedGraphicPack } from '../../world/graphicPacks/types'
import { resolveBiomeMap, resolveWorldMap, hasZoneMap } from '../../world/map/resolveMap'
import { MapAnchorsDebugLayer } from '../../world/map/MapAnchorsDebugLayer'
import { BiomeSidePanel } from '../../world/map/BiomeSidePanel'
import { getTagsForZone } from '../../world/map/getTagsForZone'
import { setNavAnchor } from '../../world/transitions/navAnchors'
import { useNavLock } from '../../world/transitions/useNavLock'
import { computeBiomeVisualState, computeZoneVisualState } from '../../world/v3/progressionStates'
import { ZonePOI } from '../../world/v3/ZonePOI'
import { slugifyZoneLabel } from '../../world/slug'

type ZoneAnchorEntry = ReturnType<typeof resolveZoneAnchors>[number]

function toMillis(value: any): number | null {
  if (!value) return null
  if (typeof value === 'number') return value
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'object') {
    if (typeof value.toMillis === 'function') return value.toMillis()
    if (typeof value.toDate === 'function') return value.toDate().getTime()
    if (typeof value.seconds === 'number') return value.seconds * 1000 + (value.nanoseconds ? value.nanoseconds / 1e6 : 0)
  }
  return null
}

export function BiomeMapPage() {
  const { biomeId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, activeChild } = useAuth()
  const playerUid = activeChild?.id || user?.uid || null
  const { rewards } = useUserRewards(playerUid)
  const [pack, setPack] = React.useState<LoadedGraphicPack | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const overlayRef = React.useRef<HTMLDivElement | null>(null)
  const mapDebug = React.useMemo(() => {
    const envFlag = ((import.meta as any)?.env?.VITE_MAP_DEBUG || '').toString().toLowerCase()
    const env = envFlag === 'true' || envFlag === '1'
    const params = new URLSearchParams(location.search)
    const qp = params.get('mapDebug')?.toLowerCase()
    const qpFlag = qp === '1' || qp === 'true'
    return env || qpFlag
  }, [location.search])
  const [selectedZoneKey, setSelectedZoneKey] = React.useState<string | null>(null)
  const [panelOpen, setPanelOpen] = React.useState<boolean>(false)
  const [debugAnchors, setDebugAnchors] = React.useState<Record<string, { x: number; y: number; radius?: number }>>({})
  const { locked: navLocked, lock: lockNav } = useNavLock(450)
  const nowRef = React.useRef(new Date())

  const getZoneLastActivity = React.useCallback((zone: ZoneAnchorEntry) => {
    const rebuildEntry = rewards.zoneRebuildProgress?.[zone.zoneKey]
    const base = toMillis(rebuildEntry?.updatedAt) || toMillis(rebuildEntry?.rebuiltAt) || 0
    let latest = base
    zone.tagIds.forEach((tagId) => {
      const ts = toMillis(rewards.blockProgress?.[tagId]?.updatedAt)
      if (ts && ts > latest) latest = ts
    })
    return latest ? new Date(latest) : null
  }, [rewards.blockProgress, rewards.zoneRebuildProgress])


  React.useEffect(() => {
    const url = getDefaultGraphicPackManifestUrl()
    loadGraphicPack(url)
      .then((p) => {
        setPack(p)
      })
      .catch((e) => setError(e?.message || 'Pack indisponible'))
  }, [])

  const biome = React.useMemo(() => {
    const direct = biomeId ? getBiome(biomeId as any) : null
    if (direct) return direct
    const asSubject = ['fr', 'math', 'en', 'es', 'hist'].includes(biomeId) ? getBiome(subjectToBiomeId(biomeId as any)) : null
    return asSubject || null
  }, [biomeId])
  const biomeIdResolved = biome?.id || biomeId

  const mapResolved = pack && biome ? resolveBiomeMap(pack.manifest, pack.packRootUrl, biomeIdResolved, biome.subject) : null
  const resolvedMap = pack ? (mapResolved || resolveWorldMap(pack.manifest, pack.packRootUrl)) : null
  const biomeAnchorBase = (pack && biome) ? resolveBiomeAnchor(biome, pack.manifest, null) : null
  const biomeAnchor = mapDebug && biome && debugAnchors[`biome:${biome.id}`] ? debugAnchors[`biome:${biome.id}`] : biomeAnchorBase
  const zoneAnchors = (pack && biome) ? resolveZoneAnchors(biome.subject as any, pack.manifest) : []

  const goToZone = React.useCallback((targetBiomeId: string, zone: ZoneAnchorEntry) => {
    if (navLocked) return
    lockNav()
    const mapSize = resolvedMap ? { w: resolvedMap.width, h: resolvedMap.height } : null
    setNavAnchor(
      'biome',
      zone?.anchor ? { x: zone.anchor.x, y: zone.anchor.y } : undefined,
      mapSize || undefined,
    )
    const zoneSlug = slugifyZoneLabel(zone.themeLabel)
    const params = new URLSearchParams()
    params.set('label', zone.themeLabel)
    navigate(`/zone/${targetBiomeId}/${zoneSlug}?${params.toString()}`)
  }, [lockNav, navLocked, navigate, resolvedMap])

  const chips = zoneAnchors.map(zone => {
    const progress = computeZoneProgress(zone, { blockProgress: rewards.blockProgress || {}, zoneRebuildProgress: rewards.zoneRebuildProgress || {} })
    const lastActivity = getZoneLastActivity(zone)
    const state = computeZoneVisualState({
      zoneProgressCorrect: progress.correctCount,
      zoneLastActivityAt: lastActivity || undefined,
      now: nowRef.current,
    })
    return { zone, progress, lastActivity, state }
  })

  const biomeVisualState = React.useMemo(() => {
    if (!biome) return null
    const totalZones = chips.length || 1
    const rebuiltZones = chips.filter(c => c.progress.progressPct >= 100).length
    const rebuiltPct = Math.round((rebuiltZones / totalZones) * 100)
    let latest = 0
    chips.forEach(c => {
      const ts = toMillis(c.lastActivity)
      if (ts && ts > latest) latest = ts
    })
    const entry = rewards.biomeRebuildProgress?.[biome.subject]
    const entryPct = entry ? Math.round((entry.correctCount / (entry.target || 100)) * 100) : null
    const pct = typeof entryPct === 'number' ? entryPct : rebuiltPct
    const last = entry?.updatedAt || entry?.rebuiltAt || (latest ? new Date(latest) : null)
    return computeBiomeVisualState({
      biomeRebuiltPct: pct,
      biomeLastActivityAt: last || undefined,
      now: nowRef.current,
    })
  }, [biome, chips, rewards.biomeRebuildProgress])

  const biomeProgressPct = React.useMemo(() => {
    if (!biome) return 0
    const entry = rewards.biomeRebuildProgress?.[biome.subject]
    if (entry && typeof entry.correctCount === 'number') {
      return Math.round((entry.correctCount / (entry.target || 100)) * 100)
    }
    if (chips.length) {
      const avg = chips.reduce((acc, c) => acc + (c.progress.progressPct || 0), 0) / chips.length
      return Math.round(avg)
    }
    return 0
  }, [biome, chips, rewards.biomeRebuildProgress])

  React.useEffect(() => {
    const params = new URLSearchParams(location.search)
    const zoneParam = params.get('zone')
    if (!zoneParam) return
    const target = chips.find(c => c.zone.zoneKey === zoneParam || c.zone.themeLabel === zoneParam)
    if (target) {
      setSelectedZoneKey(target.zone.zoneKey)
      setPanelOpen(true)
    }
  }, [location.search, chips])

  const selectedZone = selectedZoneKey ? chips.find(c => c.zone.zoneKey === selectedZoneKey) : null
  const tagsForZone = (selectedZone && biome) ? getTagsForZone(biome.subject as any, selectedZone.zone.themeLabel) : []

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [biomeId])

  return (
    <div className={`container grid ${biomeVisualState ? `mc-biome-state-${biomeVisualState}` : ''}`} style={{ gap: 16 }}>
      {!biome && <div className="card">Biome inconnu.</div>}
      {error && <div className="card">Pack indisponible : {error}</div>}
      {!pack && !error && <div className="card">Chargement pack...</div>}

      {biome && pack && resolvedMap && (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <button className="mc-button secondary" onClick={() => navigate('/home')}>← Retour au monde</button>
              <div className="small" style={{ color: 'var(--mc-muted)' }}>{biome?.name}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr auto' }}>
            <div style={{ position: 'relative', aspectRatio: `${resolvedMap?.width || 16}/${resolvedMap?.height || 9}`, width: '100%', overflow: 'hidden' }}>
              <MapBaseLayer baseLayerUrl={resolvedMap.baseLayerUrl} width={resolvedMap.width} height={resolvedMap.height} />
              <div ref={overlayRef} style={{ position: 'absolute', inset: 0 }}>
                {resolvedMap && (
                  <div className="mc-zone-miniProgress" aria-hidden style={{ position: 'absolute', top: 10, left: 10, zIndex: 3, pointerEvents: 'none' }}>
                    <div className="mc-zone-miniProgress__badge">
                      <div className="mc-zone-miniProgress__label" title={biome.name}>{biome.name}</div>
                      <div className="mc-zone-miniProgress__circle">
                        <svg viewBox="0 0 40 40" className="mc-zone-miniProgress__ring">
                          <circle className="mc-zone-miniProgress__ring-bg" cx="20" cy="20" r="15" />
                          <circle
                            className="mc-zone-miniProgress__ring-fg"
                            cx="20"
                            cy="20"
                            r="15"
                            strokeDasharray={`${(Math.min(100, Math.max(0, Math.round(biomeProgressPct))) / 100) * 94}, 180`}
                          />
                        </svg>
                        <div className="mc-zone-miniProgress__pct">{Math.round(biomeProgressPct)}%</div>
                      </div>
                    </div>
                  </div>
                )}
                <MapOverlayLayout width={resolvedMap.width} height={resolvedMap.height} safeArea={resolvedMap.safeArea}>
                  {(toCssPos) => (
                    <>
                      {chips.map(({ zone, progress, state }) => {
                        const override = mapDebug ? debugAnchors[`zone:${zone.zoneKey}`] : null
                        const anchor = override || zone.anchor
                        const canRouteZone = pack && hasZoneMap(pack.manifest, biome.id, zone.zoneKey, biome.subject, zone.themeLabel)
                        const openPanel = () => { setSelectedZoneKey(zone.zoneKey); setPanelOpen(true) }
                        return (
                          <div key={zone.zoneKey} style={{ ...toCssPos(anchor), display: 'flex', justifyContent: 'center', pointerEvents: 'auto' }}>
                            <ZonePOI
                              label={zone.themeLabel}
                              progressPct={progress.progressPct}
                              state={state}
                              highlight={selectedZoneKey === zone.zoneKey}
                              subjectId={biome.subject as any}
                              zoneSlug={zone.zoneKey}
                              packBaseUrl={pack.packRootUrl}
                              onEnter={canRouteZone ? () => goToZone(biome.id, { ...zone, anchor }) : openPanel}
                              onShowPanel={openPanel}
                              mapDebug={mapDebug}
                              radiusPx={anchor?.radius}
                            />
                          </div>
                        )
                      })}
                    </>
                  )}
                </MapOverlayLayout>
                {mapDebug && (
                  <MapAnchorsDebugLayer
                    width={resolvedMap?.width || 1920}
                    height={resolvedMap?.height || 1080}
                    anchors={[
                      ...(biomeAnchor ? [{ id: `biome:${biome?.id}`, anchor: biomeAnchor }] : []),
                      ...chips.map(c => {
                        const override = debugAnchors[`zone:${c.zone.zoneKey}`]
                        return { id: `zone:${c.zone.zoneKey}`, anchor: override || c.zone.anchor }
                      }),
                    ]}
                    safeArea={resolvedMap?.safeArea}
                    containerRef={overlayRef}
                    onAnchorChange={(id, anchor) => {
                      setDebugAnchors((prev) => ({ ...prev, [id]: anchor }))
                    }}
                  />
                )}
                {mapDebug && (
                  <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      className="mc-button secondary"
                      onClick={() => {
                        const zonesObj: Record<string, { x: number; y: number; radius?: number }> = {}
                        chips.forEach(c => {
                          const key = c.zone.themeLabel
                          const anchor = debugAnchors[`zone:${c.zone.zoneKey}`] || c.zone.anchor
                          zonesObj[key] = {
                            x: Math.round(anchor.x),
                            y: Math.round(anchor.y),
                            ...(typeof anchor.radius === 'number' ? { radius: Math.round(anchor.radius) } : {}),
                          }
                        })
                        const payload = {
                          anchors: {
                            biomes: {
                              [biome.subject]: {
                                zones: zonesObj,
                              },
                            },
                          },
                        }
                        const json = JSON.stringify(payload, null, 2)
                        const doPrompt = () => prompt('Copier les anchors zones dans pack.json', json)
                        const copyViaTextarea = () => {
                          const ta = document.createElement('textarea')
                          ta.value = json
                          ta.style.position = 'fixed'
                          ta.style.opacity = '0'
                          document.body.appendChild(ta)
                          ta.select()
                          try {
                            document.execCommand('copy')
                            console.info('[Biome mapDebug] anchors copied via execCommand')
                          } catch (err) {
                            console.warn('[Biome mapDebug] execCommand copy failed', err)
                            doPrompt()
                          } finally {
                            document.body.removeChild(ta)
                          }
                        }
                        if (navigator?.clipboard?.writeText) {
                          navigator.clipboard.writeText(json)
                            .then(() => console.info('[Biome mapDebug] anchors copied to clipboard'))
                            .catch((err) => {
                              console.warn('[Biome mapDebug] clipboard.writeText failed', err)
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

            <BiomeSidePanel
              open={panelOpen && !!selectedZone}
              biome={biome || undefined}
              zone={selectedZone?.zone || null}
              progress={selectedZone?.progress || null}
              tags={tagsForZone}
              rewards={rewards}
              onClose={() => { setPanelOpen(false); setSelectedZoneKey(null) }}
              onNavigateTheme={(theme) => navigate(`/theme/reconstruction_${encodeURIComponent(theme)}?sessionKind=reconstruction_theme&subjectId=${biome.subject}&theme=${encodeURIComponent(theme)}`)}
              onNavigateTag={(tagId) => navigate(`/theme/expedition?targetTagId=${encodeURIComponent(tagId)}`)}
            />
          </div>
        </>
      )}
    </div>
  )
}
