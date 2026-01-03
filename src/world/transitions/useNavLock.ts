import React from 'react'

export function useNavLock(durationMs = 450) {
  const [locked, setLocked] = React.useState(false)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const lock = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    setLocked(true)
    timerRef.current = setTimeout(() => setLocked(false), durationMs)
  }, [durationMs])

  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return { locked, lock }
}
