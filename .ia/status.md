# État actuel du projet (résumé rapide)

Date: 2026-09-29

Résumé:
- **« À acheter » retirée du bas de l'écran Courses** (2026-09-29) :
  elle n'est plus visible que via son onglet de navigation
  `/a-acheter`. Pas de migration.
- **Choix d'un plat dans le Planning** (2026-09-29) : barre de
  recherche + bouton « + Nouveau plat » dans la modale de choix. Le
  formulaire de plat est extrait dans `DishFormModal.tsx`, partagé avec
  l'écran Plats. Pas de migration.
- **« À acheter » automatique + semaines enregistrées** (2026-09-29) :
  les articles des onglets « Depuis le planning » et « Courses
  supplémentaires » ont une case à cocher (cochés par défaut) ; tout
  article coché apparaît automatiquement dans « À acheter » — boutons
  « Ajouter à la liste d'achat » supprimés. Sur « À acheter », cocher =
  « dans le panier ». « Depuis le planning » ne garde plus qu'une liste
  (la dernière générée). Dans le Planning, panneau « Semaines
  enregistrées » : enregistrer la semaine affichée sous un nom, et
  remplir (remplacer) une semaine depuis une semaine enregistrée.
  Migrations `0012_shopping_list_checked_sources.sql` et
  `0013_saved_weeks.sql` (voir `.ia/decisions.md`).
- **Icône de l'application** (2026-09-22) : `public/icons/icon-192.png`
  et `icon-512.png` (référencées par `public/manifest.json`, icône
  d'écran d'accueil PWA) n'étaient que des placeholders cassés
  (1×1 px). D'abord régénérées depuis `public/icons/icon.svg` (ancien
  design — assiette/couverts/cœur), puis **remplacées par une
  illustration fournie par l'utilisateur** (calendrier de repas +
  légumes + liste de courses, avec le nom de l'app). `icon.svg` n'est
  plus utilisé (conservé pour référence). Ajouté aussi `src/app/icon.png`
  (512×512) et `src/app/apple-icon.png` (180×180) : convention de
  fichiers Next.js App Router, favicon/icône Apple générés
  automatiquement, aucune metadata à déclarer à la main. Pas de
  migration.
- **Retouches liste de courses** (2026-09-22, suite à la réorg. ci-dessous) :
  l'onglet « Cette semaine » est renommé **« Depuis le planning »**
  (la durée est libre, pas forcément une semaine) ; les boutons
  « Exporter vers « À acheter » » deviennent **« Ajouter à la liste
  d'achat »** ; la section « À acheter » (extraite dans
  `FinalListSection.tsx`, réutilisée par `FinalListScreen.tsx`) est
  maintenant **aussi accessible via son propre onglet de navigation**
  (`/a-acheter`, entre « Courses » et « Déconnexion »), en plus de
  rester visible en bas de l'écran Courses. Pas de changement de
  schéma.
- **Liste de courses réorganisée en 2 onglets + « À acheter »**
  (2026-09-22) : `/courses` a désormais deux onglets — « Depuis le
  planning » (identique à avant : période, génération depuis le
  planning, export) et « Courses supplémentaires » (ajout à la main
  avec recherche parmi les ingrédients déjà utilisés, sinon création).
  Une section « À acheter » toujours visible en dessous accumule ce qui
  est exporté des deux onglets (fusion des quantités, pas de
  remplacement) et se vide avec un bouton « Vider ». Contrairement à la
  veille, « Courses supplémentaires » et « À acheter » ne sont plus
  liées à une période. Voir `.ia/decisions.md`. **Migration appliquée
  en production** : `0011_shopping_list_ongoing_lists.sql` (voir
  `.ia/agents.md`).
- **Correctif prod : contraintes unique globales héritées, bloquant le
  Planning et l'export de la liste de courses** (2026-09-22). Trois
  contraintes non scopées par `user_id` (leftovers d'avant
  `0002_user_scoping.sql`) empêchaient : planifier un repas sur un
  jour/créneau déjà utilisé par l'autre compte (c'était le bug
  signalé « Enregistrement du repas impossible ») ; exporter une
  section de la liste de courses dès qu'un ingrédient était déjà
  présent dans le résultat ; créer un plat avec un ingrédient déjà
  utilisé par l'autre compte. Supprimées via
  `0010_drop_stale_global_unique_constraints.sql`, appliquée en
  production et revérifiée. Voir `.ia/decisions.md` pour le détail
  (dont une incohérence documentée mais non résolue : `agents.md` dit
  les données partagées entre les 2 comptes, la réalité du schéma dit
  le contraire).
- **Migrations `0008` et `0009` appliquées en production** (2026-09-22),
  via `SUPABASE_SESSION_POOLER_URI` — voir `.ia/agents.md`, section
  « Déploiement et application des migrations ». Les colonnes/contraintes/
  index attendus ont été vérifiés présents après coup.
- **Repas spécial « Manger dehors » + liste de courses en 3 sections**
  (2026-09-22) : sur une case du Planning, on peut choisir « Manger
  dehors » à la place d'un plat (pas d'ingrédients, jamais compté dans
  la liste de courses ; les calories/protéines du jour le traitent
  comme incomplet, comme un plat sans valeur renseignée). Ne participe
  jamais au motif de répétition — le choisir applique toujours « cette
  semaine seulement », sans poser la question de portée. Voir
  `supabase/migrations/0008_planned_meal_special.sql` et
  `.ia/decisions.md`.
  La liste de courses (`/courses`) a trois sections : **Courses des
  plats** (générée depuis le planning, inchangé), **Courses
  supplémentaires** (ajout manuel via un formulaire tout en haut de la
  page) et **Liste finale** (cochable, remplie par un bouton
  « Exporter vers la liste finale » sur chacune des deux premières
  sections). Exporter une section remplace ses propres articles dans la
  liste finale (pas ceux de l'autre section) en conservant l'état coché
  des articles inchangés — un nouvel export après régénération/ajout
  resynchronise donc sans dupliquer. Voir
  `supabase/migrations/0009_shopping_list_sections.sql` et
  `.ia/decisions.md`. **Migrations à appliquer sur la base de
  production** : `0008_planned_meal_special.sql` et
  `0009_shopping_list_sections.sql`.
- **Erreurs d'enregistrement d'un plat, messages clairs** (2026-09-20) :
  `saveDish` (`src/features/dishes/api.ts`) ne renvoie plus `null` en
  silence : il lève une erreur au message lisible (pas de connexion,
  session expirée, migration SQL manquante, photo qui n'a pas pu être
  envoyée, ingrédient en double, sinon message technique entre
  parenthèses), affichée **dans la modale** qui reste ouverte. Corrige
  aussi : un ingrédient dont l'enregistrement échouait était ignoré sans
  erreur (plat sauvegardé incomplet) ; l'ancienne photo était supprimée
  avant de savoir si la sauvegarde réussissait ; un échec de rechargement
  après sauvegarde affichait « Impossible d'enregistrer » alors que le
  plat l'était ; un nouvel essai après échec pouvait créer un doublon
  (l'identifiant du nouveau plat est maintenant fixé à l'ouverture du
  formulaire).
- **Planning : affichage personnalisable, collation, apports** (2026-09-20) :
  la photo du plat n'apparaît plus dans le Planning (cases ni sélecteur),
  seulement sur l'écran Plats. Les cases issues du modèle de répétition
  sont **encadrées en vert** (plus de mot « Modèle »). Un nouveau créneau
  **Collation** (entre déjeuner et dîner) existe, et le panneau
  « Affichage » du Planning permet de cocher/décocher : Petit-déjeuner,
  Collation, Calories du jour, Protéines du jour (préférence mémorisée
  dans `localStorage`, par appareil ; défaut : petit-déj visible,
  collation et totaux masqués). Chaque plat a des champs optionnels
  **calories** et **protéines** (pour une portion), affichés sur sa
  fiche ; les totaux du jour n'additionnent que les créneaux affichés
  et sont suffixés « * » si un plat n'a pas la valeur renseignée. Voir
  `.ia/decisions.md` (2026-09-20). **Migrations à appliquer sur la base
  de production** : `0006_snack_meal_slot.sql` et
  `0007_dish_nutrition.sql`.
- L'application compile et le build Next.js fonctionne (`npm run build`).
- Le frontend a été **déployé sur Vercel** avec une URL de production.
- Un **mode démo local** reste disponible si les variables Supabase ne sont
  pas définies.
- **Plus d'onglet Cycles** : la répétition est un paramètre du Planning,
  avec une fréquence libre (« toutes les N semaines »). Voir `decisions.md`.
- **Recherche de plats** : un champ de recherche filtre la liste des plats
  par nom/description côté client, sur l'écran Plats
  (`src/features/dishes/DishesScreen.tsx`). Filtrage simple en mémoire,
  pas de recherche côté serveur (nombre de plats attendu faible pour 2
  utilisateurs).
- **Alignement des libellés du Planning** : « Petit-déj / Déjeuner /
  Dîner » sont maintenant alignés avec leurs 3 lignes de cases (la
  colonne d'étiquettes mirrore la structure de l'en-tête des jours et
  a la même hauteur de ligne que `.meal-cell`). Voir
  `src/features/planning/PlanningScreen.tsx` et `src/app/globals.css`.
- **Photo de plat** : chaque plat peut avoir une photo (upload depuis
  l'écran Plats), affichée sur sa fiche uniquement (retirée du
  Planning le 2026-09-20). Stockée dans Supabase Storage (bucket
  `dish-photos`) en prod, en base64 dans `localStorage` en mode démo.
  Voir `.ia/decisions.md` (2026-09-18) et la migration
  `supabase/migrations/0004_dish_photos.sql` (à appliquer sur la base
  de production).
- **Fréquence de répétition libre + détection de chevauchement** : la
  barre « Répéter » du Planning accepte n'importe quel nombre de
  semaines (pas seulement 1 ou 2), via un champ numérique. Avant
  d'activer/changer la fréquence, l'app détecte les repas déjà
  planifiés à la main qui entrent en conflit avec la nouvelle fréquence
  et demande confirmation avant de les remplacer. Voir `.ia/decisions.md`
  (2026-09-18) et `src/features/planning/repeat.ts`
  (`findRepeatConflicts`). Pas de migration nécessaire.
  Note : une tentative précédente avait ajouté un mécanisme de
  répétition « par repas » séparé (table `meal_repeats`) — retiré à la
  demande de l'utilisateur, un seul mécanisme de répétition (le motif
  global) est conservé.
- **Vider la semaine / tout le planning** : deux boutons dans le
  Planning (« Vider » → « Cette semaine » / « Toutes les semaines »),
  avec confirmation. « Toutes les semaines » désactive aussi le motif de
  répétition. Nécessite `planned_meals.dish_id` nullable (voir migration
  ci-dessous) pour fonctionner correctement sur les cases issues du
  motif.
- **Navigation entre semaines, v2** : les flèches précédent/suivant sont
  collées aux extrémités gauche/droite du tableau du planning (plus
  grandes, 3.2rem, pour rester bien visibles) — elles font défiler *ce
  tableau*. Juste au-dessus du tableau, une barre calendrier
  (`<input type="date">`, icône 📅) au même style que les cases du
  tableau (bordure/radius/fond identiques) permet de sauter directement
  à une semaine éloignée. Le bouton « Aujourd'hui » a été retiré : le
  texte sous le titre (« Semaine du 14 au 20 septembre » — plage
  complète, via `formatWeekRange` dans `lib/date.ts`) fait maintenant
  aussi office de bouton « retour à aujourd'hui » au clic. Voir
  `src/features/planning/PlanningScreen.tsx` (`.week-calendar-bar`,
  `.week-grid-row`, `.week-edge-nav`, `.screen-kicker-button`) et
  `globals.css`.
- **Correctif important : repas planifié "vide" (`dish_id` nullable)** —
  `planned_meals.dish_id` peut désormais être `null`, ce qui représente
  une case explicitement vidée par l'utilisateur (empêche le motif de
  répétition de la remplir à nouveau au chargement suivant). Ce
  correctif était nécessaire au bon fonctionnement de « Vider cette
  semaine », mais corrige aussi un bug préexistant : retirer un repas
  avec « cette semaine seulement » pendant qu'un motif est actif ne
  persistait pas avant. Voir `.ia/decisions.md` (2026-09-18) et la
  migration `0005_nullable_planned_meal_dish.sql` (à appliquer sur la
  base de production).
- **La question de portée (« cette semaine / le modèle ») ne se pose
  plus que sur une case déjà remplie.** Choisir un plat pour une case
  vide l'ajoute directement pour cette semaine-là, sans interruption —
  même si un motif de répétition est actif. La question ne s'affiche
  que quand on modifie ou retire un repas déjà présent (voir
  `handlePickDish` dans `PlanningScreen.tsx`, condition
  `repeat?.active && editingMeal`).
- **Notification « semaine prochaine vide »** : si la semaine qui suit
  celle d'aujourd'hui (pas celle affichée) n'a aucun repas planifié, une
  bannière ambre s'affiche en haut du Planning, quelle que soit la
  semaine consultée (cliquer dessus y saute directement). Vérifié à
  chaque chargement du planning (`checkNextWeek` dans
  `PlanningScreen.tsx`).

État de la production :
- Le frontend Vercel est prêt, mais la version “réelle” n'est pas encore
  complètement fonctionnelle tant que les variables suivantes ne sont pas
  renseignées dans Vercel : `NEXT_PUBLIC_SUPABASE_URL` et
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Appliquer les migrations SQL (`0001_init.sql`, et le cas échéant
  `0002_user_scoping.sql`, `0003_single_repeat_pattern.sql`,
  `0004_dish_photos.sql`, `0005_nullable_planned_meal_dish.sql`) sur la
  base Supabase de production.
- L'authentification email Supabase doit être vérifiée si les utilisateurs
  doivent créer des comptes depuis la version déployée.

Problèmes connus:
- Icônes manquantes: `/icons/icon-192.png` peut renvoyer 404 si les
  ressources d'icônes ne sont pas présentes dans `public/icons`.
- Le mode demo stocke les données uniquement côté client ; ne pas
  compter sur ces données pour un usage multi-device.

Comment lancer localement:

1. Développement (Hot reload):

```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
```

2. Build de production (test de compilation):

```bash
npm run build
```

Notes d'utilisation:
- Pour tester avec Supabase, créez un `.env.local` à la racine du projet et
  renseignez `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- En l'absence de ces variables, l'application bascule automatiquement en
  mode demo.

Fichiers importants à consulter pour l'état actuel:
- `src/features/planning/repeat.ts` — répétition depuis le Planning
- `src/lib/localDemo.ts` — backend demo local et `isDemoMode()`
- `src/features/auth/localAuth.ts` — stockage local des comptes et session
- `src/features/shopping-list/syncQueue.ts` — file de synchronisation
- `supabase/migrations/` — schéma de données référentiel
