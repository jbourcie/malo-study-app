Doc technique compilée A+B+C (version “prompt-ready”)

## A — États visuels (lecture seule, implémenté)

Sources (existantes)
- `tagCatalog.ts` : subject (biome), theme (zone), id (tagId)
- `users/{uid}/meta/rewards` : `blockProgress[tagId]` (attempts, correct, successRate 0–100, masteryScore/score 0–100, updatedAt), `masteryByTag[tagId].score`

Module UI : `src/game/visualProgress.ts`
- `getBlockVisualState(entry)` → state + overlay weathered
- `getZoneVisualState(subject, theme, tagIds, rewardsMeta)` → agrégations + état de zone
- `getBiomeVisualState(subject, zones, rewardsMeta)` → agrégations de biome

Règles Bloc
- `locked` si `attempts == 0`
- `beautified` si `masteryScore >= 80`
- `cracked` si `successRate < 40`
- `repaired` sinon (40–79)
- `weathered` overlay si `daysSince(updatedAt) > 14` (visuel only)

Règles Zone (theme, par subject+theme)
- Agrégations : %locked, %cracked, %repaired, %beautified, %stable = repaired+beautified
- `ruins` si %locked + %cracked >= 70
- `rebuilt_ready` si %stable >= 80
- `building` sinon
- (Phase B) `rebuilding` si rebuilt_ready ET `zoneRebuildProgress.correctCount` > 0 ET < 35 ; `rebuilt` si correctCount >= 35 ; `decaying` plus tard si rebuilt mais inactif longtemps (visuel)

Règles Biome (subject)
- Dérivé des zones (lecture seule) : `wasteland` si locked+cracked >= 70% des blocs, `thriving` si stable >= 80%, `recovering` si stable >= 40%, sinon `neglected`.
- Extensions C : ajouter état biome_rebuild_ready/rebuilding/rebuilt basé sur `biomeRebuildProgress` (voir plus bas).

## B — Reconstruction de zone (multi-blocs, cumul 35 bonnes réponses)

Stockage (Option A validée)
- Dans `users/{uid}/meta/rewards` : `zoneRebuildProgress[zoneKey] = { correctCount, target: 35, updatedAt, rebuiltAt? }`
- `zoneKey = "${subject}__${theme}"`

Gating
- Zone reconstructible si `zoneVisualState == rebuilt_ready` (donc %stable >= 80)

Session
- `sessionKind = "reconstruction_theme"`
- 15–20 questions
- multi-tags du même theme (dans le biome subject)
- difficulté majoritaire 1–2 (diff 3 rare, only if mastery>70)

Contribution
- delta = #bonnes réponses dont le tag appartient à la zone ciblée
- appliquer `zoneRebuildProgress.correctCount += delta` (cap à 35)

Idempotence
- `rewardEventId = "zone_rebuild_${zoneKey}_${sessionId}"`
- si event existe → ne rien appliquer

UX
- Zone : jauge “Reconstruction : 12/35” + barre
- Après session : “+7 (19/35)” + message PNJ
- Biome : vignette zone affiche mini jauge si rebuilding
- Effet quand 35 atteint : zone passe rebuilt, changement visuel majeur (structure/quartier/écosystème complet)

Implémentation (phase B)
- Module `src/game/rebuildService.ts` : `zoneKey`, `applyZoneRebuildProgress` (idempotent via `rewardEvents/zone_rebuild_${zoneKey}_${sessionId}`).
- Session : `sessionKind=reconstruction_theme` (query). Plomberie dans `ThemeSessionPage` : sélection multi-tags du thème (`tagCatalog` subject+theme), 18 questions filtrées diff 1–2 (diff3 autorisée si maîtrise >=70).
- Contribution = somme des `correct` par tag de la zone (pas d’impact sur mastery/blockProgress).
- État visuel zone : `rebuilt_ready` → bouton actif ; `rebuilding` dès qu’un delta >0 ; `rebuilt` à 35/35. CTA visible sur `ZonePage`, mini jauge sur `BiomePage`.
- Idempotence : rewardEvent empêche le double comptage après refresh.
- PNJ : message light lorsque la zone atteint `rebuilt` (réutilise ligne d’encouragement).

Tests manuels
- Lancer une session reconstruction depuis une zone `rebuilt_ready` : terminer avec 8 bonnes réponses → jauge passe 8/35, rewardEvent créé.
- Relancer une session (même sessionId rejoué doit être ignoré, nouveau sessionId additionne) jusqu’à dépasser 35 : jauge cap à 35/35, état visuel `rebuilt`, message PNJ affiché. Refresh pour vérifier persistance et absence de double application.

## C — Reconstruction de biome (cumul 100 bonnes réponses)

Stockage
- Dans `users/{uid}/meta/rewards` : `biomeRebuildProgress[biomeKey] = { correctCount, target: 100, updatedAt, rebuiltAt? }`
- `biomeKey = subject` (ex: fr)

Prérequis
- au moins 60% des zones du biome sont rebuilt (35/35) → biome passe biome_rebuild_ready

Session
- `sessionKind = "reconstruction_biome"`
- 20–25 questions
- multi-themes du biome (priorité zones rebuilt_ready/rebuilding, puis le reste)
- difficulté majoritaire 1–2 (diff 3 rare)

Contribution
- delta = #bonnes réponses dont le tag appartient au biome (subject)
- `biomeRebuildProgress.correctCount += delta` (cap à 100)

Idempotence
- `rewardEventId = "biome_rebuild_${biomeKey}_${sessionId}"`

UX
- Carte biome : jauge “Biome : 42/100”
- États : not_ready / ready / rebuilding / rebuilt
- Carte monde : %zones rebuilt + jauge biome si active
- Effet quand 100 atteint : biome passe rebuilt → transformation globale + message PNJ

Implémentation (phase C)
- Prérequis ready : ≥60% des zones du biome avec `zoneRebuildProgress.correctCount >= target (35)`.
- Module `rebuildService.applyBiomeRebuildProgress` (idempotent via `rewardEvents/biome_rebuild_${subject}_${sessionId}`) : contribution = bonnes réponses tags du subject.
- Session : `sessionKind=reconstruction_biome`, 22 questions (~20–25), multi-themes du subject, priorité aux zones les plus avancées. Diff 1–2 (diff3 autorisée si maîtrise>=70 sur une des tags sélectionnées). Pas d’impact sur mastery/blockProgress.
- États UI : `BiomePage` affiche jauge + état not_ready/ready/rebuilding/rebuilt + CTA (enabled quand ready/rebuilding) → lance la session. `WorldMapPage` affiche % zones reconstruites + jauge biome.
- PNJ : message d’encouragement à l’atteinte de 100/100.

Tests manuels
- Préparer un biome avec ≥60% zones à 35/35. Lancer “Reconstruire le biome”, finir une session avec N bonnes réponses → jauge augmente de N (cap 100), rewardEvent écrit. Refresh : pas de double comptage.
- Rejouer une nouvelle session avec d’autres bonnes réponses jusqu’à 100 : jauge 100/100, état “rebuilt”, message PNJ, persistance après refresh.
