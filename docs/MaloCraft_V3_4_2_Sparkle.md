## MaloCraft V3.4.2 – Sparkle zone rebuilt

- Hook `useZoneRebuiltSparkle(zoneKey, isRebuilt)` (900ms) déclenche une fois lors du passage rebuilt, idempotent via `localStorage mc_zone_sparkled_<zoneKey>` (+ cache mémoire). `prefers-reduced-motion` désactive le sparkle.
- Overlays : tentative pack `monuments/<subject>/<zoneSlug>/sparkle.svg`, fallback `effects/sparkle.svg`, sinon CSS `mc-zone-sparkle--fallback`.
- Intégration : `ZoneMonument` et `ZoneTile` superposent l’overlay sans modifier le layout, synchronisé à `progressPct`/`state`.
- QA : 99→100 joue 1 fois, refresh rebuilt ne rejoue pas, appareil neuf rejoue, reduced-motion=off, `?mapDebug=1` inchangé.
