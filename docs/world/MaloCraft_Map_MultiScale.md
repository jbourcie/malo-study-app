# MaloCraft — Map Multi-Échelle (V1.6+)

## Structure des maps dans le pack
- `maps.world` : carte globale (biomes), fallback : `map` (legacy).
- `maps.biomes.{biomeId}` : carte détaillée par biome (zones). Si manquante, fallback drawer legacy.
- `maps.zones.{biomeId:zoneKey}` : carte détaillée par zone (V2). Si manquante, fallback panel local sur `/biome`.
- `anchors.world` : safeArea + anchors biomes.
- `anchors.biomes.{biomeId}` : safeArea + anchors zones pour le biome.
- `anchors.zones.{biomeId:zoneKey}` : safeArea + anchors blocs optionnels.

Exemple (pack-5e-mvp) :
```json
"maps": {
  "world": { "baseLayer": "base/map.svg", "width":1920, "height":1080 },
  "biomes": {
    "fr": { "baseLayer": "biomes/fr/map.svg", "width":1920, "height":1080 },
    "math": { "baseLayer": "biomes/math/map.svg", "width":1920, "height":1080 }
  }
},
"anchors": {
  "world": { "safeArea": {...}, "biomes": {...} },
  "biomes": { "fr": { "safeArea": {...}, "zones": {...} }, ... }
}
```

## Navigation
- WorldHub → clique sur un biome → route `/biome/:biomeId` (BiomeMapPage). Drawer legacy reste en fallback si aucune carte biome.
- BiomeMapPage affiche la carte du biome (si présente) avec zones cliquables + panel local (dock) pour explorer la zone/blocs sans drawer global.
- Retour monde : bouton “Retour au monde”.

## Fallbacks
- Pas de pack ou pas de `maps` : comportement legacy (drawer).
- Pas de map pour un biome : la tuile ouvre le drawer biome/zone legacy.
- Sur `/biome`, le drawer global n’est plus utilisé (panel local uniquement).

## Anti-régression “No drawer on /biome”
- Règle : sur `/biome/:biomeId`, aucune interaction (zone, PNJ, CTA, tag) ne doit déclencher le drawer global.
- Garde-fou : `isBiomeRouteFromWindow()` est vérifié avant toute ouverture du drawer global (WorldHub). Un log `GLOBAL DRAWER OPEN BLOCKED on /biome route` apparaît si cela se produit.
- Test rapide : aller sur `/biome/fr`, cliquer 3 zones + CTA panel + clic tag → panel local ou navigation `/theme/*` uniquement, jamais de drawer global.

## Debug
- `VITE_MAP_DEBUG=true` ou `?mapDebug=1` : affichage anchors (biomes/zones), drag, Copy JSON.

## QA (10 min)
- Clique biome → bascule sur `/biome/:biomeId`, baseLayer du biome visible.
- Zones ancrées visibles/cliquables sur la carte biome; panel local s’ouvre, pas de drawer global.
- CTA panel : reconstruction zone et session tag naviguent bien vers `/theme/*`.
- Retour monde fonctionne, routes legacy intactes.
- Debug mode montre anchors world/biome ; Copy JSON OK.
- Fallback : map biome manquante → drawer legacy possible, mais `/biome` reste utilisable avec panel local si besoin.
