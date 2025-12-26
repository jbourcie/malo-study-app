import React from 'react'
import { useAuth } from '../state/useAuth'
import { getOrInitStats } from '../data/firestore'
import { listInventory, listRewardItems, purchaseReward, RewardItem } from '../data/rewards'

export function RewardPage() {
  const { user } = useAuth()
  const [stats, setStats] = React.useState<any | null>(null)
  const [inventory, setInventory] = React.useState<Record<string, any>>({})
  const [error, setError] = React.useState<string>('')
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!user) return
    ;(async () => {
      const st = await getOrInitStats(user.uid)
      setStats(st)
      const inv = await listInventory(user.uid)
      const map: Record<string, any> = {}
      inv.forEach(i => { map[i.id] = i })
      setInventory(map)
    })()
  }, [user])

  const onBuy = async (item: RewardItem) => {
    if (!user) return
    setError('')
    setLoading(true)
    try {
      const res = await purchaseReward(user.uid, item.id)
      setStats((s: any) => ({ ...(s || {}), coins: res.coins, xp: res.xp }))
      setInventory(inv => ({ ...inv, [item.id]: { acquiredAt: new Date().toISOString() } }))
    } catch (e: any) {
      setError(e.message || 'Erreur achat')
    } finally {
      setLoading(false)
    }
  }

  const items = listRewardItems()

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Récompenses</h2>
        <div className="small">Utilise tes pièces pour acheter et collectionner des items.</div>
        {stats && (
          <div className="kpi" style={{ marginTop: 8 }}>
            <div className="pill">Pièces: <strong>{stats.coins || 0}</strong></div>
            <div className="pill">XP: <strong>{stats.xp || 0}</strong></div>
          </div>
        )}
        {error && <div className="small" style={{ color:'#ff5a6f', marginTop: 8 }}>{error}</div>}
      </div>

      <div className="grid">
        {items.map(it => {
          const owned = !!inventory[it.id]
          const canBuy = (stats?.coins || 0) >= it.priceCoins && (!it.requiresXp || (stats?.xp || 0) >= it.requiresXp)
          return (
            <div key={it.id} className="card" style={{ opacity: owned ? 0.7 : 1 }}>
              <div className="row" style={{ justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{it.title}</div>
                  <div className="small">{it.description}</div>
                </div>
                {owned && <span className="badge">Déjà acquis</span>}
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <div className="pill">Prix: {it.priceCoins} pièces</div>
                {it.requiresXp && <div className="pill">Niv: {it.requiresXp} XP</div>}
              </div>
              {!owned && (
                <button className="btn" disabled={!canBuy || loading} onClick={() => onBuy(it)}>
                  {canBuy ? 'Acheter' : 'Manque de pièces/XP'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
