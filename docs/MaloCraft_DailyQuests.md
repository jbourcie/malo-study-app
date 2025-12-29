# MaloCraft – Quêtes journalières unifiées

## Données Firestore
- `users/{uid}/meta/daily` (document jour en Europe/Paris) :
  - `dateKey: YYYY-MM-DD`
  - `quests: DailyQuest[]` avec `{ id, type: 'session' | 'remediation' | 'progress', title, description, target, progress, completed, tagId?, tagHint? }`
  - `bonusAwarded?: boolean`
  - `updatedAt`
- Idempotence :
  - `users/{uid}/rewardEvents/daily_{sessionId}` pour la progression/XP des quêtes (une fois par session).
  - `users/{uid}/rewardEvents/daily_bonus_{dateKey}` pour le bonus du jour (max 1/jour).

## Génération (Europe/Paris)
- Déclenchée par `ensureDailyState(uid)` (appelée au chargement de l’accueil via `useDailyQuests` et avant chaque mise à jour).
- Source : `masteryByTag` dans `meta/rewards`.
- 3 quêtes créées chaque jour :
  1. `session` — régularité : target `1`.
  2. `remediation` — tag avec score < 50 (le plus faible) filtré par `priorityTags` parent : target `3` bonnes réponses, `tagId/tagHint` renseignés si disponibles.
  3. `progress` — tag en cours (score 30–79, hors remédiation) filtré par `priorityTags` parent : target `5` bonnes réponses, `tagId/tagHint` renseignés si disponibles.
- Fallback : si aucun tag éligible/autorisé, les quêtes restent génériques (sans tag) mais gardent leurs cibles.

## Progression & validation
- Fonction centrale : `updateDailyProgress({ uid, sessionId, answeredCount, tagsUsed, tagStats })` appelée en fin de session (`ThemeSessionPage`).
- `tagStats` est calculé depuis les réponses (par tag : answered/correct). Sans `tagStats`, un fallback minimal compte 1 correcte par tag vu.
- Logique par type :
  - `session` : +1.
  - `remediation` : +correct sur le `tagId` ciblé (ou min(answeredCount, 3)).
  - `progress` : +correct sur le `tagId` ciblé (ou min(answeredCount, 5)).
- Rewards XP (config `DAILY_QUEST_CONFIG.xpRewards`) :
  - session : +10 XP
  - remediation : +20 XP (valorise la remédiation)
  - progress : +15 XP
  - bonus jour (3/3) : +30 XP (`rewardEvents/daily_bonus_{dateKey}`)
- Targets (config `DAILY_QUEST_CONFIG.targets`) :
  - session : 1
  - remediation : 3
  - progress : 5 (tunable à 4 si friction)
- Stickers communs : tirage si au moins une quête complétée (inchangé).
- Idempotence conservée : si `rewardEvents/daily_{sessionId}` existe, rien n’est appliqué ; le bonus est protégé par `daily_bonus_{dateKey}`.
- Streak : les stats quotidiennes (`statsDays`) ne comptent la session que si les 3 quêtes sont complétées (streak basé sur `sessions>0` ce jour-là).

## UX PNJ
- `useDailyQuests` (onSnapshot + ensure) alimente l’accueil.
- `NpcGuideCard` affiche les 3 quêtes avec progression, ligne PNJ (raison : session→spaced, remediation→repair, progress→priority), état du bonus.
- Bouton “Lancer une session” démarre une expédition sur la quête à tag prioritaire (sinon renvoie vers la carte/monde).

## Alignement PROGRESSION_RULES_5E
- Régularité (session) garantie chaque jour.
- Remédiation cible un tag < 50 (faible).
- Valorisation/improvement cible un tag en cours (30–79) pour encourager la progression contrôlée.
- Aucun nouveau système : on réutilise `meta/daily`, `rewardEvents`, `masteryByTag`, PNJ existant.
