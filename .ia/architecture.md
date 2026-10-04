# Architecture technique

## Vue d'ensemble

```
Navigateur (PWA)
  ├─ Next.js (App Router, TypeScript)
  ├─ Dexie / IndexedDB          → cache local + offline liste de courses
  └─ Service Worker (Serwist)   → cache des assets, ouverture offline de l'app
        │
        ▼
Supabase (Postgres + Auth)
        │
Vercel (hébergement du frontend)

Note: pour le développement local, l'application propose un mode
"demo" qui remplace Supabase par une couche locale (stockée en
`localStorage` et Dexie pour la liste de courses). Voir `lib/localDemo.ts`
et `features/auth/localAuth.ts` pour les détails d'implémentation.
```

## Déploiement actuel (2026-08-04)

- Le frontend est déployé sur Vercel et accessible via une URL de
  production.
- La production attend un projet Supabase configuré avec deux variables
  d'environnement côté Vercel : `NEXT_PUBLIC_SUPABASE_URL` et
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Le schéma SQL de la base est défini dans `supabase/migrations/0001_init.sql`.
  Il doit être exécuté dans l'instance Supabase utilisée en production pour
  créer les tables, types et policies RLS.
- Le fichier `.env` du dépôt peut contenir des secrets de développement,
  mais les variables frontend doivent rester définies dans Vercel et non
  dans le code source du repo.

## Pourquoi ces choix (résumé — détails dans decisions.md)

- **Next.js + TypeScript** : base solide, statiquement typée, seule
  techno frontend nécessaire (pas de backend séparé à maintenir).
- **Supabase** : Postgres managé (modèle relationnel adapté aux
  relations plats/ingrédients/planning), Auth intégrée, tier gratuit
  largement suffisant pour 2 utilisateurs.
- **Vercel** : hébergement gratuit du frontend, déploiement continu
  depuis Git.
- **Dexie (IndexedDB)** : la seule partie de l'app qui a un vrai besoin
  offline est la liste de courses (consultée au supermarché). Le reste
  de l'app (création de plats, planning) suppose une connexion réseau.
  Concrètement, la logique permet aujourd'hui de travailler sans
  Supabase en activant automatiquement le mode demo lorsque les variables
  d'environnement Supabase sont absentes (utile pour tests locaux
  et démonstrations hors-ligne). Dexie continue d'être la source de
  vérité pour la liste de courses offline même en mode demo.
- **Serwist** : génère le service worker pour que l'app se lance même
  hors-ligne (cache des assets statiques), succession maintenue de
  next-pwa pour l'App Router.

## Schéma de base de données

Voir `supabase/migrations/0001_init.sql` pour le DDL complet. Les
fichiers de migration sont figés une fois créés : toute évolution de
schéma passe par un nouveau fichier, jamais une édition d'un fichier
existant (voir `.ia/agents.md`, section « Migrations SQL »).

Tables principales :

| Table                  | Rôle                                                             |
|------------------------|-------------------------------------------------------------------|
| `ingredients`          | Référentiel unique des ingrédients                                |
| `dishes`               | Plats (dont `photo_url`, `calories`, `protein_g`, voir plus bas)  |
| `dish_ingredients`     | Composition d'un plat (ingrédient + quantité + unité)              |
| `meal_cycles`          | Motif unique de répétition (fréquence libre, en semaines), piloté depuis le Planning |
| `meal_cycle_entries`   | Créneaux du motif (jour relatif + repas + plat)                        |
| `planned_meals`        | Planning calendaire réel (override possible sans casser le motif ; `special`, voir plus bas) |
| `shopping_list_items`  | Liste de courses (2 sections via `section`, voir plus bas), cochable, source de l'offline |
| `saved_weeks` / `saved_week_entries` | Semaines enregistrées, réutilisables pour remplir le planning (voir plus bas) |

Point clé : un seul motif de répétition par utilisateur
(`meal_cycles`/`meal_cycle_entries`), avec une fréquence libre en
nombre de semaines (`meal_cycles.duration_days`, saisie via un champ
numérique « toutes les N semaines » — voir `.ia/decisions.md`
2026-09-18). `meal_cycle_entries` (le **modèle**) est séparé de
`planned_meals` (la **réalité calendaire**) pour remplir automatiquement
les semaines futures tout en autorisant un override ponctuel (« cette
semaine seulement ») sans casser la répétition.

Avant d'activer ou de changer la fréquence, `findRepeatConflicts`
(`src/features/planning/repeat.ts`) détecte les repas déjà planifiés à
la main dans les semaines à venir qui entreraient en conflit avec la
nouvelle fréquence, et demande confirmation avant de les remplacer
(`applyCycleToRange`/`applyDemoCycleToRange` acceptent un paramètre
`overwrite` pour ce cas précis).

Un seul mécanisme de répétition existe (pas de répétition par repas
séparée — une tentative en ce sens a été retirée, voir
`.ia/decisions.md` 2026-09-18).

**`planned_meals.dish_id` est nullable.** Une ligne à `dish_id = null`
représente une case **explicitement vidée** par l'utilisateur (via les
boutons « Vider » ou un retrait « cette semaine seulement » pendant
qu'un motif est actif) : elle occupe l'emplacement (date + repas) pour
empêcher le motif de le remplir à nouveau, mais ne représente aucun
repas réel. `fetchPlannedMeals`/`fetchDemoPlannedMeals` filtrent ces
lignes avant de les renvoyer — tout le reste de l'app (UI, snapshot
d'un nouveau motif, génération de la liste de courses) les traite comme
une case vide normale. Seul `applyCycleToRange`/`applyDemoCycleToRange`
en a besoin (via `fetchOccupiedSlots`/`fetchDemoOccupiedSlots`), pour
savoir où ne pas réappliquer le motif. Voir `.ia/decisions.md`
2026-09-18 pour le bug que ce mécanisme corrige.

Le Planning propose aussi : « Vider cette semaine » / « Vider toutes
les semaines » (`clearWeek`/`clearAllWeeks` dans `repeat.ts`), et une
navigation par calendrier (`<input type="date">`) en plus des flèches
précédent/suivant.

**Photo de plat** : `dishes.photo_url` stocke l'URL publique d'un
fichier dans le bucket Supabase Storage `dish-photos` (policies RLS :
lecture publique, écriture scoping par dossier `user_id/...`). En mode
démo local, la photo est encodée en base64 directement dans
`localStorage` (pas de vrai stockage de fichiers disponible hors
Supabase). Affichée uniquement sur la fiche plat (écran Plats).

**Repas spécial (`planned_meals.special`)** : une case du Planning peut
porter autre chose qu'un plat — pour l'instant une seule valeur,
`eating_out` (« Manger dehors »), liste fermée contrainte en base (voir
`0008_planned_meal_special.sql`). Mutuellement exclusif avec `dish_id`
(contrainte `dish_id is null or special is null` ; une case vidée a les
deux à `null`, un repas spécial a `dish_id` null et `special` renseigné
— `fetchPlannedMeals`/`fetchDemoPlannedMeals` filtrent la première,
affichent la seconde). N'a pas d'ingrédients (jamais compté par
`generateShoppingList`) ni de calories/protéines (`sumNutrition` le
traite comme une valeur non renseignée). Ne peut pas intégrer le motif
de répétition (`meal_cycle_entries.dish_id` reste `not null`) :
`setMealWithScope` applique toujours l'override « cette semaine
seulement » quand `special` est fourni, sans poser la question de
portée même si un motif est actif.

**Liste de courses en deux sections (`shopping_list_items.section`)**,
présentées comme deux onglets sur l'écran `/courses` :
- `dishes` (onglet « Depuis le planning ») : générée depuis le planning
  sur une période choisie (`period_start`/`period_end` non null pour
  cette section seulement). **Une seule liste à la fois** : une
  génération supprime toutes les lignes `dishes` de l'utilisateur,
  quelle que soit leur période (migration `0012`), sinon « À acheter »
  additionnerait d'anciennes périodes.
- `extra` (onglet « Courses supplémentaires ») : ajoutée à la main
  (recherche/autocomplétion sur les ingrédients déjà connus, sinon
  création à la volée — réutilise le référentiel `ingredients`, comme
  les ingrédients de plat). Liste **continue** : `period_start`/
  `period_end` valent `null`.

**« À acheter » est calculée, pas stockée** (depuis `0012`, l'ancienne
section `final` et ses boutons d'export ont disparu) :
- `is_checked` sur une ligne `dishes`/`extra` = « à acheter ». Coché
  par défaut à la génération / à l'ajout (un ajout qui fusionne avec
  une ligne `extra` décochée la recoche).
- `FinalListSection.tsx` regroupe les lignes cochées des deux sections
  par `ingredient_id` + `unit` (quantités additionnées). Une ligne
  affichée peut donc correspondre à plusieurs lignes en base.
- `is_bought` = « dans le panier » (case cochée sur « À acheter ») ;
  cocher une ligne fusionnée met à jour toutes ses lignes sources
  (`setItemsBought`). Décocher un article dans son onglet remet aussi
  `is_bought` à false. « ✕ » sur « À acheter » décoche les lignes
  sources ; « Vider » (`clearPurchaseList`) décoche tout — rien n'est
  supprimé des onglets.

Le rendu de « À acheter » (`FinalListSection.tsx`, composant autonome
via `useShoppingList`) n'est affiché que sur l'onglet de navigation
`/a-acheter` (`FinalListScreen.tsx`, qui rejoue la file offline puis
rafraîchit le cache à l'ouverture) — plus en bas de `/courses`
(demande utilisateur du 2026-09-29).

Un article `extra` ajouté deux fois (même ingrédient + unité) fusionne
ses quantités au lieu de dupliquer (recherche d'une ligne existante
avant insert, pas de contrainte unique en base sur les sections sans
période — voir migration `0011`).

**Formulaire de plat partagé** : `src/features/dishes/DishFormModal.tsx`
(création/modification, photo, ingrédients, apports) est utilisé par
l'écran Plats et par la modale de choix de plat du Planning (création
à la volée ; `onSaved` reçoit l'id du plat, que le Planning place dans
la case via le même chemin qu'un choix normal, question de portée
comprise si une répétition est active).

**Semaines enregistrées** (`saved_weeks` + `saved_week_entries`,
migration `0013`) : une semaine du planning gardée sous un nom
(`day_offset` 0 = lundi … 6, `meal_slot`, `dish_id` XOR `special`).
Code : `src/features/planning/savedWeeks.ts` (+ équivalent démo dans
`localDemo.ts`, clé `savedWeeks` de l'état local). Enregistrer un nom
existant remplace l'ancienne. Appliquer (`applySavedWeek`) = `clearWeek`
puis `setMealWithScope(..., "this_week")` pour chaque entrée : avec une
répétition active, ce sont des overrides de cette semaine seulement, le
motif n'est pas modifié. Supprimer un plat supprime ses entrées
(`on delete cascade`). Indépendant de `meal_cycles`.

**Créneaux de repas** : l'enum Postgres `meal_slot_type` vaut
`breakfast | lunch | snack | dinner` (migration 0006 ajoute `snack`).
La liste ordonnée côté code est `MEAL_SLOTS` dans
`src/features/cycles/types.ts` (source unique, utilisée par le Planning,
`applyCycleToRange` et le mode démo).

**Apports nutritionnels** : `dishes.calories` (entier) et
`dishes.protein_g` (numeric(6,1)), tous deux nullables — `null` = non
renseigné, distinct de 0. Ils remontent dans `PlannedMeal`
(`dishCalories`, `dishProteinG`) et `sumNutrition`
(`src/features/planning/nutrition.ts`) calcule les totaux du jour.

**Préférences d'affichage du Planning** (créneaux visibles, totaux) :
stockées en `localStorage` par appareil (clés `planning-show-*`), pas en
base — ce sont des préférences d'affichage, pas des données partagées.

## Stratégie offline (liste de courses uniquement)

Concerne uniquement le cochage (dans les onglets ou « dans le panier »
sur « À acheter », actions `toggle_checked` / `toggle_bought` de la
file) et le retrait d'un article déjà présent. Les autres actions
(générer depuis le planning, ajouter un article supplémentaire)
nécessitent une connexion réseau, comme le reste de l'app.

1. Lecture : `shopping_list_items` est répliqué dans Dexie
   (`src/lib/db/dexie.ts`), qui sert de source de vérité pour l'UI —
   affichage instantané, fonctionne sans réseau.
2. Écriture : une action (ex: cocher un article) est appliquée
   immédiatement en local, puis empilée dans une file d'attente
   (`src/features/shopping-list/syncQueue.ts`).
3. Synchronisation : dès que le réseau revient (`online` event), la
   file est rejouée vers Supabase, dans l'ordre, en s'arrêtant à la
   première erreur pour réessayer plus tard.
4. Stratégie de conflit : "dernière écriture gagne" (last write wins).
   Suffisant vu qu'il n'y a que 2 utilisateurs et un risque de
   collision quasi nul.

## Arborescence du code

```
src/
  app/                    → routes Next.js (App Router) + service worker (sw.ts)
  features/
    dishes/               → plats et leurs ingrédients
    cycles/               → constantes repas + types du motif (plus d'UI dédiée)
    planning/             → planning + répétition (repeat.ts) + semaines enregistrées (savedWeeks.ts)
    shopping-list/        → génération + offline de la liste de courses
  lib/
    supabase/             → client Supabase + types générés du schéma
    localDemo.ts          → backend demo local (fallback sans Supabase)
    db/                   → configuration Dexie (IndexedDB)
supabase/
  migrations/             → schéma SQL versionné
docs/                     → guides de travail (agent-teams.md : équipes d'agents Claude Code)
.ia/                      → documents de contexte pour les assistants IA
```

Chaque `feature` est autonome (types, hooks, logique) pour rester
testable et remplaçable indépendamment des autres.
