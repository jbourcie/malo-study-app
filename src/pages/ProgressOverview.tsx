import React from 'react'
import { useUserRewards } from '../state/useUserRewards'
import { useAuth } from '../state/useAuth'
import type { SubjectId } from '../types'
import { getTagMeta, SUBJECT_LABEL_FR, MASTERY_LABEL_FR, MASTERY_HELP_FR } from '../taxonomy/tagCatalog'

const SUBJECTS: Array<{ id: SubjectId | 'all', label: string }> = [
  { id: 'all', label: 'Toutes' },
  { id: 'fr', label: 'Français' },
  { id: 'math', label: 'Maths' },
  { id: 'en', label: 'Anglais' },
  { id: 'es', label: 'Espagnol' },
  { id: 'hist', label: 'Histoire' },
]

function extractSubject(tagId: string | undefined): SubjectId | null {
  if (!tagId) return null
  const prefix = tagId.split('_')[0]
  if (prefix === 'fr' || prefix === 'math' || prefix === 'en' || prefix === 'es' || prefix === 'hist') return prefix
  return null
}

export function ProgressOverviewContent() {
  const { user, activeChild } = useAuth()
  const playerUid = activeChild?.id || user?.uid || null
  const { rewards } = useUserRewards(playerUid)
  const [subject, setSubject] = React.useState<SubjectId | 'all'>('all')
  const [search, setSearch] = React.useState<string>('')

  const mastery = rewards.masteryByTag || {}
  const list = Object.entries(mastery)
    .map(([tag, data]) => ({ tag, data, meta: getTagMeta(tag) }))
    .filter(({ tag, meta }) => subject === 'all' ? true : extractSubject(tag) === subject)
    .filter(({ meta }) => meta.label.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const order = (s: string) => s === 'mastered' ? 0 : s === 'progressing' ? 1 : 2
      const s1 = order(a.data.state)
      const s2 = order(b.data.state)
      if (s1 !== s2) return s1 - s2
      if ((a.meta.order || 9999) !== (b.meta.order || 9999)) return (a.meta.order || 9999) - (b.meta.order || 9999)
      return a.meta.label.localeCompare(b.meta.label)
    })

  if (!playerUid) {
    return <div className="card">Sélectionnez un enfant pour voir la progression.</div>
  }

  return (
    <div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Progression</h2>
        <div className="row" style={{ alignItems:'center', gap: 8 }}>
          <span className="small">Matière</span>
          <select className="input" value={subject} onChange={(e) => setSubject(e.target.value as SubjectId | 'all')}>
            {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <input
            className="input"
            style={{ maxWidth: 260 }}
            placeholder="Rechercher un tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid">
        {list.length === 0 ? (
          <div className="card small">Aucune donnée de maîtrise pour l’instant.</div>
        ) : (
          list.map(({ tag, data, meta }) => {
            const progress = Math.min(100, Math.max(0, Math.round(data.score || 0)))
            return (
              <div key={tag} className="card" style={{ padding: 12 }}>
                <div className="row" style={{ justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{meta.label}</div>
                    <div className="small">{SUBJECT_LABEL_FR[meta.subject]} · {meta.theme}</div>
                    <div className="small" title={MASTERY_HELP_FR[data.state as any] || ''}>{MASTERY_LABEL_FR[data.state as any] || data.state}</div>
                  </div>
                  <div className="small">{progress}/100</div>
                </div>
                <div style={{ height: 10, background:'rgba(255,255,255,0.08)', borderRadius: 999, marginTop: 6 }}>
                  <div style={{
                    height: '100%',
                    width: `${progress}%`,
                    background: data.state === 'mastered' ? '#2ecc71' : data.state === 'progressing' ? '#7aa2ff' : '#ff9f43',
                    borderRadius: 999,
                  }} />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export function ProgressOverviewPage() {
  return (
    <div className="container">
      <ProgressOverviewContent />
    </div>
  )
}
