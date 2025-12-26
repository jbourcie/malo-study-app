import React from 'react'
import type { UserRewards } from '../rewards/rewards'
import { computeLevelFromXp } from '../rewards/rewards'

export function RewardsHeader({ rewards }: { rewards: UserRewards }) {
  const { xp, level } = rewards || { xp: 0, level: 1 }
  const levelInfo = computeLevelFromXp(xp || 0)
  const progress = Math.min(100, Math.max(0, Math.round(levelInfo.xpIntoLevel / levelInfo.xpForNext * 100)))

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>Niveau {levelInfo.level}</div>
        <div className="small">XP total : {xp || 0}</div>
      </div>
      <div className="small">Prochain niveau : {levelInfo.xpIntoLevel}/{levelInfo.xpForNext} XP</div>
      <div style={{ height: 12, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg,#7aa2ff,#2ecc71)',
          transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  )
}
