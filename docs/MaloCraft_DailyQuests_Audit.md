# MaloCraft — Daily Quests Audit (état actuel)

## Système Firestore de quêtes journalières
- **Définition/code** : `src/rewards/daily.ts` (types `DailyQuest`, `DailyState`, pool `QUEST_POOL`, fonctions `ensureDailyState`, `updateDailyProgress`).
- **Schéma données** :
  - `users/{uid}/meta/daily` : `{ dateKey: 'YYYY-MM-DD', quests: DailyQuest[], updatedAt }` avec `quests` contenant `{ id, title, description, target, progress, completed }`.
  - Idempotence via `users/{uid}/rewardEvents/daily_{sessionId}` (créé dans la transaction) ; récompense sticker éventuelle via `rewardEvents/daily_sticker_{sessionId}` via `unlockCollectible`.
  - Récompenses injectées dans `users/{uid}/meta/rewards` (merge) : met à jour `xp`, `level`, `badges`, `masteryByTag`, `collectibles`, `updatedAt` (pas de champ dédié aux quêtes).
- **Algorithme de génération** : `pickDailyQuests()` prend systématiquement `session_one` + `answer_ten` et choisit aléatoirement un des deux restants (`grammar_one` ou `fractions_five`). Pas de seed ni de persistance autre que le doc Firestore.
- **Règle de reset** : `todayKeyParis()` (Intl date en timeZone `Europe/Paris`, côté client). `ensureDailyState` ou `updateDailyProgress` régénère le doc si `dateKey` != aujourd’hui. Pas de cron ; reset uniquement lorsqu’une de ces fonctions est appelée.
- **Types de quêtes actuelles** (pool fixe de 4) :
  - `session_one` (target 1) : +1 par session.
  - `answer_ten` (target 10) : +answeredCount.
  - `grammar_one` (target 1) : +1 si `tagsUsed` contient `grammaire`/`grammar`.
  - `fractions_five` (target 5) : +count des tags qui commencent par `math_fractions`.
- **Validation / déclenchement** : uniquement à la fin d’une session de `ThemeSessionPage` via `updateDailyProgress({... answeredCount, tagsUsed ...})`. Pas de suivi en temps réel ni par réponse.
- **Attribution de récompenses** :
  - Chaque quête complétée pour la première fois sur la session ajoute +15 XP (pas de coins) dans la transaction.
  - Si au moins une quête est complétée et qu’un sticker `common` non possédé existe (`COLLECTIBLES`), tirage aléatoire puis `unlockCollectible(uid, awardedStickerId, daily_sticker_{sessionId})` après transaction.
  - Idempotence : si `rewardEvents/daily_{sessionId}` existe, toute la transaction s’arrête (pas de progression ni XP/sticker).
- **UX actuelle** : aucune lecture de `meta/daily` dans l’app. Pas de composant affichant l’état ou les récompenses de quêtes Firestore ; l’enfant ne voit pas ces quêtes ni leur progression.
- **Points faibles / risques** :
  - Système caché (non exposé UI), donc progression/récompenses non visibles.
  - Reset uniquement lorsqu’un appel a lieu (si l’enfant ne lance pas de session, le doc reste sur l’ancien jour). Dépend du fuseau côté client (risque de dérive si device mal configuré).
  - Pool très réduit et logique de détection simple (substring de tag), facile à contourner/false positives.
  - Événement idempotent indexé sur `sessionId` uniquement (pas sur la date) : si un même `sessionId` est réutilisé un autre jour, la progression serait bloquée.
  - Pas de métrique d’usage ni de tests automatisés couvrant ces quêtes.

## Mission quotidienne PNJ (Guide Malo) — locale
- **Définition/code** : `src/pages/Home.tsx`, `src/components/game/NpcGuideCard.tsx`, stockage utilitaire `src/game/npc/npcStorage.ts`, génération `src/game/npc/npcRecommendation.ts`.
- **Schéma données (localStorage)** :
  - Mission du jour : `malocraft.npc.daily.{dateKey}` stocke un `NpcRecommendation` (NPC, message, expedition type/targetTag/...).
  - Reroll : `malocraft.npc.dailyReroll.{dateKey}` (bool) et `malocraft.npc.dailyRerollCount.{dateKey}` (compteur). Préférence NPC : `malocraft.npc.preferredId`.
- **Algorithme de génération** :
  - `HomePage` charge les tags disponibles (présence d’exos) puis appelle `buildNpcRecommendation`/`getOrCreateDailyRecommendation` avec `masteryByTag`, `availableTags`, `priorityTags`.
  - `buildNpcRecommendation` choisit selon priorité : repair (via `shouldRepair`), mine prioritaire (tags prioritaires ou en découverte), spaced (>5 jours), puis craft (pair de tags maîtrisés). Utilise `formatDateKeyParis` (Europe/Paris) pour la clé jour.
- **Règle de reset** : clé datée `YYYY-MM-DD` en timeZone Paris ; la mission du jour est re-générée ou rerollée côté client (pas de Firestore). Reroll limité (1/j pour enfant, 100/j pour parent) via compteurs localStorage.
- **UX** :
  - L’enfant voit la mission dans la carte « Guide Malo » sur `HomePage` (NPC + message + bloc cible). Peut reroll (popup « Mission déjà changée » si limite) et lancer une expédition (ouvre `/theme/expedition?...`).
  - Aucune synchronisation avec le doc `meta/daily` ; cette « mission » est purement locale.
- **Récompenses / validation** :
  - Pas de reward dédiée ni de suivi de complétion. La mission sert de suggestion de session ciblée, sans feedback de réussite/échec et sans lien avec l’XP ou les stickers des quêtes Firestore.
- **Points faibles / risques** :
  - Double système non connecté : la mission PNJ ne coche aucune quête Firestore, et les quêtes Firestore sont invisibles dans l’UI.
  - Stockage localStorage : perte en cas de changement de device/navigateur ou nettoyage. Pas d’anti-triche ni de contrôle parent côté backend.
  - Reroll et sélection dépendent de la disponibilité client (peut diverger des données réelles Firestore si absence de réseau).

## Synthèse
- Deux systèmes coexistent : (1) quêtes Firestore avec progression/récompenses mais sans UI, (2) mission quotidienne PNJ côté client avec UI mais sans progression/récompenses. Aucun lien ni synchronisation entre eux.
- Reset/day-key basé sur `Europe/Paris` dans les deux cas, mais piloté côté client. Pas de processus serveur ni de consolidation multi-appareils.
