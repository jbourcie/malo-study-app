# Règles Firestore – Auth parent / enfant / admin

## Modèle de données
- `users/{uid}` : profil (role `child` | `parent` | `admin`, displayName, email, parents[], childrenIds[], timestamps).
- `pairingCodes/{code}` : code de rattachement généré côté enfant (`childUid`, `expiresAt` +10 min, `used`, `usedBy`, `consumedAt`).
- `familyLinks/{parentId}_{childId}` : lien parent ↔ enfant créé côté parent après saisie d’un code (`parentId`, `childId`, `pairingCode`, `createdAt`).
- `childRecoveryCodes/{code}` : code de reprise (secret 16–24 chars) qui mappe un enfant à son UID (`childUid`, `expiresAt`, `revoked`).

## Règles (firebase.rules.txt)
- Helpers :
  - `isParent()` inclut admin, `isAdmin()`, `isOwner(userId)`, `isLinkedParent(userId)` (via `familyLinks`).
  - `canReadUser` = owner ou parent lié ou admin. `canWriteVisibility` = owner ou parent lié ou admin.
- Collections globales (`subjects`, `themes`, `exercises`, `readings`, `questionPacks`, `questions`) :
  - Lecture : connecté.
  - Écriture : parent/admin. `questions` : lecture parent/admin ou publié.
- `pairingCodes` :
  - Création : enfant (UID = childUid, code 8 chars).  
  - Mise à jour : parent/admin uniquement si non utilisé, non expiré, `usedBy = request.auth.uid`.
- `familyLinks` :
  - Création : parent/admin sur `familyLinks/{parentId}_{childId}`.
  - Lecture : parent du lien, enfant lié ou admin.
- `childRecoveryCodes` :
  - Lecture : uniquement authentifié (anonyme suffit), pas de lecture publique/liste.
  - Création : enfant owner (UID == childUid), code long 16–24 chars, non révoqué, expirant ≤ 30j.
  - Mise à jour : enfant owner uniquement, pour révoquer (`revoked=true`) ou rafraîchir `expiresAt`.
  - Suppression : admin ou enfant owner.
- `users/{userId}` :
  - Lecture : owner, parent lié ou admin.
  - Création : owner.
  - Mise à jour : owner, admin, ou parent/admin qui s’ajoute dans `parents`.
- Sous-collections `attempts`, `attemptItems`, `stats`, `statsDays`, `tagProgress`, `progressSummary`, `meta`, `rewardEvents`, `inventory` :
  - Lecture : owner, parent lié, admin.
  - Écriture : owner ou admin (sauf visibilités).
- Sous-collections `visibilityThemes` / `visibilityExercises` :
  - Lecture : owner, parent lié, admin.
  - Écriture : owner, parent lié, admin (pour gérer les filtres parent).

## Flux attendus
1) Enfant : connexion auto (anonymous), création doc `users/{childUid}` role=child. Peut générer un code (8 chars, TTL 10 min) → `pairingCodes/{code}`.
2) Parent/Admin : connexion Google → doc `users/{uid}` role parent/admin. Saisie code :
   - Transaction : vérifie code actif, marque `usedBy`, crée `familyLinks/{parent_child}`, ajoute parent dans `users/{child}` (parents[]) et enfant dans `users/{parent}` (childrenIds[]).
3) Lecture données enfant (progression, daily, monde) : parent/admin autorisé uniquement si lien présent (ou admin).
4) Visibilité contenus : parent/admin peut écrire dans `visibilityThemes` / `visibilityExercises` d’un enfant lié.
5) Reprise de compte enfant (nouvel appareil) :
   - Connexion anonyme préalable → saisir le code de reprise (20 chars) dans “Reprendre ma partie”.
   - Lecture du doc `childRecoveryCodes/{code}` (auth requise), vérification `expiresAt` et `revoked != true`, puis connexion avec les credentials liés.
   - L’enfant peut régénérer son code : le nouveau est créé, l’ancien est marqué `revoked=true`.

## Note sur le credential technique de reprise
- Pour garantir que la reprise retombe sur le même UID enfant, on associe un credential email/password “technique” au compte anonyme (`child-{uid}@child.malocraft` + code).  
- Aucun mot de passe “utilisateur” n’est stocké ni demandé : il sert uniquement à réutiliser l’UID via `signInWithEmailAndPassword`.  
- Pas de rotation auto pour éviter les 400 / états auth instables. La sécurité repose sur : code long, TTL/ révocation, lecture auth-only.  
- Test manuel conseillé : génère un code, déconnecte, “Je suis un enfant” → anonyme → “Reprendre ma partie” avec le code → on retrouve le même monde/UID. Régénère ensuite : l’ancien doit être refusé, le nouveau accepté.

## Couverture tests
- `tests/auth/pairing.test.ts` :
  - Normalisation / génération de code (longueur, charset).
  - Validation expiration / usage.
  - Rattachement in-memory : un code ne peut être consommé qu’une seule fois et crée le lien parent_enfant.
