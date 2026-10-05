# Mon Batch Cooking

PWA de planification de repas et liste de courses, à usage privé (2
utilisateurs). Permet de créer des plats avec leurs ingrédients, de
planifier une semaine et de la rendre répétitive (chaque semaine ou
toutes les 2 semaines), et d'obtenir automatiquement la liste de courses
agrégée — consultable et modifiable hors-ligne.

## Pour les contributeurs (humains et IA)

Ce projet est développé avec l'aide de plusieurs outils IA. Avant toute
contribution :

- **`agents.md`** — règles de travail permanentes pour tout assistant
  IA intervenant sur ce projet (principes de conception, contraintes
  produit à respecter, stack déjà décidée). **À lire en premier.**
- **`.ia/contexte-projet.md`** — besoin fonctionnel détaillé.
- **`.ia/architecture.md`** — architecture technique, schéma de base de
  données, stratégie offline.
- **`decisions.md`** — historique des choix techniques et pourquoi
  (format ADR léger). Toute nouvelle décision structurante doit y être
  ajoutée.

## Fonctionnalités

- Planning de repas jour par jour, avec distinction petit-déjeuner /
  déjeuner / dîner.
- Répétition depuis le Planning : chaque semaine ou toutes les 2
  semaines (un seul motif actif). À l'édition : cette semaine seulement
  ou toutes les semaines futures.
- Plats avec liste d'ingrédients saisie une fois et réutilisable (pas
  d'API externe).
- Génération automatique de la liste de courses agrégée sur une
  période, cochable, disponible hors-ligne.

## Stack

- Next.js 14 (App Router) + TypeScript
- Supabase (Postgres + Auth) — tier gratuit
- Dexie (IndexedDB) pour l'offline de la liste de courses
- Serwist pour le service worker PWA
- Déploiement : Vercel (tier gratuit)

Le raisonnement derrière chacun de ces choix (et les alternatives
écartées) est détaillé dans `decisions.md`.

## Mise en route

### 1. Installer les dépendances

```bash
npm install
```

### 2. Créer un projet Supabase

1. Aller sur https://supabase.com et créer un projet gratuit.
2. Dans l'éditeur SQL de Supabase, exécuter le contenu de
   `supabase/migrations/0001_init.sql`.
3. Récupérer l'URL du projet et la clé "anon" (Project Settings > API).
4. Copier `.env.local.example` en `.env.local` et renseigner ces deux valeurs.

### 3. Activer l'authentification par email

Dans Supabase, Authentication > Providers, garder "Email" activé.
Créer manuellement les 2 comptes (toi + ta femme) depuis Authentication > Users,
ou via un formulaire d'inscription si tu préfères l'ajouter à l'app plus tard.

### 4. Lancer en local

```bash
npm run dev
```

Ouvrir http://localhost:3000

### 5. Déployer

1. Pousser le code sur un repo GitHub.
2. Sur https://vercel.com, importer le repo.
3. Renseigner les mêmes variables d'environnement que dans `.env.local`.
4. Déployer : Vercel fournit une URL en `https://xxxx.vercel.app`, utilisable
   telle quelle, ou avec un nom de domaine personnalisé plus tard si voulu.

#### Environnements (dev / prod)

Le déploiement passe uniquement par l'intégration Git de Vercel (pas de
GitHub Action) :

| Branche | Environnement Vercel | URL | Base Supabase |
|---------|----------------------|-----|---------------|
| `dev`   | Preview (domaine de branche) | https://mon-batch-cooking-dev.vercel.app | projet Supabase dev |
| `main`  | Production | https://mon-batch-cooking.vercel.app | projet Supabase prod |

- Les nouvelles fonctionnalités sont commitées et poussées sur `dev` :
  Vercel déploie automatiquement sur l'URL dev.
- Mise en production : fusionner `dev` dans `main` (fast-forward) et pousser.
  `git checkout main && git merge --ff-only dev && git push && git checkout dev`
- Les variables Supabase de l'environnement Preview sont limitées à la branche
  `dev` et pointent vers le projet Supabase dev ; celles de Production pointent
  vers le projet prod. Les migrations (`supabase/migrations`) sont d'abord
  appliquées sur dev, puis sur prod au moment de la mise en production.
- Les déploiements Preview sont protégés par Vercel Authentication : il faut
  être connecté à son compte Vercel pour ouvrir l'URL dev.

### 6. Installer la PWA sur téléphone

Ouvrir l'URL déployée dans Safari (iOS) ou Chrome (Android), puis
"Ajouter à l'écran d'accueil". L'app s'ouvre ensuite comme une app native,
avec support offline pour la liste de courses.

## Arborescence du projet

```
.
├── agents.md                  → instructions permanentes pour les assistants IA
├── decisions.md                → journal des décisions techniques
├── README.md                   → ce fichier
├── .ia/
│   ├── contexte-projet.md      → besoin fonctionnel
│   └── architecture.md         → architecture technique détaillée
├── supabase/
│   └── migrations/
│       └── 0001_init.sql       → schéma de base de données complet
└── src/
    ├── app/                    → routes Next.js (App Router) + service worker
    ├── features/
    │   ├── dishes/             → plats et leurs ingrédients
    │   ├── cycles/             → constantes repas + types du motif
    │   ├── planning/           → planning + répétition
    │   └── shopping-list/      → génération + offline de la liste de courses
    └── lib/
        ├── supabase/           → client Supabase + types du schéma
        └── db/                 → configuration Dexie (IndexedDB)
```

## État actuel du projet

Application utilisable (mode démo local ou Supabase) :
- Config Next.js + PWA (Serwist)
- Client Supabase typé + mode démo local
- Schéma de base de données versionné (migrations SQL)
- Offline de la liste de courses (Dexie + file de synchronisation)
- Écrans Plats, Planning (avec répétition), Courses

