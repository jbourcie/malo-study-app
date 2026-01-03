## MaloCraft V3.2.1 – Camera pan subtil

- Le conteneur de page (WorldHub, BiomeMap, ZoneMap) est animé via `PageTransition` : pan vers l’ancre cliquée + léger zoom/blur à l’entrée, pan inverse léger à la sortie. Aucun changement sur les tiles ou overlays.
- Données nav : `mc_nav_from`, `mc_nav_anchor` (x,y), `mc_nav_mapSize` (w,h) et timestamp `mc_nav_ts` (expire ~5s). Absence d’ancre = transition standard.
- Calcul pan : `computeCameraPan` (panFactor 0.12), clamp dynamique (80 desktop / 50 mobile). Fallback map size 1920x1080 si ancre sans mapSize.
- Anti double-clic : `useNavLock` (450ms) avant navigation map pour éviter les double taps.
- Reduced motion : pan/zoom/blur neutralisés (duration=0, opacity=1).

### QA rapide
1) Monde → biome : pan perceptible vers la tuile cliquée.  
2) Biome → zone : pan cohérent.  
3) Back : sortie inverse légère, pas de glitch.  
4) Refresh direct sur /biome ou /zone : pas de pan parasite (ts expiré).  
5) `?mapDebug=1` : overlays visibles et non animés.
