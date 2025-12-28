# Stratégie globale de génération des questions

Ce document définit les règles générales pour générer des packs de questions
dans MaloStudy / MaloCraft.

## Principes fondamentaux

- Une question = une compétence
- Une seule difficulté par question
- Une seule réponse correcte
- Le vocabulaire et les phrases doivent être adaptés au niveau collège (5e)

## Types de questions autorisés

- MCQ (choix multiples) — type principal
- TRUE_FALSE — validation rapide
- ERROR_SPOTTING — corriger une affirmation erronée

## Types interdits / limités

- FILL_BLANK (texte à trou) :
  - INTERDIT si la réponse peut être ambigüe
  - Autorisé uniquement pour accords ou conjugaison simple (exception contrôlée)

## Contraintes pédagogiques

- Toujours fournir une explication (≥ 20 caractères)
- Les distracteurs doivent être plausibles
- Pas de pièges artificiels ou de devinettes

## Contraintes techniques

- Toutes les questions sont importées avec `quality.status = "draft"`
- `blockId` = `primaryTag` = `tagCatalog.id`
- Les ancres de leçon utilisent le format `{#kebab-case}`

## Objectif

Permettre une génération massive, homogène et modérable des questions,
tout en respectant les progressions pédagogiques.