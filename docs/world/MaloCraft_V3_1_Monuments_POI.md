# MaloCraft V3.1 — Monuments & POI

## Objectifs
- Passer de l’affichage en tuiles (V2.2) à un rendu “monument + POI” sur la ZoneMap.
- Limiter la densité des POI à 10 maximum tout en conservant la navigation /theme/*.
- Fallback strict sur les tuiles V2.2 si un asset manque ou si aucune ancre n’est disponible.

## Structure des assets
- Base pack : `/assets/graphic-packs/<packId>/`.
- Monuments par matière/zone : `monuments/<subject>/<zoneSlug>/monument_<state>.svg` (`locked` optionnel).
- POI génériques : `poi/poi_<state>.svg`.
- Les anchors du pack restent la source de vérité pour le placement.
- Slot dédié monument : réserver un emplacement visuel intégré dans le fond de carte (coin haut-gauche safe area, ~220px). La tuile monument est centrée sur ce slot et les POI sont décalés pour ne pas l’empiéter. Si le pack ne réserve pas ce slot, le monument se superposera aux POI : la génération du pack doit prévoir un espace clair (zone “plaza”) dans le décor de zone et une ancre monument cohérente avec cet espace.

## Rendu V3.1
- ZoneMonument cherche d’abord l’asset de l’état courant puis `monument_locked.svg`, sinon fallback ZoneTile V2.2.
- BlockPOI utilise `poi_<state>.svg`, sinon fallback BlockTile V2.2.
- Cache in-memory sur l’existence des assets pour éviter les requêtes répétées.
- Debug `?mapDebug=1` laisse apparaître les anchors bruts.

## Règles POI
- Priorité d’affichage : tags <50% maîtrise, puis 50-79%, puis tags récents (si dispo), sinon ordre naturel.
- Maximum 10 POI affichés sur la carte ; le reste est accessible via “Voir tous les blocs”.
- Placement uniquement si une ancre existe (sinon uniquement dans la liste).

## Accessibilité & motion
- Tous les éléments cliquables ont `aria-label` + focus visible.
- Animations et transitions coupées si `prefers-reduced-motion: reduce`.

## QA rapide
1) ZoneMap : monument visible + 10 POI max.  
2) Clic POI ⇒ démarre la session /theme/* OK.  
3) Bouton “Voir tous” ⇒ liste complète cliquable.  
4) Assets manquants ⇒ fallback V2.2 (pas de crash).  
5) Debug ?mapDebug=1 ⇒ anchors visibles.  
