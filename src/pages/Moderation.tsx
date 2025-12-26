import React from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { deleteTheme, listExercises, listThemes, setExerciseHidden, setExerciseVisibilityForChild, setThemeHidden, setThemeVisibilityForChild } from '../data/firestore'
import type { SubjectId } from '../types'

const SUBJECTS: Array<{ id: SubjectId | 'all', label: string }> = [
  { id: 'all', label: 'Toutes' },
  { id: 'fr', label: 'Français' },
  { id: 'math', label: 'Maths' },
  { id: 'en', label: 'Anglais' },
  { id: 'es', label: 'Espagnol' },
  { id: 'hist', label: 'Histoire' },
]

type Child = { id: string, displayName: string }

export function ModerationPage() {
  const [children, setChildren] = React.useState<Child[]>([])
  const [selectedChild, setSelectedChild] = React.useState<string>('')
  const [subject, setSubject] = React.useState<SubjectId | 'all'>('all')
  const [themes, setThemes] = React.useState<any[]>([])
  const [loadingThemes, setLoadingThemes] = React.useState(false)
  const [exercisesByTheme, setExercisesByTheme] = React.useState<Record<string, any[]>>({})
  const [loadingExercises, setLoadingExercises] = React.useState<string | null>(null)

  React.useEffect(() => {
    ;(async () => {
      const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'child')))
      const kids = snap.docs.map(d => ({ id: d.id, displayName: d.data().displayName || 'Enfant' }))
      setChildren(kids)
      if (kids[0]) setSelectedChild(kids[0].id)
    })()
  }, [])

  React.useEffect(() => {
    if (!selectedChild) return
    setLoadingThemes(true)
    ;(async () => {
      const subjectIds = SUBJECTS.filter(s => s.id !== 'all').map(s => s.id as SubjectId)
      const targetSubjects = subject === 'all' ? subjectIds : [subject as SubjectId]
      const allThemes: any[] = []
      for (const sub of targetSubjects) {
        const th = await listThemes(sub, { uid: selectedChild, includeHidden: true, includeOverrides: true })
        allThemes.push(...th)
      }
      const sorted = allThemes.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
      setThemes(sorted)
      setLoadingThemes(false)
    })()
  }, [selectedChild, subject])

  const toggleThemeForChild = async (themeId: string, visible: boolean) => {
    if (!selectedChild) return
    await setThemeVisibilityForChild(selectedChild, themeId, visible)
    setThemes(t => t.map(th => th.id === themeId ? { ...th, visibleOverride: visible } : th))
  }

  const toggleThemeHidden = async (themeId: string, hidden: boolean) => {
    await setThemeHidden(themeId, hidden)
    setThemes(t => t.map(th => th.id === themeId ? { ...th, hidden } : th))
  }

  const removeTheme = async (themeId: string) => {
    if (!window.confirm('Supprimer ce thème et toutes ses questions ?')) return
    const res = await deleteTheme(themeId)
    setThemes(t => t.filter(th => th.id !== themeId))
    setExercisesByTheme(e => {
      const copy = { ...e }
      delete copy[themeId]
      return copy
    })
    if (res.hidden) {
      // fallback: mark locally hidden if not deleted
      setThemes(t => t.map(th => th.id === themeId ? { ...th, hidden: true } : th))
    }
  }

  const loadExercises = async (themeId: string) => {
    setLoadingExercises(themeId)
    const ex = await listExercises(themeId, { uid: selectedChild, includeHidden: true, includeOverrides: true })
    setExercisesByTheme(e => ({ ...e, [themeId]: ex }))
    setLoadingExercises(null)
  }

  const toggleExerciseHidden = async (exId: string, hidden: boolean) => {
    await setExerciseHidden(exId, hidden)
    setExercisesByTheme(e => {
      const next: Record<string, any[]> = {}
      Object.keys(e).forEach(themeId => {
        next[themeId] = e[themeId].map((ex: any) => ex.id === exId ? { ...ex, hidden } : ex)
      })
      return { ...e, ...next }
    })
  }

  const toggleExerciseForChild = async (exId: string, visible: boolean, themeId: string) => {
    if (!selectedChild) return
    await setExerciseVisibilityForChild(selectedChild, exId, visible)
    setExercisesByTheme(e => ({
      ...e,
      [themeId]: (e[themeId] || []).map((ex: any) => ex.id === exId ? { ...ex, visibleOverride: visible } : ex)
    }))
  }

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Modération contenus</h2>
        <div className="row" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 6 }}>
            <span className="small">Enfant</span>
            <select className="input" value={selectedChild} onChange={(e) => setSelectedChild(e.target.value)}>
              {children.map(c => <option key={c.id} value={c.id}>{c.displayName}</option>)}
            </select>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <span className="small">Matière</span>
            <select className="input" value={subject} onChange={(e) => setSubject(e.target.value as SubjectId | 'all')}>
              {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loadingThemes ? (
        <div className="card">Chargement…</div>
      ) : (
        <div className="grid">
          {themes.map(th => {
            const visibleOverride = (th as any).visibleOverride
            const visibleForChild = visibleOverride !== undefined ? visibleOverride : !(th as any).hidden
            return (
              <div key={th.id} className="card">
                <div className="row" style={{ justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{th.title}</div>
                    <div className="small">{th.subjectId}</div>
                    {(th as any).hidden && <div className="badge">Masqué globalement</div>}
                    {visibleOverride === false && <div className="badge">Masqué pour l’enfant</div>}
                  </div>
                  <div className="row">
                    <button className="btn secondary" onClick={() => toggleThemeForChild(th.id, !visibleForChild)}>
                      {visibleForChild ? 'Masquer pour l’enfant' : 'Afficher pour l’enfant'}
                    </button>
                    <button className="btn secondary" onClick={() => toggleThemeHidden(th.id, !(th as any).hidden)}>
                      {(th as any).hidden ? 'Réactiver globalement' : 'Masquer globalement'}
                    </button>
                    <button className="btn secondary" onClick={() => removeTheme(th.id)}>Supprimer</button>
                    <button className="btn secondary" onClick={() => loadExercises(th.id)}>
                      Voir questions
                    </button>
                  </div>
                </div>

                {(exercisesByTheme[th.id] || []).length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div className="small" style={{ marginBottom: 6 }}>Questions</div>
                    <div className="grid">
                      {exercisesByTheme[th.id].map((ex: any) => {
                        const visOverride = ex.visibleOverride
                        const visForChild = visOverride !== undefined ? visOverride : !ex.hidden
                        return (
                          <div key={ex.id} className="pill" style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:6 }}>
                            <div className="small">
                              {ex.prompt?.slice(0, 80) || ex.id} {(ex.hidden) && <span className="badge">Masqué global</span>} {(visOverride === false) && <span className="badge">Masqué enfant</span>}
                            </div>
                            <div className="row">
                              <button className="btn secondary" onClick={() => toggleExerciseForChild(ex.id, !visForChild, th.id)}>
                                {visForChild ? 'Masquer enfant' : 'Afficher enfant'}
                              </button>
                              <button className="btn secondary" onClick={() => toggleExerciseHidden(ex.id, !ex.hidden)}>
                                {ex.hidden ? 'Réactiver global' : 'Masquer global'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {loadingExercises === th.id && <div className="small" style={{ marginTop: 6 }}>Chargement des questions…</div>}
              </div>
            )
          })}
          {themes.length === 0 && <div className="card small">Aucun thème.</div>}
        </div>
      )}
    </div>
  )
}
