## Règle de slug MaloCraft (zones)

- Source unique : `slugifyZoneLabel` (`src/world/slug.ts`).
- Pipeline : trim → lowercase → NFD + suppression diacritiques → `&` → ` et ` → retirer apostrophes (`'`/`’`) → `-` → `_` → remplacer non `[a-z0-9]` par espace → compacter espaces → espaces → `_` → compacter `_` → trim `_` → fallback `"zone"` si vide.
- Utilisation : clés `maps.zones[...]`, `anchors.zones[...]`, chemins assets `zones/<subject>/<zoneSlug>/…`, `monuments/<subject>/<zoneSlug>/…`.
- Exemple attendus :
  - Grandeurs & mesures → grandeurs_et_mesures
  - Nombres & calcul → nombres_et_calcul
  - Histoire-Géographie → histoire_geographie
  - Méthodes → methodes
  - Repères → reperes
  - Géométrie → geometrie
  - Conjugaison → conjugaison
  - Compréhension → comprehension
  - L’école → lecole
  - C'est l’été → cest_lete
  - Proportionnalité / % → proportionnalite
  - Nombres: entiers → nombres_entiers
  - À 100% ! → a_100
  - ___ → zone

Note : si un pack utilise une autre forme de clé, c’est le pack qui doit être aligné avec cette règle (ne pas bifurquer dans le code).
