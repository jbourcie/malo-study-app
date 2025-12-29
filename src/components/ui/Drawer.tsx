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

export function Drawer({ open, title, children, onClose, onBack, width = 880, zIndex = 900 }: DrawerProps) {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const lastFocused = React.useRef<HTMLElement | null>(null)

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

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
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
          width: width,
          maxWidth: '80vw',
          height: '100%',
          borderRadius: 0,
          overflowY: 'auto',
          padding: 16,
          boxShadow: '-6px 0 18px rgba(0,0,0,0.45)',
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
          <button className="mc-button secondary" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  )
}
