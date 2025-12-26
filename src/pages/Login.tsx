import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/useAuth'

export function LoginPage() {
  const { user, signInGoogle } = useAuth()
  const nav = useNavigate()

  React.useEffect(() => {
    if (user) nav('/')
  }, [user])

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Connexion</h2>
        <p className="small">
          Connexion Google recommandée (simple sur tablette Android).
        </p>
        <button className="btn" onClick={signInGoogle}>Se connecter avec Google</button>
        <hr />
        <p className="small">
          Astuce : après ta première connexion (toi), va dans Firestore et mets <code>users/{'{uid}'}.role</code> à "parent".
        </p>
      </div>
    </div>
  )
}
