# MaloCraft UX – WorldHub

## Objectifs
- 1 route joueur principale : `/` (WorldHub). Sessions restent sur `/theme/*` (expedition/reconstruction).
- Les vues Home/World/Biome/Zone/Chest/Collection/Progression sont accessibles en **drawers** superposables.
- Admin inchangé (`/admin/*`).

## Mapping ancien -> nouveau
- Accueil/Home → WorldHub (HUD + daily quests + biomes).
- WorldMap/Biome/Zone → BiomeDrawer / ZoneDrawer / BlockDrawer.
- Chest / Collection / Progression joueur → drawers dédiés.
- ThemeSession → inchangé (plein écran `/theme/*`).
- Routes legacy conservées pour rollback : `/home`, `/world`, `/world/:biomeId`, `/world/:biomeId/zone/:themeId`.

## Structure WorldHub
- HUD compact : niveau/XP/streak.
- Panneau PNJ principal (npcGuideAdvisor + seed dailyDateKey) avec CTA unique.
- DailyQuestsCompact : 3 quêtes, progression barre, CTA “Lancer une session”.
- Actions rapides : Inventaire (ChestDrawer), CollectionDrawer, ProgressDrawer.
- Grille biomes (BiomeTile) : icône, description, % maîtrise, **monument biome** (0/100) + état (locked/building/active). Click → BiomeDrawer.

### Stack de drawers
- BiomeDrawer (zIndex 920) : BiomeSummaryPanel (monument + jauge 0/100 + CTA reconstruction_biome), ZoneTilesGrid (monument zone 0/35), BlockGrid (états cracked/repair/beautified/weathered). Back → ferme BiomeDrawer.
- ZoneDrawer (zIndex 940) : ZoneSummaryPanel (monument 0/35 + CTA reconstruction_theme), ZoneBlocksGrid. Back → retourne BiomeDrawer.
- BlockDrawer (zIndex 960) : BlockActionsPanel (mine/repair/craft existants) + CTA leçon/expédition. Back → retourne ZoneDrawer.
- ChestDrawer / CollectionDrawer / ProgressDrawer (zIndex 980) : réutilisation du contenu existant.
- Drawer générique : focus trap, ESC, overlay click, scroll lock, bouton back facultatif.

## Monuments / quartiers
- Biome monument : `biomeRebuildProgress[subject].correctCount` / 100.
- Zone monument : `zoneRebuildProgress[zoneKey].correctCount` / 35.
- États : locked (0), building (0<x<target), active (x>=target). Affichés dans BiomeTile, ZoneTile, BiomeDrawer, ZoneDrawer.
- Pur affichage (pas de nouvelle progression).

## Lancer une session (inchangé)
- Daily quest CTA → `/theme/expedition?expeditionType=mine|repair&targetTagId=...`.
- PNJ CTA advisor → `reconstruction_theme` (`/theme/reconstruction_{theme}?sessionKind=reconstruction_theme...`), `reconstruction_biome`, ou `tag_session` (`/theme/expedition?...`).
- Bloc (BlockDrawer) → `/theme/expedition?expeditionType=...&targetTagId=...&biomeId=...`.
- Reconstruction boutons Biome/Zone → routes reconstruction existantes.

## Checklist QA manuelle
- WorldHub charge HUD, PNJ, daily quests, grille biomes (monuments visibles).
- PNJ CTA navigue vers la bonne session `/theme/*`.
- Daily quest CTA ouvre une session avec le tag attendu.
- Click biome → BiomeDrawer (monument biome 0/100, zones avec 0/35). Back ferme correctement.
- Click zone → ZoneDrawer (monument zone 0/35, stats stables/patinés). Back retourne au biome.
- Click bloc → BlockDrawer (mine/repair/craft) puis CTA ouvre `/theme/expedition` avec bons params.
- Reconstruction : CTA zone/biome accessibles uniquement quand `rebuilt_ready`/`ready` (utilise progressions existantes).
- States visuels : cracked/repaired/beautified/weathered visibles sur blocks et tiles.
- Rewards/daily/PNJ idempotents inchangés (sessions et modales récompenses toujours via ThemeSession).
- Admin routes toujours accessibles depuis TopBar (parent/admin).
