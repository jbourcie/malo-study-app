## Modèle Firestore
- Collection `questionReports/{reportId}` avec `reportId = ${questionId}_${uid}` (anti-dup).
- Champs : `questionId`, `uid`, `createdAt`, `reason` (`wrong_answer|ambiguous|typo|too_hard|off_topic|other`), `message?` (<=240), `context` `{ setId?, primaryTag?, blockId?, sessionId?, grade? }`, `status` (`open|triaged|resolved`), `admin` `{ notes?, resolvedBy?, resolvedAt? }`.
- AttemptItems écrits avec `questionId` en plus de `exerciseId` pour faciliter les agrégations.

## Règles Firestore
```
match /questionReports/{reportId} {
  allow create: if signedIn()
    && request.auth.uid == request.resource.data.uid
    && reportId == (request.resource.data.questionId + '_' + request.auth.uid)
    && request.resource.data.status == 'open'
    && request.resource.data.reason in ['wrong_answer','ambiguous','typo','too_hard','off_topic','other']
    && (!('message' in request.resource.data) || request.resource.data.message.size() <= 240);
  allow read, list, update, delete: if isAdmin();
}
```

## Parcours enfant (ThemeSession)
- Bouton « Signaler » sur chaque question dans l’écran de correction.
- Drawer : choix de raison (radio) + commentaire optionnel (<=240).
- Envoi : création `questionReports/{questionId_uid}` avec contexte (setId/tag/bloc/sessionId/grade).
- Anti-spam : idempotence côté client + `reportId` unique. Si la transaction renvoie `already-exists` → affiche « Déjà signalée ✓ ».
- Erreur générique : toast local, n’interrompt pas la session.

## Parcours admin
- Nouvelle page `/admin/reports` (TopBar) filtrable par statut, raison, tag, bloc, questionId, période (7/30 jours/all). Liste limitée aux derniers reports chargés (400 par défaut).
- Actions par ligne : focus stats, lien vers modération question, `Trier` → status `triaged`, `Résoudre` (note optionnelle) → status `resolved`.
- Panneau stats question : `reports` (count questionReports), `attempts`/`wrong` + `wrongRate` via `collectionGroup(attemptItems)` agrégé.
- Top 20 problématiques : groupement client des derniers reports chargés.
- Dans `/admin/questions` : bouton « Voir reports » vers la page reports, compteur `Reports` chargé à la demande.

## Stats / interprétation
- Reports = volume de signalements sur la question.
- Attempts = total d’essais (collectionGroup `attemptItems`, filtre questionId/exerciseId). Wrong = attempts avec `correct == false`. WrongRate = `wrong/attempts`.
- Agrégations effectuées à la demande (pas de compteurs persistés).
- Droits : `isAdmin` accepte soit le champ `role: "admin"` dans `users/{uid}`, soit un custom claim `admin: true/"true"/1/"1"` ou `role: "admin"` (évite les 403 sur les agrégations si le doc user admin est absent ou si le claim est typé différemment).

## Limites / notes
- Pas de Cloud Functions : agrégations déclenchées côté client admin uniquement, sur les 400 derniers reports pour le top.
- Fallback attempts : si `questionId` absent sur anciens items, requête sur `exerciseId`.
- Lecture des reports strictement admin (enfant ne lit pas la collection).
