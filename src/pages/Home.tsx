import React from 'react'
import { Link } from 'react-router-dom'
import { listSubjects, listThemes, getOrInitStats } from '../data/firestore'
import { listInventory } from '../data/rewards'
import { useAuth } from '../state/useAuth'
import { useUserRewards } from '../state/useUserRewards'
import { BADGES } from '../rewards/badgesCatalog'
import type { SubjectId } from '../types'

const SUBJECTS_FALLBACK: Array<{id: SubjectId, title: string}> = [
  { id: 'fr', title: 'Français' },
  { id: 'math', title: 'Maths' },
  { id: 'en', title: 'Anglais' },
  { id: 'es', title: 'Espagnol' },
  { id: 'hist', title: 'Histoire' },
]

export function HomePage() {
  const { user } = useAuth()
  const { rewards } = useUserRewards(user?.uid || null)
  const [subjects, setSubjects] = React.useState<any[]>([])
  const [selected, setSelected] = React.useState<SubjectId>('fr')
  const [themes, setThemes] = React.useState<any[]>([])
  const [stats, setStats] = React.useState<any | null>(null)
  const [inventory, setInventory] = React.useState<any[]>([])

  React.useEffect(() => {
    (async () => {
      try {
        const s = await listSubjects()
        setSubjects(s.length ? s : SUBJECTS_FALLBACK)
      } catch {
        setSubjects(SUBJECTS_FALLBACK)
      }
    })()
  }, [])

  React.useEffect(() => {
    (async () => {
      const t = await listThemes(selected, { uid: user?.uid })
      setThemes(t)
    })()
  }, [selected, user])

  React.useEffect(() => {
    if (!user) return
    (async () => {
      const st = await getOrInitStats(user.uid)
      setStats(st)
      const inv = await listInventory(user.uid)
      setInventory(inv)
    })()
  }, [user])

  return (
    <div className="container grid">
      <div className="card">
        <div className="row" style={{ justifyContent:'space-between' }}>
          <div>
            <h2 style={{ margin: 0 }}>Salut Malo 👋</h2>
            <div className="small">Choisis une matière, puis un thème. Objectif : 10 questions par jour.</div>
            <div className="small" style={{ marginTop: 6 }}>Niveau {rewards.level || 1} · XP {rewards.xp || 0}</div>
            {(rewards.badges || []).length ? (
              <div className="row" style={{ marginTop: 6, gap: 6 }}>
                {rewards.badges?.map((b: string) => {
                  const def = BADGES.find(x => x.id === b)
                  return (
                    <span key={b} className="pill" style={{ padding:'4px 8px', border:'1px solid rgba(255,255,255,0.2)' }}>
                      {def?.icon || '🏅'} {def?.title || b}
                    </span>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Matière</h3>
          <select className="input" value={selected} onChange={(e) => setSelected(e.target.value as SubjectId)}>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
          <div className="small" style={{ marginTop: 8 }}>
            Priorités : Français (grammaire & conjugaison) + Maths (fractions).
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Thèmes</h3>
          {themes.length === 0 ? (
            <div className="small">Aucun thème pour l’instant. (Parent : importe un pack JSON)</div>
          ) : (
            <div className="grid">
              {themes.map(t => (
                <Link key={t.id} className="btn secondary" to={`/theme/${t.id}`}>{t.title}</Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {(rewards.badges || []).length ? (
        <div className="card">
          <h3 style={{ marginTop:0 }}>Badges débloqués</h3>
          <div className="row">
            {rewards.badges?.map((b: string) => <span key={b} className="badge">{b}</span>)}
          </div>
        </div>
      ) : null}

      {inventory.length ? (
        <div className="card">
          <h3 style={{ marginTop:0 }}>Inventaire</h3>
          <div className="row">
            {inventory.map((item: any) => (
              <span key={item.id} className="badge">{item.title || item.id}</span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="card">
        <h3 style={{ marginTop:0 }}>Badges</h3>
        <div className="grid2">
          {BADGES.map(b => {
            const unlocked = (rewards.badges || []).includes(b.id)
            return (
              <div key={b.id} className="pill" style={{
                opacity: unlocked ? 1 : 0.35,
                borderColor: unlocked ? 'rgba(122,162,255,0.6)' : 'rgba(255,255,255,0.18)',
                display:'flex', flexDirection:'column', gap:4
              }}>
                <div style={{ fontWeight: 700 }}>{b.icon} {b.title}</div>
                <div className="small">{b.description}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
