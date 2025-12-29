import React from 'react'
import { extractLessonSection, markdownToHtml } from '../utils/markdown'

type LessonReminderProps = {
  title?: string | null
  content: string
  lessonRef?: string | null
  mode?: 'full' | 'contextual'
  npcGuide?: {
    avatar: string
    name: string
    line?: string
    ctaLabel?: string
    onCta?: () => void
  } | null
}

export function LessonReminder({ title, content, lessonRef, mode = 'full', npcGuide }: LessonReminderProps) {
  const [showFull, setShowFull] = React.useState(mode === 'full')
  React.useEffect(() => {
    setShowFull(mode === 'full')
  }, [mode, lessonRef])
  if (!content) return null

  const contextualSection = mode === 'contextual' && lessonRef ? extractLessonSection(content, lessonRef) : null
  const effectiveContent = !showFull && contextualSection ? contextualSection.markdown : content
  const isContextualView = !showFull && !!contextualSection
  const sectionTitle = contextualSection?.title
  const hasContextualToggle = mode === 'contextual' && !!contextualSection

  return (
    <div className="card" style={{ background:'rgba(122,162,255,0.08)', border:'1px solid rgba(122,162,255,0.35)' }}>
      {npcGuide ? (
        <div className="row" style={{ justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
          <div className="row" style={{ gap:10, alignItems:'flex-start' }}>
            <div style={{ fontSize:'1.6rem' }}>{npcGuide.avatar}</div>
            <div>
              <div className="small" style={{ color:'var(--mc-muted)' }}>{npcGuide.name}</div>
              <div style={{ fontWeight:900 }}>{npcGuide.line || 'Petit rappel disponible si tu en as besoin.'}</div>
              {lessonRef && (
                <div className="small" style={{ marginTop: 4 }}>
                  Section : {sectionTitle || lessonRef}
                </div>
              )}
            </div>
          </div>
          <div className="row" style={{ gap:6, flexShrink:0 }}>
            {hasContextualToggle && showFull && (
              <button className="btn secondary" onClick={() => setShowFull(false)}>Voir la section</button>
            )}
            {hasContextualToggle && !showFull && (
              <button className="btn secondary" onClick={() => setShowFull(true)}>Voir toute la leçon</button>
            )}
            {npcGuide.ctaLabel && (
              <button className="btn secondary" onClick={npcGuide.onCta}>{npcGuide.ctaLabel}</button>
            )}
          </div>
        </div>
      ) : (
        <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div className="small" style={{ color:'var(--mc-muted)' }}>
              {isContextualView ? 'Section ciblée' : 'Rappel de leçon'}
            </div>
            <div style={{ fontWeight:900 }}>{isContextualView && sectionTitle ? sectionTitle : (title || 'Leçon associée')}</div>
            {lessonRef && (
              <div className="small">Section : {sectionTitle || lessonRef}</div>
            )}
          </div>
          <div className="row" style={{ gap:6 }}>
            {hasContextualToggle && showFull && (
              <button className="btn secondary" onClick={() => setShowFull(false)}>Voir la section</button>
            )}
            {hasContextualToggle && !showFull && (
              <button className="btn secondary" onClick={() => setShowFull(true)}>Voir toute la leçon</button>
            )}
            <span className="badge">📘</span>
          </div>
        </div>
      )}
      <div className="small" style={{ marginTop: 8 }} dangerouslySetInnerHTML={{ __html: markdownToHtml(effectiveContent || '') }} />
    </div>
  )
}
