# MaloCraft NPC Guide Extension

- **Événements ajoutés** : `session_start`, `wrong_answer`, `session_end`, `streak_praise` (optionnel). L’événement quotidien reste géré via le couple `reasonCode`/`pickNpcLine`.
- **Dialogue** : `src/game/npc/npcDialogue.ts` expose `getNpcLine(npcId, event, context)` (fallback + anti-répétition localStorage). Conserve les PNJ/avatars existants.
- **Intégrations** :
  - `src/pages/ThemeSession.tsx` : bulle PNJ au démarrage de session (objectif + rappel possible) via le PNJ préféré existant.
  - Même page : ligne PNJ par mauvaise réponse (encouragement + CTA “Voir l’astuce” qui ouvre le rappel de leçon contextualisé existant).
  - Même page : encart PNJ en fin de session (synthèse XP/progression bloc) dans le flux de corrections.
- **Sources de préférence** : réutilisation de `malocraft.npc.preferredId` (pas de nouveau champ).

## TODO (quests)
- Brancher les quêtes journalières et le bonus reward quotidien avec ces nouveaux événements (sans changer `rewardEvents` pour l’instant).
