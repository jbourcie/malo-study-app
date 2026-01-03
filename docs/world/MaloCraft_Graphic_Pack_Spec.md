# MaloCraft — Graphic Pack Specification (V1)

## Objectif
Définir un pack graphique interchangeable pour un monde annuel.

---

## Structure

/assets/graphic-packs/{pack-id}/
- pack.json
- base/map.svg
- biomes/
- zones/
- monuments/
- effects/
- theme.css

---

## pack.json

```json
{
  "id": "pack-5e-kingdom",
  "label": "Royaume des Savoirs — 5e",
  "grade": "5e",
  "version": "1.0.0",
  "map": {
    "baseLayer": "base/map.svg",
    "width": 1920,
    "height": 1080
  },
  "css": [
    "theme.css",
    "effects/glow.css",
    "effects/weathered.css"
  ]
}
```

---

## CSS requis

### Biomes
- .biome-damaged
- .biome-improving
- .biome-rebuilt

### Zones
- .zone-intact
- .zone-rebuilding
- .zone-rebuilt
- .zone-degraded

### Générique
- .is-highlighted
- .is-weathered
- .is-locked

---

## Contraintes
- Pas de JS
- Pas de logique
- SVG ≤ 200 ko
- CSS scoped par pack

---

## Compatibilité
Le moteur UI est commun à toutes les années.
Seuls les assets changent.
