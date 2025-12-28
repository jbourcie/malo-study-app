import React from 'react'
import { extractLessonSection, markdownToHtml } from '../utils/markdown'

type LessonReminderProps = {
  title?: string | null
  content: string
  lessonRef?: string | null
  mode?: 'full' | 'contextual'
}

export function LessonReminder({ title, content, lessonRef, mode = 'full' }: LessonReminderProps) {
  const [showFull, setShowFull] = React.useState(mode === 'full')
  if (!content) return null

  const contextualSection = mode === 'contextual' && lessonRef ? extractLessonSection(content, lessonRef) : null
  const effectiveContent = !showFull && contextualSection ? contextualSection : content
  const isContextualView = !showFull && !!contextualSection

  return (
    <div className="card" style={{ background:'rgba(122,162,255,0.08)', border:'1px solid rgba(122,162,255,0.35)' }}>
      <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div className="small" style={{ color:'var(--mc-muted)' }}>
            {isContextualView ? 'Section ciblée' : 'Rappel de leçon'}
          </div>
          <div style={{ fontWeight:900 }}>{title || 'Leçon associée'}</div>
          {lessonRef && <div className="small">Section : {lessonRef}</div>}
        </div>
        <div className="row" style={{ gap:6 }}>
          {contextualSection && showFull && mode === 'contextual' && (
            <button className="btn secondary" onClick={() => setShowFull(false)}>Voir la section</button>
          )}
          {contextualSection && !showFull && (
            <button className="btn secondary" onClick={() => setShowFull(true)}>Voir toute la leçon</button>
          )}
          <span className="badge">📘</span>
        </div>
      </div>
      <div className="small" style={{ marginTop: 8 }} dangerouslySetInnerHTML={{ __html: markdownToHtml(effectiveContent || '') }} />
    </div>
  )
}
