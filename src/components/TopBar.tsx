import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/useAuth'
import { useUserRewards } from '../state/useUserRewards'
import { COLLECTIBLES } from '../rewards/collectiblesCatalog'

export function TopBar() {
  const { user, profile, role, signOutUser, activeChild, linkedChildren, setActiveChildId, linkedParentName, generatePairingCode, unlinkChild, recoveryCode, redeemPairingCode, regenerateRecoveryCode } = useAuth()
  const playerUid = activeChild?.id || user?.uid || null
  const { rewards } = useUserRewards(playerUid)
  const avatarId = rewards?.collectibles?.equippedAvatarId
  const avatar = avatarId ? COLLECTIBLES.find(c => c.id === avatarId) : null
  const isAdmin = role === 'admin' || import.meta.env.VITE_DEV_ADMIN === 'true'
  const [showParentModal, setShowParentModal] = React.useState(false)
  const [pairingCode, setPairingCode] = React.useState<{ code: string, expiresAt: Date } | null>(null)
  const [pairingError, setPairingError] = React.useState<string>('')
  const [unlinking, setUnlinking] = React.useState(false)
  const [unlinkError, setUnlinkError] = React.useState<string>('')
  const [showRedeemModal, setShowRedeemModal] = React.useState(false)
  const [redeemInput, setRedeemInput] = React.useState('')
  const [redeemError, setRedeemError] = React.useState('')
  const [redeemSuccess, setRedeemSuccess] = React.useState('')
  const [showRecovery, setShowRecovery] = React.useState(false)
  const [regenLoading, setRegenLoading] = React.useState(false)
  const [regenError, setRegenError] = React.useState<string>('')

  const onGeneratePairing = async () => {
    setPairingError('')
    setPairingCode(null)
    try {
      const res = await generatePairingCode()
      const exp = (res.expiresAt && typeof (res.expiresAt as any).toDate === 'function')
        ? (res.expiresAt as any).toDate()
        : new Date()
      setPairingCode({ code: res.code, expiresAt: exp })
    } catch (e: any) {
      setPairingError(e?.message || 'Impossible de générer le code.')
    }
  }

  React.useEffect(() => {
    if (showParentModal) {
      onGeneratePairing().catch(() => {})
    } else {
      setPairingCode(null)
      setPairingError('')
    }
  }, [showParentModal])

  const playerLinks = React.useMemo(() => {
    if (role === 'parent' || role === 'admin') {
      return [{ to: '/hub', label: 'Monde', icon: '🗺️', requireUser: false }]
    }
    return [
      { to: '/hub', label: 'Monde', icon: '🗺️', requireUser: false },
      { to: '/chest', label: 'Coffre', icon: '🎒', requireUser: true },
      { to: '/collection', label: 'Collection', icon: '🏅', requireUser: true },
    ]
  }, [role])
  const onRedeem = async () => {
    setRedeemError('')
    setRedeemSuccess('')
    try {
      await redeemPairingCode(redeemInput)
      setRedeemSuccess('Enfant ajouté.')
      setRedeemInput('')
      setShowRedeemModal(false)
    } catch (e: any) {
      setRedeemError(e?.message || 'Code invalide ou expiré.')
    }
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{
              display:'flex',
              alignItems:'center',
              gap:8
            }}>
              <div style={{
                width:36,
                height:36,
                borderRadius:8,
                background:'linear-gradient(135deg,#ff8a3d,#ff4d6d)',
                display:'flex',
                alignItems:'center',
                justifyContent:'center',
                fontWeight:900,
                fontSize:'0.95rem',
                letterSpacing:1,
              }}>MC</div>
              <div style={{ fontWeight: 900, fontSize: '1.05rem' }}>Malo Craft</div>
            </div>
            {avatar && <div style={{ width: 30, height: 30, borderRadius: '50%', background:'rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'center' }} aria-label="avatar équipé">{avatar.icon}</div>}
          </div>
          <div className="small">
            {user ? (
              <>
                Connecté : <strong>{profile?.displayName || user.displayName || 'Utilisateur'}</strong> <span className="badge">{role}</span>
                {activeChild && (role === 'parent' || role === 'admin') && (
                  <> · Enfant actif : <strong>{activeChild.displayName}</strong>
                    {recoveryCode && (
                      <span className="badge" style={{ marginLeft:6 }} title="Code de reprise : à saisir sur un autre appareil (Accueil > Reprendre ma partie) pour restaurer la progression.">
                        {showRecovery ? recoveryCode : '••••••••••••'}
                      </span>
                    )}
                    {recoveryCode && (
                      <button
                        className="btn secondary"
                        style={{ padding:'2px 8px', fontSize:'0.75rem', marginLeft:6 }}
                        onClick={() => {
                          setShowRecovery(true)
                          setTimeout(() => setShowRecovery(false), 3000)
                        }}
                      >
                        Révéler 3s
                      </button>
                    )}
                    <button
                      className="btn secondary"
                      style={{ padding:'2px 8px', fontSize:'0.75rem', marginLeft:6 }}
                      onClick={async () => {
                        if (!activeChild) return
                        const confirm = window.confirm(`Dissocier ${activeChild.displayName} ?`)
                        if (!confirm) return
                        setUnlinkError('')
                        setUnlinking(true)
                        try {
                          await unlinkChild(activeChild.id)
                        } catch (e: any) {
                          setUnlinkError(e?.message || 'Impossible de dissocier.')
                        } finally {
                          setUnlinking(false)
                        }
                      }}
                      disabled={unlinking}
                      title="Supprimer l’appairage avec cet enfant"
                    >
                      {unlinking ? '...' : 'Dissocier'}
                    </button>
                  </>
                )}
                {role === 'child' && (
                  linkedParentName
                    ? <> · Parent : <strong>{linkedParentName}</strong></>
                    : <> · <button className="btn secondary" style={{ padding:'2px 8px', fontSize:'0.75rem' }} onClick={() => setShowParentModal(true)}>Associer un parent</button></>
                )}
                {role === 'child' && recoveryCode && (
                  <> · <span className="badge" title="Code de reprise : sur un autre appareil, clique sur « Reprendre ma partie » et saisis-le pour retrouver ton monde.">Code reprise : {recoveryCode}</span>
                    <button
                      className="btn secondary"
                      style={{ padding:'2px 8px', fontSize:'0.75rem', marginLeft:6 }}
                      disabled={regenLoading}
                      onClick={async () => {
                        setRegenError('')
                        setRegenLoading(true)
                        try {
                          await regenerateRecoveryCode()
                        } catch (e: any) {
                          setRegenError(e?.message || 'Impossible de régénérer le code.')
                        } finally {
                          setRegenLoading(false)
                        }
                      }}
                      title="Révoque l’ancien code et génère-en un nouveau"
                    >
                      {regenLoading ? '...' : 'Régénérer'}
                    </button>
                  </>
                )}
              </>
            ) : 'Non connecté'}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {(role === 'parent' || role === 'admin') && linkedChildren.length > 0 && (
            <select className="input" value={activeChild?.id || ''} onChange={(e) => setActiveChildId(e.target.value || null)}>
              {linkedChildren.map(child => (
                <option key={child.id} value={child.id}>{child.displayName}</option>
              ))}
            </select>
          )}
          {(role === 'parent' || role === 'admin') && (
            <>
              <button className="btn secondary" onClick={() => setShowRedeemModal(true)}>Associer un enfant</button>
            </>
          )}
          {playerLinks.map(link => {
            if (link.requireUser && !playerUid) return null
            return (
              <Link key={link.to} className="btn secondary" to={link.to} aria-label={link.label}>
                {link.icon} {link.label}
              </Link>
            )
          })}
          {role === 'parent' && (
            <Link className="btn secondary" to="/parent/priorites">Priorité pédagogique</Link>
          )}
          {isAdmin && (
            <>
              <Link className="btn secondary" to="/admin/import">Import</Link>
              <Link className="btn secondary" to="/admin/questions">Questions</Link>
              <Link className="btn secondary" to="/admin/reports">Reports</Link>
              <Link className="btn secondary" to="/admin/pack-request">Pack request</Link>
              <Link className="btn secondary" to="/admin/progression">Progression enfant</Link>
            </>
          )}
          {user && <button className="btn secondary" onClick={signOutUser}>Déconnexion</button>}
        </div>
      </div>
      {unlinkError && <div className="small" style={{ color:'#ff5a6f', marginTop:8 }}>{unlinkError}</div>}
      {showParentModal && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000,
          display:'flex', alignItems:'center', justifyContent:'center', padding:16
        }}>
          <div className="card" style={{ maxWidth: 420, width:'100%', position:'relative' }}>
            <button className="btn secondary" style={{ position:'absolute', top:8, right:8 }} onClick={() => setShowParentModal(false)}>Fermer</button>
            <h3 style={{ marginTop:0 }}>Associer un parent</h3>
            <p className="small">
              1) Ce code est généré automatiquement.<br />
              2) Donne-le au parent.<br />
              3) Le parent se connecte avec Google sur la page d’accueil et saisit ce code pour te rattacher.
            </p>
            {pairingCode && (
              <div className="pill" style={{ marginTop: 10, display:'inline-flex', alignItems:'center', gap:8 }}>
                <span>Code :</span>
                <strong style={{ letterSpacing: 2 }}>{pairingCode.code}</strong>
                <span className="badge">Expire à {pairingCode.expiresAt.toLocaleTimeString()}</span>
              </div>
            )}
            {pairingError && <div className="small" style={{ marginTop:8, color:'#ff5a6f' }}>{pairingError}</div>}
          </div>
        </div>
      )}
      {regenError && <div className="small" style={{ color:'#ff5a6f', marginTop:8 }}>{regenError}</div>}
      {showRedeemModal && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000,
          display:'flex', alignItems:'center', justifyContent:'center', padding:16
        }}>
          <div className="card" style={{ maxWidth: 420, width:'100%', position:'relative' }}>
            <button className="btn secondary" style={{ position:'absolute', top:8, right:8 }} onClick={() => setShowRedeemModal(false)}>Fermer</button>
            <h3 style={{ marginTop:0 }}>Associer un enfant</h3>
            <p className="small">Saisis le code à 8 caractères généré sur l’app enfant (valide 10 minutes).</p>
            <div className="row" style={{ gap: 8 }}>
              <input className="input" value={redeemInput} onChange={(e) => setRedeemInput(e.target.value)} placeholder="Code d’appairage" />
              <button className="btn" onClick={onRedeem} disabled={!redeemInput.trim()}>Valider</button>
            </div>
            {redeemError && <div className="small" style={{ marginTop:8, color:'#ff5a6f' }}>{redeemError}</div>}
            {redeemSuccess && <div className="small success" style={{ marginTop:8 }}>{redeemSuccess}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
