# Tests Malo Study App

## Installer et lancer
- `npm install` (installe Vitest en dev)
- `npm test` pour exécuter la suite en mode CI
- `npm run test:watch` pendant le dev

Config : Vitest (environnement node), fichiers dans `tests/**/*.test.ts`.

## Ajouter un test
- Pour la logique rewards/progression, préférer des tests unitaires sans Firebase.
- Utiliser `InMemoryRewardStore` (`src/rewards/rewardStore.ts`) pour mocker `rewardEvents`/`rewards` et vérifier l'idempotence.
- Les helpers purs (`computeSessionXp`, `normalize`) peuvent être testés directement.
- Garder des tests déterministes (pas de `Date.now()` non mocké ou d'accès réseau).
