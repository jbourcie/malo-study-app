export type CollectibleType = 'sticker' | 'avatar'
export type CollectibleRarity = 'common' | 'rare' | 'epic'

export type CollectibleDef = {
  id: string
  type: CollectibleType
  title: string
  description: string
  rarity: CollectibleRarity
  icon: string
}

export const COLLECTIBLES: CollectibleDef[] = [
  // Stickers (common)
  { id: 'sticker_star', type: 'sticker', title: 'Étoile', description: 'Une étoile brillante', rarity: 'common', icon: '⭐️' },
  { id: 'sticker_book', type: 'sticker', title: 'Livre', description: 'Pour les champions de lecture', rarity: 'common', icon: '📘' },
  { id: 'sticker_rocket', type: 'sticker', title: 'Fusée', description: 'Décollage vers la réussite', rarity: 'common', icon: '🚀' },
  { id: 'sticker_pencil', type: 'sticker', title: 'Crayon', description: 'Toujours prêt à écrire', rarity: 'common', icon: '✏️' },
  { id: 'sticker_thumbs', type: 'sticker', title: 'Bravo', description: 'Pouce en l’air', rarity: 'common', icon: '👍' },
  { id: 'sticker_smile', type: 'sticker', title: 'Sourire', description: 'Bonne humeur garantie', rarity: 'common', icon: '😊' },
  { id: 'sticker_music', type: 'sticker', title: 'Musique', description: 'Rythme et révisions', rarity: 'common', icon: '🎵' },
  { id: 'sticker_leaf', type: 'sticker', title: 'Feuille', description: 'Nature et calme', rarity: 'common', icon: '🍃' },

  // Stickers (rare)
  { id: 'sticker_dragon', type: 'sticker', title: 'Dragon', description: 'Gardien des savoirs', rarity: 'rare', icon: '🐉' },
  { id: 'sticker_moon', type: 'sticker', title: 'Lune', description: 'Veille d’étude', rarity: 'rare', icon: '🌙' },
  { id: 'sticker_robot', type: 'sticker', title: 'Robot', description: 'Logique au top', rarity: 'rare', icon: '🤖' },
  { id: 'sticker_trophy', type: 'sticker', title: 'Trophée', description: 'Petite victoire', rarity: 'rare', icon: '🏆' },
  { id: 'sticker_paint', type: 'sticker', title: 'Palette', description: 'Créativité', rarity: 'rare', icon: '🎨' },
  { id: 'sticker_comet', type: 'sticker', title: 'Comète', description: 'Visée étoilée', rarity: 'rare', icon: '☄️' },
  { id: 'sticker_camera', type: 'sticker', title: 'Caméra', description: 'Souvenir de réussite', rarity: 'rare', icon: '📷' },
  { id: 'sticker_ship', type: 'sticker', title: 'Navire', description: 'Cap sur le savoir', rarity: 'rare', icon: '⛵️' },

  // Stickers (epic)
  { id: 'sticker_crown', type: 'sticker', title: 'Couronne', description: 'Roi/Reine des révisions', rarity: 'epic', icon: '👑' },
  { id: 'sticker_phoenix', type: 'sticker', title: 'Phénix', description: 'Toujours se relever', rarity: 'epic', icon: '🦅' },
  { id: 'sticker_unicorn', type: 'sticker', title: 'Licorne', description: 'Magie de la réussite', rarity: 'epic', icon: '🦄' },
  { id: 'sticker_saturn', type: 'sticker', title: 'Saturne', description: 'Orbitant autour du savoir', rarity: 'epic', icon: '🪐' },
  { id: 'sticker_mountain', type: 'sticker', title: 'Montagne', description: 'Sommet atteint', rarity: 'epic', icon: '🏔️' },
  { id: 'sticker_aurora', type: 'sticker', title: 'Aurore', description: 'Lumière des idées', rarity: 'epic', icon: '🌌' },
  { id: 'sticker_magic', type: 'sticker', title: 'Magicien', description: 'Tour de maîtrise', rarity: 'epic', icon: '🧙‍♂️' },
  { id: 'sticker_dragon_gold', type: 'sticker', title: 'Dragon doré', description: 'Gloire ultime', rarity: 'epic', icon: '🐲' },

  // Avatars
  { id: 'avatar_basic_boy', type: 'avatar', title: 'Aventurier', description: 'Prêt à apprendre', rarity: 'common', icon: '🧒' },
  { id: 'avatar_basic_girl', type: 'avatar', title: 'Exploratrice', description: 'Curieuse et motivée', rarity: 'common', icon: '👧' },
  { id: 'avatar_scientist', type: 'avatar', title: 'Scientifique', description: 'Fan d’expériences', rarity: 'rare', icon: '🧑‍🔬' },
  { id: 'avatar_astronaut', type: 'avatar', title: 'Astronaute', description: 'Toujours plus haut', rarity: 'rare', icon: '🧑‍🚀' },
  { id: 'avatar_artist', type: 'avatar', title: 'Artiste', description: 'Créativité au max', rarity: 'common', icon: '🧑‍🎨' },
  { id: 'avatar_knight', type: 'avatar', title: 'Chevalier', description: 'Protège ses progrès', rarity: 'rare', icon: '🛡️' },
  { id: 'avatar_ninja', type: 'avatar', title: 'Ninja', description: 'Rapide et précis', rarity: 'epic', icon: '🥷' },
  { id: 'avatar_robot', type: 'avatar', title: 'Robot', description: 'Logique imparable', rarity: 'rare', icon: '🤖' },
  { id: 'avatar_dragon_tamer', type: 'avatar', title: 'Dompte-dragon', description: 'Maîtrise totale', rarity: 'epic', icon: '🐉' },
  { id: 'avatar_pirate', type: 'avatar', title: 'Pirate', description: 'Cap sur les objectifs', rarity: 'common', icon: '🏴‍☠️' },
  { id: 'avatar_superhero', type: 'avatar', title: 'Héros', description: 'Sauveur des devoirs', rarity: 'epic', icon: '🦸‍♂️' },
  { id: 'avatar_bard', type: 'avatar', title: 'Barde', description: 'Chante ses progrès', rarity: 'rare', icon: '🎸' },
]
