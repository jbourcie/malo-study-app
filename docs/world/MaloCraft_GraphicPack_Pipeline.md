# MaloCraft — Pipeline Graphic Pack (MVP)

## Installer un pack
- Déposer le dossier du pack dans `public/assets/graphic-packs/{pack-id}/`.
- Le manifeste doit être `pack.json` à la racine du pack (voir `docs/world/MaloCraft_Graphic_Pack_Spec.md`).
- Les assets attendus pour le MVP : `base/map.svg`, `theme.css`, les effets éventuels dans `effects/`.
- Exemple pack par défaut : `public/assets/graphic-packs/pack-5e-mvp/pack.json`.

## Sélection du pack
- Par défaut, le WorldHub charge `/assets/graphic-packs/pack-5e-mvp/pack.json`.
- Pour changer de pack, définir une variable d’environnement Vite `VITE_GRAPHIC_PACK` avec l’URL/chemin du manifeste (ex: `.env.local` → `VITE_GRAPHIC_PACK=/assets/graphic-packs/mon-pack/pack.json`).
- Aucun changement de route : les sessions restent en `/theme/*`.

## Structure multi-échelle (V1.6+)
- Maps :
  ```json
  "maps": {
    "world": { "baseLayer": "base/map.svg", "width":1920, "height":1080 },
    "biomes": {
      "fr": { "baseLayer": "biomes/fr/map.svg", "width":1920, "height":1080 },
      "math": { "baseLayer": "biomes/math/map.svg", "width":1920, "height":1080 }
    }
  }
  ```
- Anchors :
  ```json
  "anchors": {
    "world": {
      "safeArea": { "left": 80, "top": 70, "right": 80, "bottom": 90 },
      "biomes": { "fr": { "x": 430, "y": 290 }, ... }
    },
    "biomes": {
      "fr": {
        "safeArea": { "left": 60, "top": 60, "right": 60, "bottom": 60 },
        "zones": { "Compréhension": { "x": 360, "y": 230 }, ... }
      }
    }
  }
  ```
- Backward compat : si `maps` absent → utilisation de `map` (legacy). Si une map biome manque → fallback drawers.

## Fallback
- Si le manifeste est manquant/invalidé ou si le fetch échoue, le WorldHub reste fonctionnel avec la grille/tuiles actuelles.
- Les erreurs de pack sont loggées en console (dev) mais ne bloquent pas l’UX.
- Les CSS injectées sont nettoyées lors d’un changement de pack ou de l’unmount.

## Checklist QA (5 minutes)
- Le pack charge sans erreur (console propre).
- La baseLayer du pack est visible en fond du WorldHub.
- Les classes CSS du pack modifient bien l’apparence d’une tuile biome et d’une zone.
- Le highlight PNJ (`.is-highlighted`) est visible sur une tuile ciblée.
- La dégradation (`.is-weathered`) est visible sur une tuile patinée.
- Forcer une mauvaise URL de pack → retour au fallback sans crash ni écran vide.
