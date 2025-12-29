# MaloCraft — Quêtes journalières : progression + filtres parents (priorityTags)

## 1) Sources de données
- Progression : `users/{uid}/meta/rewards.masteryByTag` (+ `blockProgress` éventuel).
- Quêtes du jour : `users/{uid}/meta/daily` (`dateKey`, `quests[]`, `bonusAwarded`).
- Événements idempotents : `users/{uid}/rewardEvents/daily_{sessionId}` et `daily_bonus_{dateKey}`.
- Préférences parents (priorityTags = allowlist) : `users/{childId}/meta/npcPriorities` `{ tags: string[] }`. Si absent/invalid → tous les tags de `TAG_CATALOG`.

## 2) Algorithme de génération (session/remediation/progress)
- Point d’entrée : `ensureDailyState(uid)` appelé au chargement (Home) et avant chaque `updateDailyProgress`.
- Règles (Europe/Paris) :
  - `session` : target `DAILY_QUEST_CONFIG.targets.session` (1), pas de tag requis.
  - `remediation` : tag le plus faible `<50` parmi `masteryByTag ∩ priorityTags`. Fallback générique sans tag si rien.
  - `progress` : tag en cours `30–79` (hors remédiation) parmi `masteryByTag ∩ priorityTags`. Fallback générique sans tag si rien.
- Config XP/targets dans `DAILY_QUEST_CONFIG` :
  - targets: `session=1`, `remediation=3`, `progress=5` (tunable).
  - xpRewards: `session=10`, `remediation=20`, `progress=15`, `dailyBonus=30`.
  - sticker commun : inchangé (si au moins une quête complétée).

## 3) Application du filtrage parents
- Utilitaire central : `loadNpcPriorityTags(childId)` (src/data/npcPriorities.ts) → liste des tags autorisés (priorityTags).
- Appliqué dans `buildDailyQuestsFromMastery(..., { priorityTags })` utilisé par `ensureDailyState` et la régénération dans `updateDailyProgress`.
- Si `priorityTags` est vide : quêtes `remediation`/`progress` deviennent génériques (tagId null, message neutre), évitant toute référence à un tag non autorisé.

## 4) Fallback
- Aucun tag autorisé / pas de candidat : quêtes `remediation` et `progress` sans tag, description neutre : “On s’entraîne un peu aujourd’hui, puis on reviendra sur des notions plus ciblées.”
- Le PNJ ne propose pas de start sur un tag bloqué (quêtes sans tag → bouton démarre vers la carte/monde).
- Si les 3 quêtes sont complétées : elles sont masquées pour la journée, avec un message “déjà réalisées”.

## 5) PNJ et quête prioritaire
- Le PNJ affiche les quêtes Firestore (aucun système parallèle).
- Ligne PNJ dérivée du type (`remediation`→repair, `progress`→priority, sinon spaced).
- Quête prioritaire pour le bouton Start : remédiation autorisée si présente, sinon progress autorisée ; sinon fallback générique (redirection carte/monde, message neutre).
- Streak : incrémenté uniquement quand les 3 quêtes sont complétées (statsDays.sessions>0 seulement dans ce cas).

## 6) Points d’extension futurs
- Enrichir les règles avec historique attempts (spaced réel) et streaks.
- Ajouter vérification de disponibilité d’exercices par tag (pour réduire les fallbacks génériques).
- Introduire un cache local des `priorityTags` et invalidation à la connexion parent.
- Ajouter des quêtes bonus conditionnées à la régularité (streak) en conservant `rewardEvents` existants.
