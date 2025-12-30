import React from 'react'
import { useAuth } from '../state/useAuth'
import { useUserRewards } from '../state/useUserRewards'
import { COLLECTIBLES, CollectibleDef } from '../rewards/collectiblesCatalog'
import { equipAvatar } from '../rewards/collectiblesService'

const rarityLabel: Record<CollectibleDef['rarity'], string> = {
  common: 'Commun',
  rare: 'Rare',
  epic: 'Épique',
}

export function CollectionContent() {
  const { user, activeChild } = useAuth()
  const playerUid = activeChild?.id || user?.uid || null
  const { rewards } = useUserRewards(playerUid)
  const [tab, setTab] = React.useState<'sticker' | 'avatar'>('sticker')
  const owned = new Set(rewards?.collectibles?.owned || [])
  const equipped = rewards?.collectibles?.equippedAvatarId

  const onEquip = async (id: string) => {
    if (!playerUid) return
    try {
      await equipAvatar(playerUid, id)
    } catch (e) {
      console.error('equipAvatar', e)
    }
  }

  const list = COLLECTIBLES.filter(c => c.type === tab)

  if (!playerUid) {
    return <div className="card">Sélectionnez un enfant pour voir sa collection.</div>
  }

  return (
    <div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Collection</h2>
        <div className="row" style={{ gap: 8 }}>
          <button className={`btn ${tab === 'sticker' ? '' : 'secondary'}`} onClick={() => setTab('sticker')}>Stickers</button>
          <button className={`btn ${tab === 'avatar' ? '' : 'secondary'}`} onClick={() => setTab('avatar')}>Avatars</button>
        </div>
      </div>

      <div className="grid">
        {list.map(item => {
          const isOwned = owned.has(item.id)
          const isEquipped = item.id === equipped
          return (
            <div key={item.id} className="card" style={{ opacity: isOwned ? 1 : 0.65 }}>
              <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ fontSize:'1.8rem' }}>{item.icon}</div>
                  <div>
                    <div style={{ fontWeight: 800 }}>{item.title}</div>
                    <div className="small">{item.description}</div>
                    <div className="small">Rareté : {rarityLabel[item.rarity]}</div>
                  </div>
                </div>
                {isEquipped && <span className="badge">Équipé</span>}
              </div>
              {!isOwned && <div className="small" style={{ marginTop: 8, color:'rgba(255,255,255,0.7)' }}>À débloquer en jouant 🎁</div>}
              {item.type === 'avatar' && isOwned && (
                <button className="btn secondary" style={{ marginTop: 10 }} onClick={() => onEquip(item.id)}>
                  {isEquipped ? 'Équipé' : 'Équiper'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function CollectionPage() {
  return (
    <div className="container">
      <CollectionContent />
    </div>
  )
}
