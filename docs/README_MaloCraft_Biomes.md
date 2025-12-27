# MaloCraft – Biomes + future carte du monde

## Fichiers
- `src/game/biomeCatalog.ts` : définition des zones (biomes)
- `src/game/blockCatalog.ts` : mapping tags -> blocs

## Utilisation
- Afficher les biomes sur une page "Carte du monde"
- Filtrer la progression par biome/matière
- Associer un tag à un biome via:
  - `getTagMeta(tagId).subject` puis `subjectToBiomeId(subject)`
  - ou directement via `getBlockDef(tagId).biomeId`

## Étape suivante (carte du monde)
- créer une page `WorldMapPage`
- afficher une grille de biomes
- cliquer un biome -> liste des blocs (tags) avec leur état de maîtrise
