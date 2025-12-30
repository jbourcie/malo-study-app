import React from 'react'
import type { UserRewards } from '../../rewards/rewards'
import { computeLevelFromXp } from '../../rewards/rewards'
import { BADGES } from '../../rewards/badgesCatalog'
import { COLLECTIBLES, type CollectibleDef } from '../../rewards/collectiblesCatalog'

type Props = {
  rewards: UserRewards
  streak?: number
  equippedAvatarId?: string | null
  onOpenCollection?: () => void
  onChangeNpc?: () => void
}

export function PlayerHudCompact({
  rewards,
  streak = 0,
  equippedAvatarId,
  onOpenCollection,
  onChangeNpc,
}: Props) {
  const levelInfo = computeLevelFromXp(rewards.xp || 0)
  const badges = rewards.badges || []
  const recentBadges = badges.slice(-3).map(id => BADGES.find(b => b.id === id)).filter(Boolean)
  const avatar: CollectibleDef | undefined = equippedAvatarId ? COLLECTIBLES.find(c => c.id === equippedAvatarId) : undefined
  const coins = rewards.coins || 0

  return (
    <div className="card mc-card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: '1.8rem', width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {avatar?.icon || '🙂'}
          </div>
          <div>
            <div className="small" style={{ color: 'var(--mc-muted)' }}>Profil</div>
            <div style={{ fontWeight: 900 }}>Niveau {levelInfo.level}</div>
            <div className="small">XP {rewards.xp || 0} · Prochain : {levelInfo.xpIntoLevel}/{levelInfo.xpForNext}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <span className="mc-chip gold">🪙 {coins}</span>
          {streak > 0 && <span className="mc-chip accent">🔥 Streak {streak} j</span>}
        </div>
      </div>
      {recentBadges.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="small" style={{ color: 'var(--mc-muted)' }}>Derniers badges</div>
          <div className="row" style={{ gap: 6 }}>
            {recentBadges.map(b => (
              <span key={b!.id} className="mc-chip">{b!.icon || '🏅'} {b!.title}</span>
            ))}
          </div>
        </div>
      )}
      <div className="row" style={{ marginTop: 10, gap: 8 }}>
        {onOpenCollection && <button className="mc-button secondary" onClick={onOpenCollection}>Voir ma collection</button>}
        {onChangeNpc && <button className="mc-button secondary" onClick={onChangeNpc}>Changer de guide</button>}
      </div>
    </div>
  )
}
