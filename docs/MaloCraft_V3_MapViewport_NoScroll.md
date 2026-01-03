# MaloCraft V3 — Map viewport sans scroll de page

## Objectif
Conserver une expérience "caméra fixe" lors des navigations monde → biome → zone : pas de saut en haut de page, topbar fixe, viewport stable.

## Points vérifiés
- TopBar en `position: fixed` (hauteur ~72px avec padding) ; viewport map fixé `top:72px; left:0; right:0; bottom:0`.
- Routes carte utilisent `AppShellMap` : `/home`, `/hub`, `/biome/:biomeId`, `/zone/:biomeId/:zoneKey`.
- `history.scrollRestoration = 'manual'` (hook global) pour éviter la restauration automatique du scroll.
- `AnimatePresence` avec `initial={false}` et `PageTransition` limité au contenu de la map (le shell ne remonte pas/focus ne bouge pas).
- Navigation monde → biome → zone : la carte reste au même emplacement écran, aucun scroll window.
- Back navigateur : retour sans jump ; viewport fixe.
- `?mapDebug=1` : overlays et interactions inchangés.
- Mobile : topbar fixe, viewport sans scroll parasite.

## Mode opératoire de test manuel
1. Lancer l’app, ouvrir `/hub` (ou `/home`) et faire défiler la page : la window ne scroll pas, seuls les contenus internes peuvent scroller au besoin.
2. Cliquer un biome (avec et sans `?mapDebug=1`) → `/biome/:id` : le viewport reste en place, pas de saut.
3. Depuis la page biome, cliquer une zone → `/zone/:biomeId/:zoneKey` : même comportement.
4. Utiliser le bouton Back : retour aux écrans précédents sans repositionnement haut de page.
5. Mobile/étroit : topbar toujours visible, viewport occupant le reste de l’écran.
