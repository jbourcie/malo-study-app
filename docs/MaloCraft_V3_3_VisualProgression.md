## MaloCraft V3.3 – Progression visuelle

États centralisés (`src/world/v3/progressionStates.ts`)
- Zones (`ZoneVisualState`): foundation → rebuilding → rebuilt → weathered (stale >14j). `locked` réservé si gating futur.
- Blocs (`BlockVisualState`): cracked (<40) → repairing (40..69) → repaired (70..84) → enhanced (≥85) + weathered si activité >14j avec maîtrise >0.
- Biomes (`BiomeVisualState`): low (<25) → mid (25..49) → high (50..79) → max (≥80) + weathered si activité >14j avec progrès >0.
- Seuils/timing : `BLOCK_THRESHOLDS`, `WEATHER_DAYS_DEFAULT=14` (tunable).

Mapping données → visuel
- ZoneMonument reçoit `state` issu de `computeZoneVisualState` (progress correct + dernière activité zone/blocks). Assets attendus : `monuments/<subject>/<zoneSlug>/monument_<state>.svg`, fallback ZoneTile si manquant. Badge 🛠️ sur rebuilding.
- BlockPOI reçoit `state` issu de `computeBlockVisualState` (mastery + lastActivity bloc). Assets attendus : `poi/poi_<state>.svg`, fallback BlockTile sinon.
- Biome : classe CSS `.mc-biome-state-{low|mid|high|max|weathered}` appliquée sur les conteneurs de cartes (teinte/saturation légère).

Conventions assets (fallback si absent)
- Monuments zones : foundation / rebuilding / rebuilt / weathered.
- POI génériques : cracked / repairing / repaired / enhanced / weathered.

QA checklist
1) Zone 0% → foundation visible.
2) Zone ~20% → rebuilding + badge chantier.
3) Zone 100% récent → rebuilt.
4) Zone 100% + dernière activité >14j → weathered.
5) POI changent d’aspect selon mastery (cracked→enhanced) + weathered si inactif.
6) Assets manquants → fallback V2.2/V3.1 (ZoneTile/BlockTile) sans crash.
7) ?mapDebug=1 + transitions camera pan (V3.2.1) restent OK.
