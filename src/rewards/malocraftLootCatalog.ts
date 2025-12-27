import type { BiomeId } from '../game/biomeCatalog'

export type LootRarity = 'common' | 'rare' | 'epic'
export type LootType = 'sticker' | 'fragment' | 'trophy' | 'avatar'

export type MalocraftLoot = {
  id: string
  type: LootType
  rarity: LootRarity
  title: string
  description: string
  icon: string
  biomeId?: BiomeId
}

export const MALLOOT_CATALOG: MalocraftLoot[] = [
  // Stickers communs (par biome)
  { id: 'sticker_foret_feuille', type: 'sticker', rarity: 'common', title: 'Feuille de la Forêt', description: 'Un souvenir de la Forêt de la Langue.', icon: '🍃', biomeId: 'biome_fr_foret_langue' },
  { id: 'sticker_foret_ecorce', type: 'sticker', rarity: 'common', title: 'Écorce runique', description: 'Rune gravée en français.', icon: '🪵', biomeId: 'biome_fr_foret_langue' },
  { id: 'sticker_mines_gemme', type: 'sticker', rarity: 'common', title: 'Gemme des Mines', description: 'Fragment mathématique scintillant.', icon: '💎', biomeId: 'biome_math_mines' },
  { id: 'sticker_mines_pelle', type: 'sticker', rarity: 'common', title: 'Pelle robuste', description: 'Pour creuser des nombres.', icon: '🛠️', biomeId: 'biome_math_mines' },
  { id: 'sticker_en_drapeau', type: 'sticker', rarity: 'common', title: 'Village Anglais', description: 'Blason du village.', icon: '🏴', biomeId: 'biome_en_village' },
  { id: 'sticker_en_thatch', type: 'sticker', rarity: 'common', title: 'Chaumière cosy', description: 'Toit de paille du village.', icon: '🏡', biomeId: 'biome_en_village' },
  { id: 'sticker_es_guitarra', type: 'sticker', rarity: 'common', title: 'Guitarra', description: 'Cordes vibrantes d’Espagne.', icon: '🎸', biomeId: 'biome_es_village' },
  { id: 'sticker_es_fiesta', type: 'sticker', rarity: 'common', title: 'Fiesta', description: 'Confettis du village espagnol.', icon: '🎊', biomeId: 'biome_es_village' },
  { id: 'sticker_hist_boussole', type: 'sticker', rarity: 'common', title: 'Boussole des Plaines', description: 'Toujours orienté.', icon: '🧭', biomeId: 'biome_hist_plaines' },
  { id: 'sticker_hist_parchemin', type: 'sticker', rarity: 'common', title: 'Parchemin', description: 'Repère historique clé.', icon: '📜', biomeId: 'biome_hist_plaines' },
  { id: 'sticker_meta_pickaxe', type: 'sticker', rarity: 'common', title: 'Pioche Malo', description: 'Outil fidèle.', icon: '⛏️' },
  { id: 'sticker_meta_tocha', type: 'sticker', rarity: 'common', title: 'Torche', description: 'Éclaire les donjons.', icon: '🔥' },
  { id: 'sticker_meta_map', type: 'sticker', rarity: 'common', title: 'Carte', description: 'Toujours savoir où aller.', icon: '🗺️' },
  { id: 'sticker_meta_marteau', type: 'sticker', rarity: 'common', title: 'Marteau', description: 'Réparer les blocs fissurés.', icon: '🔨' },
  { id: 'sticker_meta_sac', type: 'sticker', rarity: 'common', title: 'Sac à dos', description: 'Tout emporter.', icon: '🎒' },

  // Fragments rares
  { id: 'fragment_langue', type: 'fragment', rarity: 'rare', title: 'Fragment Linguistique', description: 'Augmente la brillance des blocs de langue.', icon: '💠', biomeId: 'biome_fr_foret_langue' },
  { id: 'fragment_math', type: 'fragment', rarity: 'rare', title: 'Fragment Numérique', description: 'Pure énergie mathématique.', icon: '🔷', biomeId: 'biome_math_mines' },
  { id: 'fragment_en', type: 'fragment', rarity: 'rare', title: 'Fragment Anglais', description: 'Accent parfait.', icon: '🔹', biomeId: 'biome_en_village' },
  { id: 'fragment_es', type: 'fragment', rarity: 'rare', title: 'Fragment Espagnol', description: 'Rythme et couleur.', icon: '🟥', biomeId: 'biome_es_village' },
  { id: 'fragment_hist', type: 'fragment', rarity: 'rare', title: 'Fragment Chronique', description: 'Temps et cartes fusionnés.', icon: '🟫', biomeId: 'biome_hist_plaines' },
  { id: 'fragment_meta_focus', type: 'fragment', rarity: 'rare', title: 'Fragment de Focalisation', description: 'Rend les sessions plus précises.', icon: '🎯' },
  { id: 'fragment_meta_vitesse', type: 'fragment', rarity: 'rare', title: 'Fragment de Vitesse', description: 'Accélère tes réponses.', icon: '💨' },
  { id: 'fragment_meta_chance', type: 'fragment', rarity: 'rare', title: 'Fragment de Chance', description: 'Boost de loot.', icon: '🍀' },

  // Trophées (milestones)
  { id: 'trophy_foret_bronze', type: 'trophy', rarity: 'rare', title: 'Trophée Forêt Bronze', description: '3 blocs maîtrisés en Forêt.', icon: '🥉', biomeId: 'biome_fr_foret_langue' },
  { id: 'trophy_foret_argent', type: 'trophy', rarity: 'rare', title: 'Trophée Forêt Argent', description: '6 blocs maîtrisés en Forêt.', icon: '🥈', biomeId: 'biome_fr_foret_langue' },
  { id: 'trophy_foret_or', type: 'trophy', rarity: 'epic', title: 'Trophée Forêt Or', description: '10 blocs maîtrisés en Forêt.', icon: '🥇', biomeId: 'biome_fr_foret_langue' },
  { id: 'trophy_mines_or', type: 'trophy', rarity: 'epic', title: 'Trophée Mines Or', description: '10 blocs maîtrisés dans les Mines.', icon: '⛏️', biomeId: 'biome_math_mines' },
  { id: 'trophy_plaines_or', type: 'trophy', rarity: 'epic', title: 'Trophée Plaines Or', description: '10 blocs maîtrisés dans les Plaines.', icon: '🏅', biomeId: 'biome_hist_plaines' },

  // Avatars / équipements épiques
  { id: 'avatar_malo_explorateur', type: 'avatar', rarity: 'epic', title: 'Malo Explorateur', description: 'Héros des biomes.', icon: '🧭' },
  { id: 'avatar_malo_mineur', type: 'avatar', rarity: 'epic', title: 'Malo Mineur', description: 'Spécialiste des nombres.', icon: '⛏️' },
  { id: 'avatar_malo_mage', type: 'avatar', rarity: 'epic', title: 'Malo Mage', description: 'Maîtrise magique.', icon: '🪄' },
  { id: 'avatar_malo_architecte', type: 'avatar', rarity: 'epic', title: 'Malo Architecte', description: 'Bâtisseur de blocs.', icon: '🏗️' },
]
