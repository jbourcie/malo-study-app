# MaloCraft — Format technique Overlay Map (V1)

## Objectif
Définir un format déclaratif pour représenter une carte du monde pédagogique
indépendante de la logique métier et pilotée par l’état de progression.

Le format permet :
- le chargement de mondes annuels (6e → 3e),
- la visualisation des biomes (matières) et zones (sous-thèmes),
- l’application d’états visuels selon la progression pédagogique.

---

## Principe fondamental
La map ne connaît aucune règle pédagogique.
Elle reçoit uniquement :
- des identifiants (biomeId, zoneId),
- des états calculés ailleurs (progress, state).

---

## WorldMapConfig

```ts
WorldMapConfig {
  id: string
  grade: "6e" | "5e" | "4e" | "3e"
  label: string
  baseLayer: BaseLayerConfig
  biomes: BiomeMapConfig[]
}
```

---

## BaseLayerConfig

```ts
BaseLayerConfig {
  type: "image" | "svg"
  src: string
  aspectRatio: "16:9"
  width: number
  height: number
  padding?: number
}
```

---

## BiomeMapConfig

```ts
BiomeMapConfig {
  biomeId: string
  subject: string
  label: string
  anchor: AnchorConfig
  monument: MonumentConfig
  zones: ZoneMapConfig[]
}
```

---

## ZoneMapConfig

```ts
ZoneMapConfig {
  zoneId: string
  themeId: string
  label: string
  anchor: AnchorConfig
  monument: MonumentConfig
}
```

---

## AnchorConfig

```ts
AnchorConfig {
  x: number
  y: number
  radius?: number
}
```

---

## MonumentConfig

```ts
MonumentConfig {
  id: string
  type: "biome" | "zone"
  states: MonumentStateConfig[]
}
```

```ts
MonumentStateConfig {
  state: string
  className: string
}
```

---

## États visuels standards

### ZoneState
- intact
- rebuilding
- rebuilt
- degraded

### BiomeState
- locked
- damaged
- improving
- rebuilt

---

## Dégradation
La dégradation visuelle est appliquée par le moteur d’affichage
si aucune activité n’est détectée depuis 14 jours.

---

## Navigation
- clic biome → ouverture BiomeDrawer
- clic zone → ouverture ZoneDrawer
- CTA PNJ → ouverture ciblée directe

---

## Règles
- Aucun calcul pédagogique dans la map
- Aucun accès Firestore depuis la map
- Aucun état stocké dans le pack graphique
