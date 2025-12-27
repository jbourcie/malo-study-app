import React from 'react'
import { MALLOOT_CATALOG, type MalocraftLoot } from '../../rewards/malocraftLootCatalog'

type Props = {
  awardedId: string | null
  onClose: () => void
  onViewChest: () => void
  onEquipAvatar?: (id: string) => void
}

const rarityLabel: Record<string, string> = { common: 'Commun', rare: 'Rare', epic: 'Épique' }

export function MalocraftLootModal({ awardedId, onClose, onViewChest, onEquipAvatar }: Props) {
  if (!awardedId) return null
  const loot = MALLOOT_CATALOG.find(l => l.id === awardedId)
  if (!loot) return null

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999 }}>
      <div className="card mc-card" style={{ maxWidth: 420, width:'90%', textAlign:'center' }}>
        <h3 className="mc-title">Butin MaloCraft</h3>
        <div style={{ fontSize:'2.4rem' }}>{loot.icon}</div>
        <div style={{ fontWeight: 800, marginTop: 8 }}>{loot.title}</div>
        <div className="small" style={{ color:'var(--mc-muted)', marginTop: 4 }}>{loot.description}</div>
        <div className="mc-chip" style={{ justifyContent:'center', marginTop: 8 }}>{rarityLabel[loot.rarity]}</div>
        <div style={{ display:'flex', gap:8, marginTop:16, justifyContent:'center', flexWrap:'wrap' }}>
          {loot.type === 'avatar' && (
            <button className="mc-button" onClick={() => onEquipAvatar?.(loot.id)}>Équiper</button>
          )}
          <button className="mc-button secondary" onClick={onViewChest}>Voir mon coffre</button>
          <button className="mc-button secondary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  )
}
