import React from 'react'
import { NPC_CATALOG, type NpcId } from '../../game/npc/npcCatalog'
import { setPreferredNpcId } from '../../game/npc/npcStorage'

type Props = {
  open: boolean
  onClose: () => void
  onPicked?: (id: NpcId) => void
}

export function NpcPickerModal({ open, onClose, onPicked }: Props) {
  if (!open) return null
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999 }}>
      <div className="card mc-card" style={{ maxWidth: 600, width:'92%', maxHeight:'90vh', overflowY:'auto' }}>
        <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
          <h3 className="mc-title">Choisis ton guide</h3>
          <button className="mc-button secondary" onClick={onClose}>Fermer</button>
        </div>
        <div className="grid2">
          {Object.values(NPC_CATALOG).map(npc => (
            <div key={npc.id} className="mc-card" style={{ border:'2px solid var(--mc-border)' }}>
              <div className="row" style={{ alignItems:'center', gap:10 }}>
                <div style={{ fontSize:'2rem' }}>{npc.avatar}</div>
                <div>
                  <div style={{ fontWeight:900 }}>{npc.name}</div>
                  <div className="small" style={{ color:'var(--mc-muted)' }}>{npc.shortTagline}</div>
                </div>
              </div>
              <button
                className="mc-button"
                style={{ marginTop:10, width:'100%' }}
                onClick={() => {
                  setPreferredNpcId(npc.id)
                  onPicked?.(npc.id)
                  onClose()
                }}
              >
                Choisir
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
