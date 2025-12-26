import { rollCollectible } from './collectibles'
import { COLLECTIBLES } from './collectiblesCatalog'

// Tests légers (hors runner) pour valider la logique de tirage.
const first = COLLECTIBLES[0]?.id
const second = COLLECTIBLES[1]?.id

if (first && second) {
  const owned = [first]
  const picked = rollCollectible(owned, { rng: () => 0.01 })
  console.assert(picked !== null, 'Un tirage doit renvoyer un collectible disponible')
  console.assert(picked !== first, 'Le tirage ne doit pas renvoyer un élément déjà possédé')
}

const allOwned = COLLECTIBLES.map(c => c.id)
const none = rollCollectible(allOwned, { rng: () => 0.5 })
console.assert(none === null, 'Lorsque tout est possédé, le tirage retourne null')

