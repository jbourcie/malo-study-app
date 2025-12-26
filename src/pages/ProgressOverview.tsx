import React from 'react'
import { useUserRewards } from '../state/useUserRewards'
import { useAuth } from '../state/useAuth'
import type { SubjectId } from '../types'

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

export function ProgressOverviewPage() {
  const { user } = useAuth()
  const { rewards } = useUserRewards(user?.uid || null)
  const [subject, setSubject] = React.useState<SubjectId | 'all'>('all')

  const mastery = rewards.masteryByTag || {}
  const list = Object.entries(mastery)
    .filter(([tag]) => subject === 'all' ? true : extractSubject(tag) === subject)
    .sort((a, b) => {
      // mastered on top
      const order = (s: string) => s === 'mastered' ? 0 : s === 'progressing' ? 1 : 2
      const s1 = order(a[1].state)
      const s2 = order(b[1].state)
      if (s1 !== s2) return s1 - s2
      return (b[1].score || 0) - (a[1].score || 0)
    })

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Progression</h2>
        <div className="row" style={{ alignItems:'center', gap: 8 }}>
          <span className="small">Matière</span>
          <select className="input" value={subject} onChange={(e) => setSubject(e.target.value as SubjectId | 'all')}>
            {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid">
        {list.length === 0 ? (
          <div className="card small">Aucune donnée de maîtrise pour l’instant.</div>
        ) : (
          list.map(([tag, data]) => {
            const progress = Math.min(100, Math.max(0, Math.round(data.score || 0)))
            return (
              <div key={tag} className="card" style={{ padding: 12 }}>
                <div className="row" style={{ justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{tag}</div>
                    <div className="small">{data.state}</div>
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
