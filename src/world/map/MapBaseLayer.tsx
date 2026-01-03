import React from 'react'

type MapBaseLayerProps = {
  baseLayerUrl: string
  width: number
  height: number
}

export function MapBaseLayer({ baseLayerUrl, width, height }: MapBaseLayerProps) {
  const isSvg = React.useMemo(() => isSvgLayer(baseLayerUrl), [baseLayerUrl])
  const [svgMarkup, setSvgMarkup] = React.useState<string | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const aspectRatio = width > 0 && height > 0 ? `${width} / ${height}` : '16 / 9'

  React.useEffect(() => {
    setLoadError(null)
    if (!isSvg) {
      setSvgMarkup(null)
      return
    }
    let cancelled = false
    const fetchSvg = async () => {
      try {
        const res = await fetch(baseLayerUrl)
        if (!res.ok) {
          if (typeof console !== 'undefined' && console.info) {
            console.info('[MapBaseLayer] Base layer unavailable', { url: baseLayerUrl, status: res.status })
          }
          if (!cancelled) setLoadError(`Base layer unavailable (${res.status})`)
          return
        }
        const text = await res.text()
        if (!cancelled) setSvgMarkup(text)
      } catch (err: any) {
        if (typeof console !== 'undefined' && console.info) {
          console.info('[MapBaseLayer] Failed to load base layer', { url: baseLayerUrl, error: err?.message || err })
        }
        if (!cancelled) setLoadError('Base layer unavailable')
      }
    }
    fetchSvg()
    return () => {
      cancelled = true
    }
  }, [baseLayerUrl, isSvg])

  const renderFallback = (withLabel: boolean) => (
    <div className="mc-map-base-layer__fallback" aria-hidden>
      <div className="mc-map-base-layer__fallbackPattern" />
      {withLabel && <div className="mc-map-base-layer__fallbackLabel">Carte indisponible</div>}
    </div>
  )

  const renderRaster = () => {
    if (loadError) return renderFallback(true)
    return (
      <img
        src={baseLayerUrl}
        alt=""
        aria-hidden
        loading="lazy"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
        onError={() => {
          if (typeof console !== 'undefined' && console.info) {
            console.info('[MapBaseLayer] Raster base layer unavailable', { url: baseLayerUrl })
          }
          setLoadError('Base layer unavailable')
        }}
      />
    )
  }

  const renderSvg = () => {
    if (loadError) return renderFallback(true)
    if (!svgMarkup) return renderFallback(false)
    return <div className="mc-map-base-layer__svg" aria-hidden dangerouslySetInnerHTML={{ __html: svgMarkup }} />
  }

  return (
    <div className="mc-map-base-layer" style={{ aspectRatio, width: '100%' }}>
      {isSvg ? renderSvg() : renderRaster()}
    </div>
  )
}
import { isSvgLayer } from './isSvgLayer'
