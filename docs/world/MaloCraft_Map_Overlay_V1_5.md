# MaloCraft — Map Overlay V1.5 (Zones)

## Ce que V1.6 ajoute
- Quartiers cliquables (zones) pour le biome actif : cliquer ouvre le ZoneDrawer (pas de clutter global).
- Affichage toujours ancré sur la baseLayer du pack, en respectant le safeArea.
- Carte globale = biomes uniquement; les quartiers apparaissent quand le biome est ouvert (ou en debug).

## Anchors zones dans pack.json (source de vérité)
- Dans `public/assets/graphic-packs/pack-5e-mvp/pack.json` :
```json
"anchors": {
  "safeArea": { "left": 80, "top": 70, "right": 80, "bottom": 90 },
  "biomes": { ... },
  "zones": {
    "fr": {
      "Compréhension": { "x":..., "y":..., "radius": 28 },
      "Lexique": { ... }
    },
    "math": { "Fractions": { ... }, "Nombres & calcul": { ... }, ... },
    "en": { "Vocabulaire": { ... }, "Grammaire": { ... }, "Compréhension": { ... } },
    "es": { ... },
    "hist": { ... }
  }
}
```
- Clés `zones` = labels de theme (tagCatalog) pour chaque matière.
- Coordonnées en pixels de la map (width/height du pack). `safeArea` clamp les positions pour éviter les bords.
- Anchors zones optionnels : si absents → pas de chips zones, fallback biomes/grille intact.

## Calcul du progrès zone
- Priorité au stockage si présent : `zoneRebuildProgress[zoneKey(subject, theme)].correctCount/target` (target 100).
- Sinon, somme des `correct` sur les tagIds de la zone (blockProgress) → progress = clamp((sommeCorrect/100)*100).
- `state`: `rebuilt` si progress≥100, `rebuilding` si progress>0, `intact` sinon. `degraded` si dernière activité >14 jours.

## Mode debug (anchors)
- Activer `VITE_MAP_DEBUG=true` ou `?mapDebug=1`.
- Crosshair sur anchors biomes + zones (respecte safeArea).
- Drag & drop pour ajuster les points.
- Bouton “Copy JSON” : copie `anchors` (safeArea + biomes + zones) prêt à coller dans `pack.json`.
- Les déplacements sont temporaires tant que non recollés dans le pack.

## Checklist QA (10 minutes)
- Pack chargé, baseLayer visible, safeArea clamp OK.
- Biomes compacts positionnés.
- Ouvrir un biome → chips zones autour de ce biome uniquement; fermer → chips disparaissent.
- Clic chip zone → ZoneDrawer s’ouvre (titre biome + zone), retour ok.
- Progress zones cohérent (0..100) et états (intact/rebuilding/rebuilt/degraded).
- Debug layer zones OK (drag + Copy JSON), clic ouvre la bonne zone.
- Fallback : supprimer anchors.zones du pack → pas de chips zones, aucune régression (biomes/grille inchangés).
