# Audit MaloCraft Rewards (existant)

- **Doc Firestore récompenses** : `users/{uid}/meta/rewards`
  - Champs actuels : `xp`, `level`, `badges?`, `masteryByTag? (Record<tag, {state, score, updatedAt}>`, `collectibles? { owned: string[], equippedAvatarId? }`, `updatedAt`
- **Types** :
  - `src/rewards/rewards.ts` : `UserRewards` (xp/level/badges/masteryByTag/collectibles/updatedAt)
  - `src/rewards/rewardsService.ts` reconstruit les valeurs et initialise les défauts.
- **Lecture en UI** :
  - `useUserRewards` (state hook) lit `users/{uid}/meta/rewards` en temps réel avec fallback `collectibles` vide.
- **Fin de session** :
  - `ThemeSessionPage` orchestre la fin de session : `saveSessionWithProgress` → `saveAttemptAndRewards` → calcul XP (`computeSessionXp`) → `awardSessionRewards` + `applyMasteryEvents` + `evaluateBadges` + roll collectible (`rollCollectible` + `unlockCollectible`).
- **Attribution des rewards** :
  - `awardSessionRewards` (transaction) ajoute XP/level + enregistre un event idempotent dans `users/{uid}/rewardEvents/{sessionId}`.
  - `applyMasteryEvents` (transaction) écrit `masteryByTag` et des events `rewardEvents/{sessionId}_{exerciseId}` pour idempotence.
  - `unlockCollectible` (transaction) ajoute un collectible et event optionnel `rewardEvents/{eventId}`.
- **Idempotence** :
  - Basée sur `rewardEvents` : si le doc existe déjà, la transaction s’arrête (XP, mastery, collectibles).
  - `awardSessionRewards` utilise `rewardEvents/{sessionId}` ; `applyMasteryEvents` utilise `{sessionId}_{exerciseId}` ; collectibles utilisent `eventId` explicite.

👉 Extension MaloCraft doit donc réutiliser `users/{uid}/meta/rewards` (champ additionnel `malocraft`) + `rewardEvents` avec clé `malocraftLoot:{sessionId}` pour rester idempotent et compatible.
