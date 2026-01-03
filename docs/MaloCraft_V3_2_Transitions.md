## MaloCraft V3.2 – Transitions multi-échelle

- **Animé** : conteneur des pages WorldHub, BiomeMap, ZoneMap via `PageTransition` (fade + léger zoom, 320ms, easeOut). L’offset de départ suit l’ancre cliquée quand elle est connue.
- **Non animé** : logique métier, overlays debug (`mapDebug` / `MapAnchorsDebugLayer`), couches panels/drawers internes. Les fallbacks sans pack/anchors restent inchangés.
- **Reduced motion** : si `prefers-reduced-motion` est actif, transitions neutralisées (opacity 1, scale 1, durée 0, pas de blur ni d’offset).

### Zoom depuis anchor
- À chaque navigation WorldHub → biome ou biome → zone, on stocke dans `sessionStorage` : `mc_nav_from` (`"world"` ou `"biome"`) et `mc_nav_anchor` `{ x, y, mapWidth, mapHeight }` quand dispo.
- L’entrée de page lit/consomme cette valeur pour démarrer avec un petit translate vers le centre depuis l’ancre. Si aucune ancre ou map size n’est dispo, on retombe sur la transition standard.
- Pour désactiver le zoom : vider ces clés dans l’onglet Application du navigateur ou forcer `prefers-reduced-motion`.

### QA rapide
1) Monde → biome : fade+zoom OK, offset si ancre présente.  
2) Biome → zone : fade+zoom OK, offset si ancre présente.  
3) Back (biome → monde, zone → biome) : transition fluide (pas d’accrocs de state).  
4) `prefers-reduced-motion` : transitions quasi instantanées (pas de zoom/blur).  
5) `?mapDebug=1` : overlays debug affichés/éditables normalement.
