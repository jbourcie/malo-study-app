import React from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../state/useAuth'
import type { SubjectId } from '../types'
import type { TagProgress } from '../typesProgress'

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

function computeLast7(t: TagProgress) {
  if (t.last7) return t.last7
  if (Array.isArray(t.last7Results)) {
    return {
      correct: t.last7Results.filter(Boolean).length,
      wrong: t.last7Results.filter(x => !x).length,
    }
  }
  return { correct: 0, wrong: 0 }
}

export function ProgressPage() {
  const { user } = useAuth()
  const [tags, setTags] = React.useState<Array<TagProgress & { id: string }>>([])
  const [loading, setLoading] = React.useState(false)
  const [selected, setSelected] = React.useState<SubjectId | 'all'>('fr')

  React.useEffect(() => {
    if (!user) return
    setLoading(true)
    ;(async () => {
      const snap = await getDocs(collection(db, 'users', user.uid, 'tagProgress'))
      const data = snap.docs.map(d => ({ id: d.id, tagId: d.id, ...(d.data() as TagProgress) }))
      setTags(data)
      setLoading(false)
    })()
  }, [user])

  const filtered = tags
    .filter(t => selected === 'all' ? true : extractSubject(t.tagId) === selected)
    .sort((a, b) => (a.mastery || 0) - (b.mastery || 0))
    .slice(0, 20)

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Progression par tag</h2>
        <div className="row" style={{ gap: 8, alignItems:'center' }}>
          <label className="small">Matière</label>
          <select className="input" value={selected} onChange={(e) => setSelected(e.target.value as SubjectId | 'all')}>
            {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="card">Chargement…</div>
      ) : (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Top 20 faibles</h3>
          {filtered.length === 0 ? (
            <div className="small">Aucun tag pour le moment.</div>
          ) : (
            <div className="grid">
              {filtered.map(tag => {
                const last7 = computeLast7(tag)
                return (
                  <div key={tag.id} className="pill" style={{ justifyContent:'space-between', display:'flex', alignItems:'center' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{tag.tagId}</div>
                      <div className="small">
                        {tag.mastery ?? 0}/100 · {tag.bucket} · {last7.correct}/{last7.correct + last7.wrong} sur 7 · Prochaine: {tag.nextDueDate || '—'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
