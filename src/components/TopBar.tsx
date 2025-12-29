import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/useAuth'
import { useUserRewards } from '../state/useUserRewards'
import { COLLECTIBLES } from '../rewards/collectiblesCatalog'

export function TopBar() {
  const { user, role, signOutUser } = useAuth()
  const { rewards } = useUserRewards(user?.uid || null)
  const avatarId = rewards?.collectibles?.equippedAvatarId
  const avatar = avatarId ? COLLECTIBLES.find(c => c.id === avatarId) : null
  const isAdmin = role === 'parent' || import.meta.env.VITE_DEV_ADMIN === 'true'
  const playerLinks = [
    { to: '/', label: 'Monde', icon: '🗺️' },
    { to: '/chest', label: 'Coffre', icon: '🎒', requireUser: true },
    { to: '/collection', label: 'Collection', icon: '🏅', requireUser: true },
  ]
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ fontWeight: 900, fontSize: '1.05rem' }}>Malo – Révisions</div>
            {avatar && <div style={{ width: 30, height: 30, borderRadius: '50%', background:'rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'center' }} aria-label="avatar équipé">{avatar.icon}</div>}
          </div>
          <div className="small">
            {user ? <>Connecté : <strong>{user.displayName}</strong> <span className="badge">{role}</span></> : 'Non connecté'}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {playerLinks.map(link => {
            if (link.requireUser && !user) return null
            return (
              <Link key={link.to} className="btn secondary" to={link.to} aria-label={link.label}>
                {link.icon} {link.label}
              </Link>
            )
          })}
          {isAdmin && (
            <>
              <Link className="btn secondary" to="/admin/import">Import (parent)</Link>
              <Link className="btn secondary" to="/admin/questions">Questions</Link>
              <Link className="btn secondary" to="/admin/pack-request">Pack request</Link>
              <Link className="btn secondary" to="/admin/progression">Progression enfant</Link>
            </>
          )}
          {user && <button className="btn secondary" onClick={signOutUser}>Déconnexion</button>}
        </div>
      </div>
    </div>
  )
}
