# MaloCraft — Guide PNJ (biomes)

## Rôle
- Interface UX unique pour orienter l’enfant dans un biome : reconstruction de zone/biome, remédiation ciblée, progression contrôlée, ou liberté.
- S’appuie sur les données existantes (aucun nouveau PNJ ni nouveau système de quêtes).
- Produit une recommandation unique `{ messageKey, ctaLabel, actionType, payload }` consommée par l’UI.

## Sources de données
- Progression pédagogique : `rewards.masteryByTag`, `rewards.blockProgress`.
- Avancement visuel : `getZoneVisualState` / `getBiomeVisualState` via `rewards.zoneRebuildProgress` et `rewards.biomeRebuildProgress`.
- Filtres parents (allowlist) : `loadNpcPriorityTags(uid)` → `allowedTags`.
- Cartographie : blocs du biome (tags + thèmes) et règles `PROGRESSION_RULES_5E` déjà appliquées via mastery.
- Daily quests : inchangées, toujours rendues par `NpcGuideCard` sur `HomePage`.

## Options éligibles (ordre logique, puis tirage pondéré)
- `reconstruction_theme` : zone rebuild_ready ou rebuilding et autorisée par filtres parent.
- `reconstruction_biome` : biome ready/rebuilding avec `correctCount < target(100)`.
- `remediation_tag` : tag autorisé `masteryScore < 50`.
- `progress_tag` : tag autorisé `30 ≤ masteryScore < 80` (zone non reconstruite).
- `fallback_explore` : toujours disponible.

## Tirage pondéré (npcGuideAdvisor.ts)
- Build des options éligibles avec `adviceId` stable (ex: `zone_rebuild_fr__grammaire`, `biome_rebuild_fr`, `remediate_<tagId>`, `progress_<tagId>`, `explore_fr`).
- Poids par défaut :
  - Si zone rebuilding : themeRebuild=0.55, remediation=0.20, progress=0.20, biome=0.05.
  - Si zone rebuilt_ready : themeRebuild=0.45, remediation=0.25, progress=0.25, biome=0.05.
  - Sinon : theme=0.20, remediation=0.25, progress=0.30, biome=0.15, fallback=0.10.
  - Biome ready : poids biome boosté (x1.5 si ≥70/100, x2 si ≥90/100), renormalisation sur les seules options éligibles.
- Anti-répétition :
  - Message : on évite la même variante consécutive (rotation des `messageKey` par biome).
  - Action : si l’option tirée = dernière action, pénalité (x0.25) puis nouveau tirage (1 tentative). Si impossible, on garde l’action mais change la variante message si dispo.
- Seed stable par jour et par biome : `hash("${uid}|${biomeKey}|${dailyDateKey}")`, PRNG mulberry32.
  - `dailyDateKey` pris depuis `meta/daily.dateKey` ; fallback local `YYYY-MM-DD` Europe/Paris (aucune écriture DB).
- Respect strict des filtres parents : aucune option sur un tag/zone non autorisé.

## Lien avec les autres systèmes
- **Quêtes journalières** : aucune duplication. Le PNJ sur Home continue d’afficher les quêtes Firestore. Le conseiller de biome ne crée ni n’altère ces quêtes.
- **Reconstruction zone** : réutilise `zoneRebuildProgress` (seuil 35) et le routage `sessionKind=reconstruction_theme`.
- **Reconstruction biome** : réutilise `biomeRebuildProgress` (seuil 100) et le statut `ready/rebuilding` issu de `getBiomeVisualState`.
- **Filtres parents** : toute sélection de zone ou de tag passe par `allowedTags` ; une zone sans tag autorisé n’est pas proposée.

## Ce que le PNJ ne fait pas
- Ne crée pas de nouveau PNJ ni de nouveau système de quête.
- Ne modifie pas les règles pédagogiques ni `PROGRESSION_RULES_5E`.
- Ne duplique pas la logique des quêtes journalières et ne touche pas à `NpcGuideCard`.
- Ne déclenche pas d’écran supplémentaire : une bulle courte + un CTA principal.

## Faire évoluer sans casser la pédagogie
- Ajuster les poids dans `computeWeights` en gardant la renormalisation et le seed inchangés pour conserver la stabilité journalière.
- Ajouter des signaux (historique, météo des blocs) dans `npcGuideAdvisor.ts` sans casser le mapping actionType/payload.
- Si de nouvelles sessions apparaissent, conserver les `actionType` existants ou mapper proprement dans l’UI (pas de logique métier dans les composants).
- Étendre les variantes de message en gardant les `messageKey` stables (anti-répétition).
- Toujours respecter `allowedTags` et les seuils de rebuild (35 zone / 100 biome) pour éviter les propositions impossibles.

## Validation manuelle
- Zone `rebuilt_ready` ou `rebuilding` : vérifier qu’elle est dans les options et majoritaire avec les poids adaptés ; refresh dans la même journée → conseil stable.
- Biome prêt : avec ≥60% zones reconstruites et `biomeRebuildProgress.correctCount < 100`, constater que l’option biome existe et voit son poids augmenté (surtout à 70/90%).
- Filtres parents : appliquer un allowlist excluant un tag/une zone, contrôler qu’aucune option ne référence ce tag/zone.
- Anti-répétition : effectuer deux refresh successifs → pas deux fois le même message, et si possible pas deux fois la même action (sinon variante de message différente).
- Stabilité jour vs lendemain : même journée → même conseil; changer la dateKey (ou passer au lendemain) → seed change, le conseil peut varier.
