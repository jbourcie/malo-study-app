## Format QuestionPackV1

- Fichier JSON avec `{ pack: PackMetaV1, questions: QuestionV1[] }`.
- `pack` requis : `schemaVersion: 1`, `taxonomyVersion` (ex: `"5e-1.0"`), `setId` (id unique du pack), `grade`, `lang`.  
  - `primaryTag` requis si toutes les questions partagent ce tag (sinon chaque question doit définir son `primaryTag`).  
  - `blockId` facultatif (id “jeu”, ex: `block_coal_01`).  
  - `lesson` (markdown) et `lessonTitle` optionnels mais recommandés (rappel affiché côté enfant).
- `question` requis : `schemaVersion: 1`, `taxonomyVersion` (doit être identique à `pack.taxonomyVersion`), `id`, `blockId` (id “jeu”, ex: `block_coal_01`), `grade`, `lang`, `primaryTag` (tag taxonomie, ex: `fr_grammaire_fonction_cod`), `type` (`MCQ` | `FILL_BLANK` | `TRUE_FALSE` | `ERROR_SPOTTING`), `difficulty` (1-5), `statement`, `answer`, `quality.status`.
- Règles métier :  
  - `secondaryTags` optionnels, `metaTags` optionnels mais doivent commencer par `meta_`.  
  - `lessonRef` optionnel (ancre dans la leçon, ex: `cod_definition`, à placer sur un titre avec `{#cod_definition}`).  
  - `type === "MCQ"` ⇒ `choices` array obligatoire et `answer ∈ choices`.  
  - `type === "TRUE_FALSE"` ⇒ `answer` vaut `"true"` ou `"false"`.  
  - `type === "FILL_BLANK"` ⇒ `choices` peut être `null`.  
  - `quality.status` est forcé à `draft` à l’import.  
  - Publication : `explanation` doit être fournie (≥ 20 caractères) ; `commonMistake` recommandé.

Exemple minimal :

```json
{
  "pack": {
    "schemaVersion": 1,
    "taxonomyVersion": "5e-1.0",
    "setId": "fr_cod_v1",
    "grade": "5e",
    "lang": "fr",
    "primaryTag": "fr_grammaire_fonction_cod",
    "blockId": "block_coal_01",
    "lessonTitle": "Rappel COD",
    "lesson": "Le COD répond à *quoi ?* après le verbe."
  },
  "questions": [
    {
      "schemaVersion": 1,
      "taxonomyVersion": "5e-1.0",
      "id": "fr_cod_q1",
      "blockId": "block_coal_01",
      "grade": "5e",
      "lang": "fr",
      "primaryTag": "fr_grammaire_fonction_cod",
      "type": "MCQ",
      "difficulty": 2,
      "statement": "Quel est le COD ?",
      "choices": ["Paul", "mange", "une pomme"],
      "answer": "une pomme",
      "lessonRef": "cod_definition",
      "quality": { "status": "draft" }
    }
  ]
}
```

## Importer un pack

- UI : `/admin/import` (parent ou `VITE_DEV_ADMIN=true`). Drag & drop ou input fichier, validation intégrée, option dry-run. Les questions sont écrites en `draft` dans `questionPacks/{setId}` et `questions/{questionId}` avec `setId` + timestamps.
- Script Node : `npx ts-node scripts/importQuestionPack.ts --file ./packs/mon_pack.json [--dry-run]`.  
  - Nécessite `firebase-admin` avec un compte de service : `GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json`.  
  - Ne fait rien en dry-run, sinon upsert le pack et les questions en `draft`.
  - Le pack stocke aussi `schemaVersion`, `taxonomyVersion`, `lesson`, `lessonTitle`. Les questions importées ont `quality.review` initialisé et `deletedAt/deletedBy` à `null`.

## Workflow de modération

- UI : `/admin/questions` (filtre statut/tag/setId, recherche texte).  
- Actions : édition des champs (statement, choices, answer, explication, tags, difficulty), `Save`, `Mark reviewed`, `Publish` (status=published, decision=approved), `Reject` (notes obligatoires), `Archive`, `Delete`. Historique affiché (`quality.history`).  
- Delete = soft delete : `quality.deletedAt`, `quality.deletedBy`, status bascule en `archived`, entrée dans `quality.history`. Affichage masqué par défaut (`Afficher supprimées`).  
- Hard delete réservé au DEV (`VITE_DEV_ADMIN=true`).  
- Nettoyage legacy : section en bas pour supprimer les anciennes questions (collection `exercises`) par tag.

Statuts : `draft` → `reviewed` → `published` → (`rejected` ou `archived`). L’app enfant ne lit que les `published`.

## Consommation côté enfant

- Les requêtes de jeu utilisent désormais uniquement `questions` où `quality.status == "published"` et `quality.deletedAt == null`. Si aucun résultat, l’UI affiche un message de fallback sans crash.
- Si le pack contient une leçon (`lesson`/`lessonTitle`), un rappel est affiché avant la session. `lessonRef` peut être utilisé pour contextualiser la section de la leçon.

## Firestore

- Collections :  
  - `questionPacks/{setId}` : méta pack (`setId`, `grade`, `lang`, `primaryTag`..., `totalQuestions`, `createdAt`, `updatedAt`).  
  - `questions/{questionId}` : question complète + `setId`, `quality.status`, `quality.review`, `quality.history`, `createdAt`, `updatedAt`.
- Index recommandés :  
  - `questions` : composite (`quality.status`, `primaryTag`, `difficulty`).  
  - `questions` : composite (`blockId`, `quality.status`).  
  - `questions` : composite (`grade`, `quality.status`, `primaryTag`).

## Sécurité & rôles

- Firestore rules : enfants lisent uniquement les questions avec `quality.status == "published"`, les parents/admin peuvent tout lire/écrire. Les utilisateurs non authentifiés ne peuvent pas écrire.  
- Pas de rôle admin dédié pour l’instant : le rôle `parent` fait office d’admin ; en dev, on peut autoriser via `VITE_DEV_ADMIN=true` (à remplacer par un vrai rôle ultérieurement).
