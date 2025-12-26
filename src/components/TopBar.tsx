import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/useAuth'

export function TopBar() {
  const { user, role, signOutUser } = useAuth()
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: '1.05rem' }}>Malo – Révisions</div>
          <div className="small">
            {user ? <>Connecté : <strong>{user.displayName}</strong> <span className="badge">{role}</span></> : 'Non connecté'}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Link className="btn secondary" to="/">Accueil</Link>
          {role === 'parent' && <Link className="btn secondary" to="/admin/import">Import (parent)</Link>}
          {user && <button className="btn secondary" onClick={signOutUser}>Déconnexion</button>}
        </div>
      </div>
    </div>
  )
}
