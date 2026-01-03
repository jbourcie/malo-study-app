# MaloCraft — Map Overlay V1

## Activation
- Conditions : graphic pack chargé + anchors présents dans `pack.json`.
- Par défaut, la 5e charge le pack `pack-5e-mvp` qui contient `anchors.biomes`. La config `WORLD_5E_MAP` sert de fallback (ids/labels + anchors secours).
- Si `getWorldMapConfig` retourne `null` ou aucun anchor disponible, la grille classique est utilisée.

## Ajuster les anchors (source de vérité pack.json)
- Modifier `public/assets/graphic-packs/pack-5e-mvp/pack.json` :
  - `anchors.safeArea` pour éviter les bords `{ left, top, right, bottom }`
  - `anchors.biomes.{subject|biomeId}` avec `x`, `y`, `radius?` en coords map.
- Reload Vite après modification (assets sous /public).
- Le layout convertit en pourcentage et centre la tuile (`translate(-50%, -50%)`).
- Fallback : si anchors absents dans le pack, on tente ceux de `WORLD_5E_MAP`, sinon grille.

## Mode debug (admin / dev)
- Activer `VITE_MAP_DEBUG=true` (env) ou ajouter `?mapDebug=1` à l’URL.
- Un calque de debug affiche les crosshairs sur chaque anchor et les coordonnées (x,y).
- Drag & drop un anchor pour le déplacer ; le clamp respecte `safeArea`.
- Bouton “Copy JSON” en overlay : copie la structure `anchors` (safeArea + biomes) prête à être collée dans `pack.json`.
- Les déplacements sont temporaires (mémoire locale) : enregistrer dans `pack.json` pour les rendre persistants.

## Checklist QA (5 minutes)
- Le pack se charge (pas d’erreur) et la baseLayer est visible.
- Les biomes sont positionnés sur la carte (plus de grille) avec les anchors du pack.
- Clic sur un biome ouvre toujours le drawer Biome.
- Le highlight PNJ (`is-highlighted`) reste visible sur le biome ciblé.
- Retirer `anchors` du pack → fallback anchors (world_5e) ou grille si aucun.
- Activer le mode debug (VITE_MAP_DEBUG=true ou `?mapDebug=1`) affiche les crosshairs des anchors.
