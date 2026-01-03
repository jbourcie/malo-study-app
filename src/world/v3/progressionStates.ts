import type { Timestamp } from 'firebase/firestore'

export type ZoneVisualState = 'locked' | 'foundation' | 'rebuilding' | 'rebuilt' | 'weathered'
export type BlockVisualState = 'cracked' | 'repairing' | 'repaired' | 'enhanced' | 'weathered'
export type BiomeVisualState = 'low' | 'mid' | 'high' | 'max' | 'weathered'

export const WEATHER_DAYS_DEFAULT = 14
export const BLOCK_THRESHOLDS = {
  repairing: 40,
  repaired: 70,
  enhanced: 85,
}

type DateLike = Date | number | Timestamp | { toMillis?: () => number; toDate?: () => Date } | null | undefined

function toMillis(value: DateLike): number | null {
  if (!value) return null
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  if (typeof value === 'object') {
    if (typeof (value as any).toMillis === 'function') return (value as any).toMillis()
    if (typeof (value as any).toDate === 'function') return (value as any).toDate().getTime()
    if (typeof (value as any).seconds === 'number') {
      const nanos = typeof (value as any).nanoseconds === 'number' ? (value as any).nanoseconds : 0
      return (value as any).seconds * 1000 + nanos / 1e6
    }
  }
  return null
}

function isWeathered(lastActivity: DateLike, now: Date, weatherDays: number): boolean {
  const ms = toMillis(lastActivity)
  if (!ms) return false
  return now.getTime() - ms > weatherDays * 24 * 60 * 60 * 1000
}

export function computeZoneVisualState(args: {
  zoneProgressCorrect: number
  zoneLastActivityAt?: DateLike
  now: Date
  weatherDays?: number
}): ZoneVisualState {
  const correct = Math.max(0, Math.round(args.zoneProgressCorrect || 0))
  const weatherDays = typeof args.weatherDays === 'number' ? args.weatherDays : WEATHER_DAYS_DEFAULT
  const weathered = correct >= 100 && isWeathered(args.zoneLastActivityAt, args.now, weatherDays)
  if (weathered) return 'weathered'
  if (correct >= 100) return 'rebuilt'
  if (correct > 0) return 'rebuilding'
  return 'foundation'
}

export function computeBlockVisualState(args: {
  masteryPct: number
  tagLastActivityAt?: DateLike
  now: Date
  weatherDays?: number
}): BlockVisualState {
  const pct = Math.max(0, Math.round(args.masteryPct || 0))
  const weatherDays = typeof args.weatherDays === 'number' ? args.weatherDays : WEATHER_DAYS_DEFAULT
  const weathered = pct > 0 && isWeathered(args.tagLastActivityAt, args.now, weatherDays)
  if (weathered) return 'weathered'
  if (pct >= BLOCK_THRESHOLDS.enhanced) return 'enhanced'
  if (pct >= BLOCK_THRESHOLDS.repaired) return 'repaired'
  if (pct >= BLOCK_THRESHOLDS.repairing) return 'repairing'
  return 'cracked'
}

export function computeBiomeVisualState(args: {
  biomeRebuiltPct: number
  biomeLastActivityAt?: DateLike
  now: Date
  weatherDays?: number
}): BiomeVisualState {
  const pct = Math.max(0, Math.round(args.biomeRebuiltPct || 0))
  const weatherDays = typeof args.weatherDays === 'number' ? args.weatherDays : WEATHER_DAYS_DEFAULT
  const weathered = pct > 0 && isWeathered(args.biomeLastActivityAt, args.now, weatherDays)
  if (weathered) return 'weathered'
  if (pct >= 80) return 'max'
  if (pct >= 50) return 'high'
  if (pct >= 25) return 'mid'
  return 'low'
}
