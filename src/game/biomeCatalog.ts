// src/game/biomeCatalog.ts
// MaloCraft — Catalogue des biomes (zones)
// Couche UI uniquement : ne change pas Firestore ni les IDs de tags.

import type { SubjectId } from "../taxonomy/tagCatalog";

export type BiomeId =
  | "biome_fr_foret_langue"
  | "biome_math_mines"
  | "biome_en_village"
  | "biome_es_village"
  | "biome_hist_plaines";

export type BiomeDef = {
  id: BiomeId;
  name: string;          // FR
  description: string;   // FR, 1 phrase
  icon: string;          // emoji (peut devenir SVG plus tard)
  subject: SubjectId;    // matière associée
  order: number;         // tri (plus petit = plus haut)
};

export const BIOME_CATALOG: Record<BiomeId, BiomeDef> = {
  biome_fr_foret_langue: {
    id: "biome_fr_foret_langue",
    name: "Forêt de la Langue",
    description: "Lecture, grammaire, conjugaison : renforce tes blocs de français.",
    icon: "🌲",
    subject: "fr",
    order: 10,
  },
  biome_math_mines: {
    id: "biome_math_mines",
    name: "Mines des Nombres",
    description: "Fractions, calcul et problèmes : mine des ressources de maths.",
    icon: "⛏️",
    subject: "math",
    order: 20,
  },
  biome_en_village: {
    id: "biome_en_village",
    name: "Village Anglais",
    description: "Vocabulaire et grammaire : parle et comprends l’anglais.",
    icon: "🏘️",
    subject: "en",
    order: 30,
  },
  biome_es_village: {
    id: "biome_es_village",
    name: "Village Espagnol",
    description: "Vocabulaire et grammaire : progresse en espagnol.",
    icon: "🏡",
    subject: "es",
    order: 40,
  },
  biome_hist_plaines: {
    id: "biome_hist_plaines",
    name: "Plaines des Repères",
    description: "Repères, cartes et chronologie : explore l’histoire-géo.",
    icon: "🗺️",
    subject: "hist",
    order: 50,
  },
};

export const BIOMES_SORTED: BiomeDef[] = Object.values(BIOME_CATALOG).sort(
  (a, b) => a.order - b.order
);

// Helpers

export function getBiome(id: BiomeId): BiomeDef {
  return BIOME_CATALOG[id];
}

export function subjectToBiomeId(subject: SubjectId): BiomeId {
  switch (subject) {
    case "math":
      return "biome_math_mines";
    case "en":
      return "biome_en_village";
    case "es":
      return "biome_es_village";
    case "hist":
      return "biome_hist_plaines";
    case "fr":
    default:
      return "biome_fr_foret_langue";
  }
}
