import React from 'react'
import { useUserRewards } from '../state/useUserRewards'
import { useAuth } from '../state/useAuth'
import { MALLOOT_CATALOG, type LootType } from '../rewards/malocraftLootCatalog'
import { equipAvatar } from '../rewards/collectiblesService'

const rarityLabel: Record<string, string> = { common: 'Commun', rare: 'Rare', epic: 'Épique' }
const typeLabel: Record<LootType, string> = { sticker: 'Sticker', fragment: 'Fragment', trophy: 'Trophée', avatar: 'Avatar' }

export function ChestPage() {
  const { user } = useAuth()
  const { rewards } = useUserRewards(user?.uid || null)
  const owned = new Set(rewards.malocraft?.ownedLootIds || [])
  const [filter, setFilter] = React.useState<LootType | 'all'>('all')

  const equip = async (id: string) => {
    if (!user) return
    try {
      await equipAvatar(user.uid, id)
    } catch (e) {
      console.error('equip avatar', e)
    }
  }

  const filtered = MALLOOT_CATALOG.filter(item => (filter === 'all' ? true : item.type === filter))
    .sort((a, b) => (a.biomeId || '').localeCompare(b.biomeId || '') || a.title.localeCompare(b.title))

  return (
    <div className="container grid">
      <div className="card mc-card">
        <h2 className="mc-title">Coffre MaloCraft</h2>
        <div className="small" style={{ color:'var(--mc-muted)' }}>Tous les loots gagnés en expéditions.</div>
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap:'wrap' }}>
          {(['all', 'sticker', 'fragment', 'trophy', 'avatar'] as const).map(t => (
            <button key={t} className={`mc-button ${filter === t ? '' : 'secondary'}`} onClick={() => setFilter(t)}>
              {t === 'all' ? 'Tout' : typeLabel[t as LootType]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid2">
        {filtered.map(item => {
          const has = owned.has(item.id)
          const isAvatar = item.type === 'avatar'
          const equipped = rewards.collectibles?.equippedAvatarId === item.id
          return (
            <div key={item.id} className="card mc-card" style={{ opacity: has ? 1 : 0.5 }}>
              <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <div style={{ fontSize:'1.8rem' }}>{item.icon}</div>
                  <div>
                    <div style={{ fontWeight: 800 }}>{item.title}</div>
                    <div className="small" style={{ color:'var(--mc-muted)' }}>{item.description}</div>
                    <div className="small">{rarityLabel[item.rarity]} {item.biomeId ? `· ${item.biomeId}` : ''}</div>
                  </div>
                </div>
                {equipped && <span className="mc-chip accent">Équipé</span>}
              </div>
              {!has && <div className="small" style={{ marginTop: 6 }}>À gagner en expédition</div>}
              {isAvatar && has && (
                <button className="mc-button secondary" style={{ marginTop: 8 }} onClick={() => equip(item.id)}>
                  {equipped ? 'Équipé' : 'Équiper'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
