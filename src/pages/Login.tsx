import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/useAuth'
import { PairingError } from '../auth/pairing'

const childNameStorageKey = 'malo.childName'

export function LoginPage() {
  const navigate = useNavigate()
  const {
    user,
    profile,
    role,
    loading,
    signInGoogle,
    startAnonymousWithName,
    resumeChildWithRecovery,
    signOutUser,
    redeemPairingCode,
    linkedChildren,
    updateDisplayName,
  } = useAuth()
  const [error, setError] = React.useState<string>('')
  const [childName, setChildName] = React.useState<string>('')
  const [savingName, setSavingName] = React.useState(false)
  const redirectedRef = React.useRef(false)
  const [redeemInput, setRedeemInput] = React.useState('')
  const [redeemStatus, setRedeemStatus] = React.useState<string>('')
  const [recoveryInput, setRecoveryInput] = React.useState('')
  const [recoveryStatus, setRecoveryStatus] = React.useState<string>('')

  React.useEffect(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(childNameStorageKey) : ''
    if (stored) setChildName(stored)
  }, [])

  React.useEffect(() => {
    if (profile?.role === 'child' && profile.displayName) {
      setChildName(profile.displayName)
    }
  }, [profile?.displayName, profile?.role])

  React.useEffect(() => {
    if (redirectedRef.current) return
    if (user && role === 'child') {
      redirectedRef.current = true
      navigate('/hub', { replace: true })
    }
  }, [user, role, navigate])

  const onRedeem = async () => {
    setError('')
    setRedeemStatus('')
    try {
      await redeemPairingCode(redeemInput)
      setRedeemStatus('Enfant rattaché avec succès.')
      setRedeemInput('')
    } catch (e: any) {
      if (e instanceof PairingError) {
        if (e.code === 'code_expired') setError('Code expiré. Demandez un nouveau code à votre enfant.')
        else if (e.code === 'code_used') setError('Ce code a déjà été utilisé.')
        else if (e.code === 'already_linked') setError('Cet enfant est déjà rattaché.')
        else setError(e.message || 'Code invalide.')
      } else {
        setError(e?.message || 'Erreur pendant le rattachement.')
      }
    }
  }

  const onStartChild = async () => {
    setError('')
    setSavingName(true)
    try {
      await startAnonymousWithName(childName)
    } catch (e: any) {
      setError(e?.message || 'Impossible de démarrer.')
    } finally {
      setSavingName(false)
    }
  }

  const onUpdateName = async () => {
    setError('')
    setSavingName(true)
    try {
      await updateDisplayName(childName)
    } catch (e: any) {
      setError(e?.message || 'Erreur de mise à jour du prénom.')
    } finally {
      setSavingName(false)
    }
  }

  const showChildCard = !user || role === 'child'
  const showParentCard = !user || role === 'parent' || role === 'admin'

  const onResume = async () => {
    setError('')
    setRecoveryStatus('')
    try {
      await resumeChildWithRecovery(recoveryInput)
      setRecoveryStatus('Connexion réussie.')
      navigate('/hub', { replace: true })
    } catch (e: any) {
      setError(e?.message || 'Code de reprise invalide.')
    }
  }

  return (
    <div className="container">
      <div className="grid">
        {showChildCard && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Espace enfant</h2>
          <p className="small">
            Entre ton prénom pour commencer (connexion anonyme).
          </p>
          <div className="row" style={{ gap: 8, alignItems:'center' }}>
            <input
              className="input"
              placeholder="Prénom"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
            />
            {user && role === 'child' ? (
              <button className="btn secondary" onClick={onUpdateName} disabled={savingName || !childName.trim()}>
                Mettre à jour
              </button>
            ) : (
              <button className="btn secondary" onClick={onStartChild} disabled={savingName || !childName.trim()}>
                Commencer
              </button>
            )}
          </div>
          {user && role === 'child' && (
            <div className="small" style={{ marginTop: 8 }}>
              Connecté en tant que <strong>{profile?.displayName || 'Enfant'}</strong>.
              <button className="btn secondary" style={{ marginLeft: 8 }} onClick={signOutUser}>Se déconnecter</button>
            </div>
          )}
          <hr />
          <h3>Reprendre ma partie</h3>
          <p className="small">Saisis le code de reprise (donné dans la top bar ou par le parent) pour récupérer ta progression sur cet appareil.</p>
          <div className="row" style={{ gap: 8, alignItems:'center' }}>
            <input className="input" placeholder="Code de reprise" value={recoveryInput} onChange={(e) => setRecoveryInput(e.target.value)} />
            <button className="btn secondary" onClick={onResume} disabled={!recoveryInput.trim() || loading}>Reprendre</button>
          </div>
          {recoveryStatus && <div className="small success" style={{ marginTop: 6 }}>{recoveryStatus}</div>}
        </div>
        )}

        {showParentCard && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Parent / Admin</h2>
          <p className="small">
            Connexion Google recommandée (parents + admins).
          </p>
          <button className="btn" onClick={signInGoogle} disabled={loading}>
            {user && role !== 'child' ? 'Reconnecter Google' : 'Se connecter avec Google'}
          </button>

          {(role === 'parent' || role === 'admin') && (
            <>
              <hr />
              <h3>Rattacher un enfant</h3>
              <p className="small">
                Saisis le code généré sur l’app enfant (valide 10 min).
              </p>
              <div className="row" style={{ gap: 8 }}>
                <input className="input" value={redeemInput} placeholder="Code à 8 caractères" onChange={(e) => setRedeemInput(e.target.value)} />
                <button className="btn secondary" onClick={onRedeem} disabled={!redeemInput}>Rattacher</button>
              </div>
              {redeemStatus && <div className="small success">{redeemStatus}</div>}
              <div className="small" style={{ marginTop: 10 }}>
                Enfants rattachés : {linkedChildren.length ? linkedChildren.map(c => c.displayName).join(', ') : 'aucun pour le moment'}
              </div>
              <div className="small" style={{ marginTop: 6 }}>
                Pour lier un enfant : demande-lui de générer un code dans sa section enfant, puis saisis-le ici.
              </div>
            </>
          )}
        </div>
        )}
      </div>

      {error && <div className="card" style={{ marginTop: 12, background:'rgba(255,0,0,0.08)' }}>{error}</div>}
    </div>
  )
}
