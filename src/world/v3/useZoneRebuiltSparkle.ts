import React from 'react'
import { useReducedMotion } from 'framer-motion'

const SPARKLE_MS = 900
const cache = new Set<string>()

function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch {
    return null
  }
}

export function useZoneRebuiltSparkle(zoneKey: string, isRebuilt: boolean): { sparkle: boolean } {
  const reduceMotion = useReducedMotion()
  const [sparkle, setSparkle] = React.useState(false)
  const prevRef = React.useRef(isRebuilt)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  React.useEffect(() => {
    const storage = safeStorage()
    const key = `mc_zone_sparkled_${zoneKey}`
    const already = cache.has(key) || (storage?.getItem(key) === '1')

    const justCompleted = !prevRef.current && isRebuilt
    prevRef.current = isRebuilt

    if (reduceMotion || !justCompleted || already) {
      setSparkle(false)
      return
    }

    cache.add(key)
    if (storage) {
      try { storage.setItem(key, '1') } catch { /* ignore */ }
    }

    setSparkle(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setSparkle(false), SPARKLE_MS)
  }, [isRebuilt, reduceMotion, zoneKey])

  return { sparkle }
}
