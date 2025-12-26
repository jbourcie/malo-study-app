# Malo – Révisions (GitHub Pages + Firebase)

Objectif : un petit site “révisions” pour Malo (5e), avec import JSON, suivi de progression et gamification légère.

## 1) Pré-requis
- Node.js 20+
- Un projet Firebase (plan gratuit Spark)

## 2) Configuration Firebase (résumé)
1. Console Firebase → Authentication → Sign-in method → activer **Google**
2. Console Firebase → Firestore Database → créer la base
3. Firestore → créer le doc `users/<ton_uid>` et mettre `role: "parent"` après ta première connexion.
4. Authentication → Authorized domains : ajouter
   - `localhost`
   - `<ton-compte>.github.io`

## 3) Variables d’environnement
Copie `.env.example` en `.env.local` et remplis avec la config Web Firebase.

## 4) Lancer en local
```bash
npm install
npm run dev
```

## 5) Déployer sur GitHub Pages
- Push sur `main` → GitHub Actions déploie automatiquement.
- Dans Settings → Pages : Source = GitHub Actions

## 6) Importer des exercices
En tant que parent : menu **Import (parent)** → importer un fichier JSON.
Exemples fournis dans `/packs`.

## 7) Règles Firestore
Voir `firebase.rules.txt` (à copier dans Firestore Rules).
