# MaloCraft Tiles V2.1

Objectif: hiérarchie visuelle claire (Zone > Block), V3-ready, sans changer la logique métier.

## Composants
- `ZoneTile`: repère majeur sur la carte biome (pas d’action directe de jeu)
  - Props: `label`, `state` (`locked|foundation|rebuilding|rebuilt|weathered`), `progressPct`, `highlight?`, `variant=overlay|debug`, `radiusPx?`, `onOpenZone()`
  - Rendu: puck 92-120px, anneau de progression, badge d’état, glow sur highlight.
- `BlockTile`: action (jouer) sur carte zone ou en liste
  - Props: `tagId`, `label`, `state` (`cracked|repairing|repaired|enhanced`), `masteryPct`, `highlight?`, `variant=overlay|list`, `onStartSession()`
  - Rendu: 44-56px overlay, 100% largeur en liste, mini barre de maîtrise.

## Intégration
- BiomeMapPage: zones ancrées -> `ZoneTile` (overlay). Clic = /zone si map dispo, sinon panel local.
- ZoneMapPage: blocs ancrés -> `BlockTile` (overlay); fallback liste blocs -> `BlockTile` variant `list`.
- Debug `?mapDebug=1` intact (anchors visibles, tiles restent cliquables).

## Styles
- Classes: `.mc-zoneTile`, `.mc-blockTile` (+ variants/états). Couleurs via variables CSS (voir malocraft.css).
- Hiérarchie: ZoneTile ~2x BlockTile.

## Accessibilité
- aria-label sur tiles, focus visible, navigation clavier (Enter/Space) sur buttons.

## Fallbacks
- Pas d’anchors.blocks: blocs rendus en liste avec `BlockTile` variant `list`.
- Pas de map zone: panel local (inchangé) sur /biome.

## QA rapide (10 min)
1) /biome/: zones lisibles, hiérarchie claire, focus/hover OK.
2) /zone/: blocs ancrés visibles; clic démarre session; fallback liste OK.
3) Debug mode: anchors + tiles affichés; interactions ok.
4) Mobile: tiles utilisables (tap), pas de superposition illisible.
5) Fallback sans anchors.blocks -> liste stylée OK.
