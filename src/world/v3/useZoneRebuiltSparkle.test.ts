import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'

const mockUseReducedMotion = vi.fn(() => false)
vi.mock('framer-motion', () => ({
  useReducedMotion: mockUseReducedMotion,
}))

import { useZoneRebuiltSparkle } from './useZoneRebuiltSparkle'

function renderHook<R>(component: React.ReactElement) {
  const container = document.createElement('div')
  const root = createRoot(container)
  act(() => {
    root.render(component)
  })
  return { root, unmount: () => act(() => root.unmount()) }
}

describe('useZoneRebuiltSparkle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockUseReducedMotion.mockReturnValue(false)
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('triggers once on transition to rebuilt and stops after duration', () => {
    let sparkle = false
    function Test({ rebuilt }: { rebuilt: boolean }) {
      sparkle = useZoneRebuiltSparkle('zone-a', rebuilt).sparkle
      return null
    }
    const { root, unmount } = renderHook(<Test rebuilt={false} />)
    expect(sparkle).toBe(false)
    act(() => {
      root.render(<Test rebuilt={true} />)
    })
    expect(sparkle).toBe(true)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(sparkle).toBe(false)
    act(() => {
      root.render(<Test rebuilt={true} />)
    })
    expect(sparkle).toBe(false)
    unmount()
  })

  it('marks localStorage for idempotence', () => {
    function Test({ rebuilt }: { rebuilt: boolean }) {
      useZoneRebuiltSparkle('zone-b', rebuilt)
      return null
    }
    const { root, unmount } = renderHook(<Test rebuilt={false} />)
    act(() => {
      root.render(<Test rebuilt />)
    })
    expect(window.localStorage.getItem('mc_zone_sparkled_zone-b')).toBe('1')
    unmount()
  })

  it('skips when reduced motion is requested', () => {
    mockUseReducedMotion.mockReturnValue(true)
    let sparkle = false
    function Test({ rebuilt }: { rebuilt: boolean }) {
      sparkle = useZoneRebuiltSparkle('zone-c', rebuilt).sparkle
      return null
    }
    const { unmount } = renderHook(<Test rebuilt={false} />)
    act(() => {
      vi.advanceTimersByTime(10)
    })
    expect(sparkle).toBe(false)
    unmount()
  })
})
