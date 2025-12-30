import React from 'react'
import { useAuth } from '../state/useAuth'
import { loadNpcPriorityTags, saveNpcPriorityTags } from '../data/npcPriorities'
import { SUBJECT_LABEL_FR, TAG_CATALOG, SubjectId } from '../taxonomy/tagCatalog'

type TagItem = { id: string, label: string, subject: SubjectId, theme: string, order?: number }

export function PrioritySettingsPage() {
  const { linkedChildren, activeChild, setActiveChildId, role } = useAuth()
  const [selectedChildId, setSelectedChildId] = React.useState<string>(activeChild?.id || '')
  const [tags, setTags] = React.useState<TagItem[]>([])
  const [selectedTags, setSelectedTags] = React.useState<Set<string>>(new Set())
  const [filter, setFilter] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [message, setMessage] = React.useState<string>('')
  const [openSubjects, setOpenSubjects] = React.useState<Set<SubjectId>>(new Set())
  const [openThemes, setOpenThemes] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    setTags(
      Object.values(TAG_CATALOG)
        .map(meta => ({ id: meta.id, label: meta.label, subject: meta.subject, theme: meta.theme, order: meta.order }))
        .sort((a, b) => (a.subject.localeCompare(b.subject) || a.theme.localeCompare(b.theme) || (a.order ?? 999) - (b.order ?? 999)))
    )
  }, [])

  const loadTags = React.useCallback(async (childId: string) => {
    setLoading(true)
    try {
      const existing = await loadNpcPriorityTags(childId)
      setSelectedTags(new Set(existing))
    } catch {
      setSelectedTags(new Set())
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (activeChild?.id && role === 'parent') {
      setSelectedChildId(activeChild.id)
      loadTags(activeChild.id)
    } else if (linkedChildren[0]) {
      setSelectedChildId(linkedChildren[0].id)
      loadTags(linkedChildren[0].id)
    }
  }, [activeChild?.id, linkedChildren.map(c => c.id).join(','), loadTags, role])

  const toggleTag = (id: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => setSelectedTags(new Set(tags.map(t => t.id)))
  const clearAll = () => setSelectedTags(new Set())

  const save = async () => {
    if (!selectedChildId) return
    setSaving(true)
    setMessage('')
    try {
      await saveNpcPriorityTags(selectedChildId, Array.from(selectedTags))
      setMessage('Priorités enregistrées.')
    } catch {
      setMessage('Erreur lors de l’enregistrement.')
    } finally {
      setSaving(false)
    }
  }

  const filtered = tags.filter(t =>
    t.label.toLowerCase().includes(filter.toLowerCase()) ||
    t.id.toLowerCase().includes(filter.toLowerCase()) ||
    t.theme.toLowerCase().includes(filter.toLowerCase()) ||
    SUBJECT_LABEL_FR[t.subject].toLowerCase().includes(filter.toLowerCase())
  )

  const grouped = React.useMemo(() => {
    const bySubject: Record<SubjectId, Record<string, TagItem[]>> = {} as Record<SubjectId, Record<string, TagItem[]>>
    filtered.forEach(tag => {
      if (!bySubject[tag.subject]) bySubject[tag.subject] = {}
      if (!bySubject[tag.subject][tag.theme]) bySubject[tag.subject][tag.theme] = []
      bySubject[tag.subject][tag.theme].push(tag)
    })

    return Object.entries(bySubject)
      .sort(([a], [b]) => SUBJECT_LABEL_FR[a as SubjectId].localeCompare(SUBJECT_LABEL_FR[b as SubjectId]))
      .map(([subject, themes]) => ({
        subject: subject as SubjectId,
        themes: Object.entries(themes)
          .map(([theme, items]) => ({
            theme,
            items: items.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.label.localeCompare(b.label)),
          }))
          .sort((a, b) => a.theme.localeCompare(b.theme)),
      }))
  }, [filtered])

  React.useEffect(() => {
    // Par défaut tout est plié; ne rien ouvrir automatiquement.
    setOpenSubjects(new Set())
    setOpenThemes(new Set())
  }, [grouped.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSubject = (subject: SubjectId) => {
    setOpenSubjects(prev => {
      const next = new Set(prev)
      if (next.has(subject)) next.delete(subject)
      else next.add(subject)
      return next
    })
  }

  const toggleTheme = (subject: SubjectId, theme: string) => {
    const key = `${subject}::${theme}`
    setOpenThemes(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Priorités pédagogiques (PNJ)</h2>
        <p className="small">
          Les priorités guident les PNJ : les exercices et quêtes proposés au
          joueur mettront en avant les blocs cochés pour l’enfant sélectionné.
          Tu peux ajuster par matière puis par zone (thème) et enfin par bloc
          précis. Enregistre pour que les choix soient pris en compte dans le
          jeu.
        </p>
        <div className="row" style={{ gap: 8, alignItems:'center', flexWrap:'wrap' }}>
          <span className="small">Enfant</span>
          <select className="input" value={selectedChildId} onChange={(e) => {
            const id = e.target.value
            setSelectedChildId(id)
            setActiveChildId(id)
            loadTags(id)
          }}>
            {linkedChildren.map(c => <option key={c.id} value={c.id}>{c.displayName}</option>)}
          </select>
          <input className="input" placeholder="Filtrer un tag…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <button className="btn secondary" onClick={selectAll}>Tout sélectionner</button>
          <button className="btn secondary" onClick={clearAll}>Vider</button>
          <button className="btn" onClick={save} disabled={saving || loading || !selectedChildId}>Enregistrer</button>
        </div>
        {message && <div className="small" style={{ marginTop: 8 }}>{message}</div>}
      </div>

      {loading ? (
        <div className="card">Chargement…</div>
      ) : grouped.length === 0 ? (
        <div className="card small">Aucun tag trouvé.</div>
      ) : (
        grouped.map(subject => (
          <div key={subject.subject} style={{ borderBottom: '1px solid var(--border)', padding: '8px 0' }}>
            <div className="row" style={{ justifyContent:'space-between', alignItems:'center', cursor:'pointer' }} onClick={() => toggleSubject(subject.subject)}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontWeight: 900 }}>{openSubjects.has(subject.subject) ? '−' : '+'}</span>
                <h3 style={{ margin: 0 }}>{SUBJECT_LABEL_FR[subject.subject]}</h3>
              </div>
              <span className="small" style={{ color:'var(--muted)' }}>{subject.themes.length} zones</span>
            </div>
            {!openSubjects.has(subject.subject) ? null : (
              <div className="stack" style={{ gap: 8, marginLeft: 24 }}>
                {subject.themes.map(theme => {
                  const themeKey = `${subject.subject}::${theme.theme}`
                  const isOpenTheme = openThemes.has(themeKey)
                  return (
                    <div key={theme.theme} style={{ borderLeft:'2px solid var(--border)', paddingLeft:12, marginBottom:4 }}>
                      <div className="row" style={{ justifyContent:'space-between', alignItems:'center', cursor:'pointer' }} onClick={() => toggleTheme(subject.subject, theme.theme)}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, fontWeight:700 }}>
                          <span>{isOpenTheme ? '−' : '+'}</span>
                          <span>{theme.theme}</span>
                        </div>
                        <div className="small" style={{ color:'var(--muted)' }}>{theme.items.length} bloc(s)</div>
                      </div>
                      {!isOpenTheme ? null : (
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:8, marginTop:6 }}>
                          {theme.items.map(tag => {
                            const checked = selectedTags.has(tag.id)
                            return (
                              <label key={tag.id} style={{ border:'1px solid var(--border)', borderRadius:6, padding:8, cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                                <div>
                                  <div style={{ fontWeight: 700 }}>{tag.label}</div>
                                </div>
                                <input type="checkbox" checked={checked} onChange={() => toggleTag(tag.id)} />
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
