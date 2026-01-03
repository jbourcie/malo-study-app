import React from 'react'
import { AnimatePresence } from 'framer-motion'
import { TopBar } from '../TopBar'
import { PageTransition } from '../PageTransition'

export function AppShellMap({ children, routeKey, navContext }: { children: React.ReactNode; routeKey: string; navContext?: unknown }) {
  const topbarRef = React.useRef<HTMLDivElement | null>(null)
  const [topbarHeight, setTopbarHeight] = React.useState<number>(72)

  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  React.useLayoutEffect(() => {
    const el = topbarRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const update = () => {
      setTopbarHeight(el.getBoundingClientRect().height || 72)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="mc-shell" aria-label="Carte MaloCraft" style={{ ['--mc-topbar-height' as any]: `${topbarHeight}px` }}>
      <div className="mc-shell__topbar" ref={topbarRef}>
        <div className="container">
          <TopBar />
        </div>
      </div>
      <div className="mc-shell__viewport">
        <AnimatePresence mode="wait" initial={false}>
          <PageTransition routeKey={routeKey} navContext={navContext}>
            <div className="mc-shell__viewportInner">
              <div className="container mc-shell__viewportContent">
                {children}
              </div>
            </div>
          </PageTransition>
        </AnimatePresence>
      </div>
    </div>
  )
}
