import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../state/useAuth'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="card">Chargement…</div>
  if (!user) return <Navigate to="/connexion" replace />
  return <>{children}</>
}

export function RequireParent({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth()
  if (loading) return <div className="card">Chargement…</div>
  if (!user) return <Navigate to="/connexion" replace />
  if (role !== 'parent') return <Navigate to="/" replace />
  return <>{children}</>
}
