# Coins et cosmétiques (V1)

## Modèle Firestore
- Doc `users/{uid}/meta/rewards` étendu : `coins` (nombre), `ownedCosmetics` (Record<id, true>), `equippedCosmetics` (`biomeMonumentSkin`, `zoneMonumentSkin`, `tileEffect`, `npcStyle`).
- Idempotence côté `rewardEvents` : `session_{id}` inclut `coinsEarned`, achats `purchase_{cosmeticId}`, bonus quotidien `daily_bonus_{dateKey}`.

## Gains de coins
- Session : `computeCoinsEarned` → `correctCount`. Ajouté dans `awardSessionRewards` (transaction + event `rewardEvents/{sessionId}`) : aucun double crédit si l’event existe déjà.
- Bonus quotidien : +10 coins quand les 3 quêtes sont complétées (`rewardEvents/daily_bonus_{dateKey}` dans `updateDailyProgress`).

## Catalogue V1 (src/game/cosmeticsCatalog.ts)
- Monuments biome (unlock niveau) : pierre (niv 3), lierre (niv 6), filets dorés (niv 10).
- Monuments zone : ardoise (niv 2), cuivre (niv 5), cristal (niv 8).
- Effets de tuile : halo azur (40 coins), étincelles (80 coins).
- Styles PNJ : forge (60 coins), scribe (unlock niv 7).
- Un item est owned si `ownedCosmetics[id] === true` **ou** niveau ≥ `unlockLevel`.

## Achat / équipement
- `purchaseCosmetic(uid, cosmeticId, store?)`
  - Vérifie le coût vs `coins`, no-op si déjà owned ou event `purchase_{id}` existant.
  - Débite une seule fois, enregistre `rewardEvents/purchase_{id}`.
- `equipCosmetic(uid, cosmeticId, store?)`
  - Vérifie propriété via `isCosmeticOwned`, remplit le slot (`equippedCosmetics`).
- UI : Drawer Atelier dans WorldHub, filtres (Tous/Monuments/Effets/PNJ), boutons Achat/Équiper, compteur coins dans le HUD.

## Intégration visuelle
- Classes appliquées via `equippedCosmetics` :
  - Monuments : `monument-skin--biome-skin-*` / `zone-skin-*` sur tuiles/summary Biome/Zone.
  - Effets de tuile : `tile-effect--tile-effect-*` sur les blocs (overlay glow/étincelles).
  - Styles PNJ : `npc-style--npc-style-*` sur cartes PNJ / quêtes.
- Variations CSS dans `src/styles/malocraft.css`, uniquement des gradients/patterns (pas d’assets).

## Ajouter un cosmétique
1) Déclarer l’item dans `src/game/cosmeticsCatalog.ts` (id unique, type, label, description, `costCoins` ou `unlockLevel`).
2) Ajouter une variante CSS si besoin (reuse des classes `monument-skin--{id}`, `tile-effect--{id}`, `npc-style--{id}`).
3) Vérifier que le slot (`equippedCosmetics`) existe ou en ajouter un nouveau avant usage en UI.
