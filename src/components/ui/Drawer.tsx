import React from 'react'

let openDrawers = 0

type DrawerProps = {
  open: boolean
  title?: string
  children: React.ReactNode
  onClose: () => void
  onBack?: () => void
  width?: number
  zIndex?: number
}

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = React.useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(min-width: 900px)').matches
  })
  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(min-width: 900px)')
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    setIsDesktop(mq.matches)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isDesktop
}

export function Drawer({ open, title, children, onClose, onBack, width = 880, zIndex = 900 }: DrawerProps) {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const lastFocused = React.useRef<HTMLElement | null>(null)
  const isDesktop = useIsDesktop()
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem('mc_drawer_collapsed') === 'true'
  })

  React.useEffect(() => {
    try {
      localStorage.setItem('mc_drawer_collapsed', collapsed ? 'true' : 'false')
    } catch {
      // ignore storage errors
    }
  }, [collapsed])

  React.useEffect(() => {
    if (!open) return
    openDrawers += 1
    lastFocused.current = (document.activeElement as HTMLElement) || null
    const el = ref.current
    if (el) {
      const focusable = el.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      focusable?.focus()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      openDrawers = Math.max(0, openDrawers - 1)
      if (openDrawers === 0) {
        document.body.style.overflow = ''
      }
      lastFocused.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  const overlayBackground = isDesktop ? 'linear-gradient(90deg, rgba(8,10,20,0.05), rgba(8,10,20,0.15))' : 'rgba(0,0,0,0.45)'
  const drawerWidth = collapsed && isDesktop ? 72 : isDesktop ? 'clamp(360px, 34vw, 520px)' : Math.min(width, 880)
  const drawerPadding = collapsed && isDesktop ? 12 : 16
  const showContent = !(collapsed && isDesktop)

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: overlayBackground,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'flex-end',
        zIndex,
      }}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={ref}
        className="card mc-card"
        style={{
          width: drawerWidth,
          maxWidth: '80vw',
          height: '100%',
          borderRadius: 0,
          overflowY: 'auto',
          padding: drawerPadding,
          boxShadow: '-6px 0 18px rgba(0,0,0,0.45)',
          background: isDesktop ? 'rgba(10,14,24,0.7)' : undefined,
          backdropFilter: isDesktop ? 'blur(8px)' : undefined,
          borderLeft: isDesktop ? '1px solid rgba(255,255,255,0.12)' : undefined,
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {onBack && (
              <button className="mc-button secondary" onClick={onBack} aria-label="Retour">
                ←
              </button>
            )}
            {title ? <div style={{ fontWeight: 900 }}>{title}</div> : null}
          </div>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            {isDesktop && (
              <button
                className="mc-button secondary"
                onClick={() => setCollapsed(!collapsed)}
                aria-label={collapsed ? 'Ré-ouvrir le panneau' : 'Réduire le panneau'}
              >
                {collapsed ? '↗︎ Ré-ouvrir' : '↘ Réduire'}
              </button>
            )}
            <button className="mc-button secondary" onClick={onClose} aria-label="Fermer">✕</button>
          </div>
        </div>
        {showContent ? <div>{children}</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="small" style={{ color: 'var(--mc-muted)' }}>Panneau réduit</div>
            <button
              className="mc-button"
              onClick={() => setCollapsed(false)}
              aria-label="Ré-ouvrir le panneau"
            >
              Ré-ouvrir
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
