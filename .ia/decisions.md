# Journal des décisions techniques

Format : chaque décision indique le contexte, le choix retenu, les
alternatives écartées et pourquoi. Ajouter les nouvelles décisions en
haut du fichier (ordre antéchronologique).

---

## 2026-10-06 — Catégories de plats = créneaux du planning ; nom de « Courses supplémentaires » par utilisateur

**Contexte** : le choix d'un plat pour une case du planning proposait
tous les plats, y compris des plats de dîner pour un petit-déjeuner. Et
l'onglet « Courses supplémentaires » devait pouvoir être renommé.

**Décision** :
- `dishes.meal_slots meal_slot_type[]` (migration `0014`), au moins une
  valeur. Une catégorie (petit-déjeuner, déjeuner, collation, dîner)
  est exactement un créneau du planning : réutiliser l'enum évite une
  table de correspondance. Défaut et plats existants : déjeuner + dîner.
  Le sélecteur du planning ne montre que les plats de la catégorie de
  la case (plus le plat déjà posé, même hors catégorie). Un plat créé
  depuis une case est précoché sur la catégorie de cette case.
- Table `user_settings` (migration `0015`, une ligne par compte, RLS
  `user_id = auth.uid()`) avec `extra_list_name`. Ligne absente = nom
  par défaut. Copie locale en `localStorage` pour un affichage immédiat
  et hors-ligne de l'écran Courses. Renommage : clic sur l'onglet actif.

**Alternatives écartées** : table de jointure plat ↔ catégorie (plus
lourde pour 4 valeurs fixes) ; nom stocké seulement en `localStorage`
(non synchronisé entre téléphone et ordinateur).

---

## 2026-10-04 — Refonte UX/UI : confirmations, notifications et navigation mobile

**Contexte** : demande de rendre l'app plus simple, plus professionnelle
et plus facile à utiliser. Problèmes relevés : quatre panneaux
d'options au-dessus de la grille du Planning (grille sous la ligne de
flottaison, boutons « Vider » toujours visibles) ; grille à 7 colonnes
qui défile horizontalement sur téléphone ; `window.confirm` partout ;
messages de statut qui décalent la page ; cases à cocher minuscules
pour la liste de courses.

**Décision** :
- `components/ui/Feedback.tsx` : `useConfirm()` (promesse, modale
  stylée) et `useToast()` (notifications éphémères, `aria-live`)
  fournis par `FeedbackProvider` dans `providers.tsx`.
- `Modal` gère une pile : seule la modale du dessus réagit à Échap, ce
  qui permet une confirmation par-dessus un formulaire sans le fermer.
- Navigation : barre d'onglets en bas d'écran sous 720 px.
- Planning : options derrière une barre d'outils (panneaux), agenda
  vertical sur téléphone obtenu en CSS à partir du même balisage.
- Aucune nouvelle dépendance (icônes en SVG maison, police via
  `next/font`).

**Alternatives écartées** : librairie de composants (Radix, shadcn…) ou
d'icônes — contraire à la règle « pas de dépendance sans nécessité » ;
une vue mobile séparée du Planning — dupliquerait la logique de cases.

**Pourquoi** : usage réel surtout sur téléphone (planifier, puis faire
les courses d'une main) ; les choix restent réversibles et ne touchent
ni aux données ni à la logique métier.

---

## 2026-09-29 — « À acheter » calculée depuis les articles cochés ; semaines enregistrées

**Contexte** : demande de ne plus avoir à cliquer sur « Ajouter à la
liste d'achat » : « À acheter » doit contenir automatiquement les
articles cochés des deux onglets. Et pouvoir enregistrer une semaine du
planning (plats + jours) pour la réutiliser plus tard.

**Décisions** :
- **« À acheter » n'est plus une section stockée** mais une vue
  calculée : lignes `dishes`/`extra` avec `is_checked = true`,
  fusionnées par ingrédient + unité côté client. Choix confirmé par
  l'utilisateur (alternative proposée : tout ajouter sans case à
  cocher dans les onglets). La section `final` est supprimée
  (migration `0012`).
- **Nouvelle colonne `is_bought`** pour « dans le panier » : `is_checked`
  a pris le sens « fait partie de la liste », il fallait un second état
  pour pouvoir cocher au supermarché sans que l'article disparaisse.
- **Coché par défaut** à la génération et à l'ajout : on décoche ce
  qu'on a déjà (plus rapide que tout cocher). La migration coche toutes
  les lignes existantes (elles n'avaient pas de case jusque-là).
- **Une seule liste `dishes`** (la dernière générée remplace toutes les
  précédentes, quelle que soit la période) : sinon des listes
  d'anciennes périodes, invisibles dans l'onglet, gonfleraient « À
  acheter ». La migration ne garde que la période la plus récemment
  modifiée par utilisateur.
- **« Vider » décoche** au lieu de supprimer : les onglets sources sont
  la donnée, « À acheter » n'en est qu'une vue.
- **Semaines enregistrées = nouvelles tables** `saved_weeks` /
  `saved_week_entries` plutôt que réutiliser `meal_cycles` (contrainte
  « un seul motif » par utilisateur, et sémantique de répétition
  différente). Appliquer une semaine **remplace toute la semaine
  affichée** (choix de l'utilisateur, alternative : ne remplir que les
  cases vides), via des overrides « cette semaine seulement » pour ne
  jamais toucher au motif de répétition. Les repas spéciaux sont inclus.

---

## 2026-09-22 — Liste de courses : deux onglets + « À acheter » continue (au lieu de trois sections empilées, liées à une période)

**Contexte** : la présentation de la veille (trois sections empilées
sur la même page, toutes liées à la même période choisie en haut) ne
convenait pas à l'usage réel. Demande : deux onglets (« Cette semaine »
inchangé, « Courses supplémentaires » avec ajout à la main + recherche
dans les articles déjà utilisés, stockés en base) et une liste finale
renommée « À acheter », vidée par un bouton dédié plutôt que par
regénération de période.

**Décisions** :
- **`extra` et `final` deviennent des listes continues, sans
  période** (`period_start`/`period_end` rendus nullables, migration
  `0011`) : seule la section `dishes` (« Cette semaine ») reste liée à
  une période, cohérent avec « rien ne change » pour cette partie. Les
  courses supplémentaires et « À acheter » s'accumulent au fil du temps
  et ne se réinitialisent plus au changement de période — seul le
  bouton « Vider » réinitialise « À acheter ».
- **Le catalogue de recherche pour les courses supplémentaires
  réutilise `ingredients`** (déjà partagé avec les ingrédients de
  plat), pas une nouvelle table : « stocké en base pour une prochaine
  utilisation » est déjà ce que fait `fetchIngredients`/l'upsert par
  nom, il manquait une vraie UI de recherche (`IngredientSearchField`,
  liste de suggestions filtrées) à la place du `<datalist>` natif.
- **Export = fusion (addition des quantités), plus remplacement par
  origine.** La version précédente supprimait puis réinsérait les
  lignes `final` d'une section pour rester idempotente à la
  régénération ; ce mécanisme (`origin_section`) est retiré (colonne
  supprimée, migration `0011`) car il n'a plus de sens sans période : un
  export additionne simplement dans « À acheter », qui ne se vide plus
  que manuellement. Conséquence acceptée : cliquer deux fois sur
  « Exporter » sans rien changer entre-temps additionne deux fois (pas
  de détection de contenu identique) — au profit d'un modèle plus simple
  et prévisible (« envoie vers », comme demandé).
- **Même ingrédient dans les deux sections → fusionné dans « À
  acheter »** (une ligne, par ingrédient + unité), plutôt que deux
  lignes séparées comme dans la version précédente — plus cohérent
  maintenant que l'origine n'est plus trackée.

**Migration** : `0011_shopping_list_ongoing_lists.sql` (period_start/
period_end nullable sur `shopping_list_items`, suppression de
`origin_section`), appliquée en production le 2026-09-22.

---

## 2026-09-22 — Correctif : contraintes unique globales héritées, bloquant le Planning et l'export de la liste de courses

**Contexte** : l'utilisateur signale « Enregistrement du repas
impossible » en essayant de planifier un repas. En inspectant
directement le schéma de production (voir `.ia/agents.md`,
« Déploiement et application des migrations »), trois contraintes
`unique` **non scopées par `user_id`** coexistaient avec leur
équivalent correctement scopé, héritées d'avant
`0002_user_scoping.sql` et jamais nettoyées :

- `planned_meals_date_meal_slot_key` (date, meal_slot) à côté de
  `idx_planned_meals_user_date_slot` (user_id, date, meal_slot).
- `ingredients_name_key` (name) à côté de `idx_ingredients_user_id_name`
  (user_id, name).
- `shopping_list_items_ingredient_id_period_start_period_end_key`
  (ingredient_id, period_start, period_end — sans unité ni section) à
  côté de `idx_shopping_list_items_user_ingredient_unit_period_section`
  (ajouté en 0009).

Le code utilise partout `upsert(..., { onConflict: "user_id, ..." })` :
pour un utilisateur qui n'a pas encore de ligne sur cette clé, Postgres
tente un `INSERT` simple, qui passe l'index scopé (aucun conflit pour
CET utilisateur) mais heurte l'ancienne contrainte globale dès qu'UN
AUTRE utilisateur (ou une autre section, pour la liste de courses)
occupe déjà cette même clé. Reproduit et confirmé directement en base
avant correctif (voir `apply3.js`/diagnostics de la session, non
committés — outillage jetable comme documenté dans `agents.md`) :
- planifier un repas déjà pris par l'autre compte → **échec** (c'est le
  bug signalé) ;
- exporter une section de la liste de courses vers la liste finale, dès
  qu'un ingrédient est déjà présent dans le résultat exporté (cas
  courant) → **échec silencieux côté base**, alors que la démo locale
  (Dexie, sans ces contraintes) ne le montrait pas — d'où le fait que
  ça n'avait pas été détecté avant mise en prod ;
- créer un plat avec un ingrédient déjà utilisé par l'autre compte →
  **échec**.

**Décision** : supprimer les trois contraintes obsolètes
(`0010_drop_stale_global_unique_constraints.sql`). Les index scopés par
utilisateur (et par section, pour la liste de courses) qui existent déjà
à côté suffisent à garantir l'absence de doublon utile ; les anciennes
ne faisaient qu'empêcher deux comptes d'utiliser indépendamment la même
date/créneau ou le même nom d'ingrédient — jamais l'intention du
produit. Réappliqué et revérifié en reproduisant les trois échecs
ci-dessus : les trois passent désormais.

**Limite non résolue, à signaler** : `agents.md` affirme « les données
sont partagées entre les deux comptes » (pas de séparation par
utilisateur), mais l'implémentation réelle (RLS + `user_id` sur toutes
les tables, depuis `0002_user_scoping.sql`) fait l'inverse : chaque
compte a ses propres plats, planning et liste de courses, invisibles de
l'autre compte. Cette contradiction entre l'intention documentée et le
comportement réel est **antérieure à cette tâche** et n'a pas été
retranchée ici (changement structurant, hors périmètre du bug signalé —
à clarifier avec l'utilisateur avant d'y toucher).

**Migration** : `0010_drop_stale_global_unique_constraints.sql`,
appliquée en production le 2026-09-22 (voir `.ia/agents.md`).

---

## 2026-09-22 — Repas spécial « Manger dehors » et liste de courses en trois sections

**Contexte** : demande de pouvoir choisir, sur une case du Planning,
quelque chose qui n'est pas un plat (« Manger dehors » donné comme
exemple) ; et de restructurer la liste de courses en trois parties —
« Courses des plats » (générée), « Courses supplémentaires » (ajout
manuel), « liste finale » — avec un bouton « Exporter » sur chacune des
deux premières vers la liste finale.

**Décisions — repas spécial** :
- **Nouvelle colonne `planned_meals.special`** (texte, liste fermée
  contrainte en base à `eating_out` pour l'instant), plutôt qu'un faux
  plat dans `dishes` (aurait pollué la liste des plats et la liste de
  courses) ou qu'une table séparée (complexité inutile pour une seule
  valeur). Mutuellement exclusif avec `dish_id` par contrainte.
- **Ne participe jamais au motif de répétition.** `meal_cycle_entries.dish_id`
  reste `not null` : étendre le motif pour représenter un repas spécial
  aurait touché toute la logique de propagation (`setMealWithScope`,
  `applyCycleToRange`, `findRepeatConflicts`) pour un besoin non
  demandé. Choisir « Manger dehors » applique donc toujours un override
  « cette semaine seulement », sans poser la question de portée même si
  un motif est actif — comportement à confirmer avec l'utilisateur si
  ce n'est pas ce qu'il attendait.
- **Liste fermée** (une seule valeur) plutôt qu'un champ libre : plus
  simple à afficher/traiter uniformément ; ajouter une option future
  = une nouvelle migration qui étend la contrainte.

**Décisions — liste de courses en trois sections** :
- **Une colonne `section` sur `shopping_list_items`** (`dishes` | `extra`
  | `final`) plutôt que trois tables séparées : mêmes colonnes, mêmes
  écrans de lecture (Dexie, offline), seule la portée des requêtes
  change.
- **« Exporter » remplace, ne fusionne pas.** Une section exportée
  écrase dans la liste finale les lignes qu'elle y avait précédemment
  déposées (repérées par `origin_section`), pas celles de l'autre
  section. Ce choix rend un nouvel export idempotent après régénération
  du planning ou ajout d'un article supplémentaire (pas de doublons à
  chaque clic), au prix d'une limite acceptée : si le même ingrédient
  existe dans les deux sections, la liste finale garde deux lignes
  distinctes plutôt que de les fusionner. L'état coché d'un article
  encore présent (même ingrédient + unité) après un nouvel export est
  conservé, pour ne pas perdre « déjà chez nous » à chaque
  régénération.
- **Exporter une section vide est refusé** (message d'erreur) plutôt
  que d'effacer silencieusement les lignes déjà exportées de cette
  section dans la liste finale — évite une perte de données surprenante
  si on clique par erreur avant d'avoir rempli la section.
- **Le formulaire d'ajout est en haut de la page** (au-dessus du
  sélecteur de période), comme demandé explicitement, même si les
  articles ajoutés atterrissent dans la section « Courses
  supplémentaires » plus bas sur la page.
- **La case à cocher et « déjà chez nous » n'existent que dans la liste
  finale.** Les deux sections d'origine ne sont que des listes de
  préparation (retrait possible pour corriger une erreur, pas de
  cochage) — cocher un article n'a de sens qu'une fois dans la liste
  qu'on emmène faire les courses.
- **Génère/ajoute/exporte restent des actions en ligne**, comme
  l'était déjà « Générer la liste » : cohérent avec la contrainte
  produit « offline limité à la liste de courses [cochable] », pas une
  extension de son périmètre.
- **Corrigé au passage** : l'ancien index unique
  (`user_id, ingredient_id, period_start, period_end`) ne tenait compte
  ni de l'unité ni de la section — la nouvelle section l'aurait de
  toute façon fait exploser à l'insertion, et il empêchait déjà en
  théorie un même ingrédient dans deux unités différentes sur la même
  période. Remplacé (migration 0009) par un index incluant aussi `unit`
  et `section`.

**Migrations** : `0008_planned_meal_special.sql`,
`0009_shopping_list_sections.sql` (à appliquer sur la base de
production).

---

## 2026-09-20 — Collation, apports nutritionnels et affichage personnalisable du Planning

**Contexte** : demande de retirer la photo et le mot « Modèle » des cases
du Planning, d'ajouter un créneau Collation, des calories/protéines par
plat, et des cases à cocher pour masquer le petit-déjeuner/la collation
et afficher les totaux du jour.

**Décisions** :
- **Collation = nouvelle valeur de l'enum `meal_slot_type`** (migration
  0006, `add value 'snack' before 'dinner'`), et non un autre mécanisme :
  `planned_meals` et `meal_cycle_entries` l'acceptent sans autre
  changement, la répétition fonctionne donc aussi sur ce créneau.
- **Calories et protéines = deux colonnes nullables sur `dishes`**
  (migration 0007), pour une portion. `null` (non renseigné) est
  distingué de 0 : un total qui ignore un plat sans valeur est marqué
  « * » plutôt que présenté comme exact.
- **Les totaux du jour ne comptent que les créneaux affichés** : masquer
  le petit-déjeuner retire aussi ses calories du total, pour que la somme
  corresponde à ce que l'on voit.
- **Préférences d'affichage en `localStorage`** (par appareil), pas en
  base : ce sont des conforts d'affichage, pas des données à partager
  entre les deux comptes. Défaut : petit-déjeuner visible, collation et
  totaux masqués.
- **Repère « modèle » = cadre vert** (`.meal-cell-repeated`) au lieu du
  libellé « Modèle ». Explication conservée dans le texte d'aide de la
  barre « Répéter » et en infobulle.
- **Photo retirée du Planning** (cases et sélecteur de plat) : plus
  besoin de joindre `photo_url` aux requêtes du planning.

**Alternatives écartées** : stocker les préférences d'affichage en base
(surdimensionné pour 2 utilisateurs) ; une table d'apports séparée
(complexité inutile pour deux valeurs par plat) ; une somme par semaine
au lieu de par jour (la demande visait le total de chaque jour).

**Migrations** : `0006_snack_meal_slot.sql`, `0007_dish_nutrition.sql`
(à appliquer sur la base de production).

---

## 2026-09-18 — Boutons « Vider », navigation calendrier, et repas planifié "vide" (dish_id nullable)

**Contexte** : demande de deux fonctionnalités sur le Planning —
un bouton pour vider la semaine affichée ou tout le planning, et un
moyen plus rapide de naviguer entre les semaines qu'avec les flèches
prev/suivant.

**Bug découvert en implémentant "Vider cette semaine"** : retirer un
repas avec la portée « cette semaine seulement » pendant qu'un motif de
répétition est actif ne persistait pas. La ligne `planned_meals` était
supprimée, mais `ensurePatternApplied` (appelé à chaque chargement du
planning, y compris juste après l'action elle-même) considérait
l'emplacement comme "jamais rempli" et le regénérait aussitôt depuis le
motif. Le repas retiré réapparaissait donc au rechargement suivant.
C'était déjà vrai avant cette tâche (comportement du bouton « Retirer le
repas » existant), mais bloquant pour « Vider cette semaine », qui doit
justement fonctionner sur les cases issues du motif.

**Décision** :
- `planned_meals.dish_id` devient nullable (migration
  `0005_nullable_planned_meal_dish.sql`). Une ligne à `dish_id = null`
  représente une case **explicitement vidée** : elle occupe
  l'emplacement (date + repas) pour empêcher le motif de le remplir à
  nouveau, mais ne représente aucun repas réel.
- `fetchPlannedMeals` (et son équivalent démo) filtrent ces lignes
  avant de les renvoyer : le reste de l'app (UI, génération de liste de
  courses, snapshot d'un nouveau motif) ne les voit jamais, elles
  s'affichent comme une case vide normale.
- `applyCycleToRange`/`applyDemoCycleToRange` utilisent en interne une
  requête distincte (`fetchOccupiedSlots` / `fetchDemoOccupiedSlots`)
  qui, elle, voit ces lignes — pour savoir où ne pas réappliquer le
  motif.
- `setMealWithScope` (portée "cette semaine") pose une case vidée au
  lieu de supprimer la ligne **seulement si un motif est actif** ;
  sinon (pas de motif), suppression réelle comme avant — pas de ligne
  inutile à conserver.
- Nouvelles fonctions `clearWeek` (vide une semaine, y compris les
  cases du motif — équivaut à faire "cette semaine seulement" sur
  chaque case) et `clearAllWeeks` (supprime tous les repas planifiés,
  passés et futurs, et désactive le motif) dans
  `src/features/planning/repeat.ts`, exposées par deux boutons
  « Vider » (rouges, avec confirmation) dans le Planning.
- Navigation calendrier : `<input type="date">` natif dans l'en-tête du
  Planning (à côté de « Aujourd'hui »), qui saute à la semaine contenant
  la date choisie. Choix délibéré face à un composant calendrier
  personnalisé : aucune dépendance ajoutée, calendrier natif du
  navigateur, cohérent avec la contrainte de simplicité du projet.

**Pourquoi corriger le bug maintenant plutôt que le signaler seulement** :
la fonctionnalité demandée (« vider cette semaine, y compris les cases
du modèle ») ne pouvait pas être livrée correctement sans ce correctif
— sans lui, le bouton aurait semblé fonctionner puis silencieusement
« annulé » l'action au rechargement suivant.

**Réversibilité** : changement de schéma additif (colonne rendue
nullable, pas de perte de données). Un rollback nécessiterait de
vérifier qu'aucune ligne à `dish_id null` n'existe avant de remettre la
contrainte `not null`.

**Migration** : `supabase/migrations/0005_nullable_planned_meal_dish.sql`.

---

## 2026-09-18 — Fréquence libre du motif global + détection de chevauchement

**Contexte** : une première itération avait ajouté un second mécanisme
de répétition « par repas » (table `meal_repeats`, déclenché depuis une
case vide du planning). Retour utilisateur : ce n'est pas ce qui était
voulu — un seul mécanisme doit exister, celui du motif global, mais
avec une fréquence libre (« tous les combien de semaines », pas
seulement 1 ou 2) plutôt que deux boutons fixes. Le mécanisme
`meal_repeats` (table, colonne `planned_meals.meal_repeat_id`, étape de
choix de durée depuis une case vide) a donc été entièrement retiré au
profit de cette décision.

**Décision** :
- `meal_cycles.duration_days` acceptait déjà n'importe quel entier ; le
  code applicatif limitait artificiellement le choix à 1 ou 2 semaines
  (`RepeatInterval = 1 | 2`). Généralisé en `RepeatInterval = number`
  (entier positif, nombre de semaines). Aucune migration nécessaire.
- La barre « Répéter » du planning remplace les 3 boutons fixes par :
  bouton « Non », un champ numérique « Toutes les ⟨N⟩ semaine(s) », et
  un bouton « Activer »/« Mettre à jour ». Le motif est toujours
  snapshotté depuis la semaine visible (sur `N` semaines) puis répété
  indéfiniment, comme avant.
- Le badge « Modèle » (renommé depuis « répété » pour plus de clarté)
  et le rappel de la semaine de référence dans le panneau restent
  inchangés — ils s'appliquent à ce seul mécanisme désormais.
- **Détection de chevauchement** : avant d'activer/changer la
  fréquence, `findRepeatConflicts` (dans `repeat.ts`) scanne les
  semaines à venir (horizon de remplissage, 8 semaines) et repère les
  repas déjà planifiés à la main qui ne correspondent pas à ce que la
  nouvelle fréquence y placerait (même case, plat différent). S'il y en
  a, une confirmation liste les conflits (date, repas, plat) et demande
  à l'utilisateur de choisir une autre fréquence, ou de continuer pour
  les remplacer par le motif. `applyCycleToRange`/`applyDemoCycleToRange`
  reçoivent un paramètre `overwrite` pour ce cas précis (par défaut
  `false`, les cases déjà remplies ne sont jamais écrasées silencieusement).

**Pourquoi pas de mécanisme séparé par repas** : un seul système de
répétition est plus facile à expliquer et à maintenir en tête pour un
usage à 2 personnes ; la fréquence libre couvre le besoin exprimé
(« tous les combien de semaines ») sans dupliquer la logique de
motif/snapshot/propagation déjà en place pour `meal_cycles`.

**Migration** : aucune (le schéma supportait déjà une fréquence libre).
Le fichier `supabase/migrations/0004_dish_photos_and_meal_repeats.sql`
de la tentative précédente a été renommé
`supabase/migrations/0004_dish_photos.sql` et ne contient plus que
l'ajout de la photo de plat (voir décision suivante).

---

## 2026-09-18 — Photo de plat (Supabase Storage)

**Contexte** : demande d'afficher une photo par plat, visible aussi
sur les cases du planning.

**Décision** : bucket Supabase Storage dédié `dish-photos` (public en
lecture, écriture restreinte à l'utilisateur authentifié dans son
propre dossier), URL publique stockée dans `dishes.photo_url`. En mode
démo local (sans Supabase), la photo est encodée en base64 et stockée
directement dans le plat en `localStorage` (pas de vrai backend de
fichiers disponible en démo).

**Pourquoi Supabase Storage plutôt que base64 partout** : le tier
gratuit (1 Go) suffit largement pour quelques dizaines de plats, et
évite d'alourdir chaque lecture de la table `dishes` avec des blobs
base64 volumineux. Le mode démo garde une solution plus simple
(base64) car il n'a pas d'accès à un vrai stockage de fichiers.

**Impacts** :
- Nouvelle policy RLS sur `storage.objects` (lecture publique, écriture
  scoping par dossier = `user_id`).
- Suppression best-effort de l'ancien fichier quand une photo est
  remplacée ou retirée, pour ne pas accumuler des fichiers orphelins
  dans le bucket au fil du temps.

**Migration** : `supabase/migrations/0004_dish_photos.sql`.

---

## 2026-08-05 — Répétition depuis le Planning (plus d'onglet Cycles)

**Contexte** : l'onglet Cycles forçait à créer une ressource séparée
puis à l'appliquer au planning — incohérent avec l'intention « cette
semaine se répète ».

**Décision** :
- Supprimer l'onglet / UI Cycles.
- Un seul motif de répétition par utilisateur (`meal_cycles.user_id`
  unique), piloté depuis le Planning : Non / Chaque semaine / Toutes
  les 2 semaines.
- Activer = snapshot de la semaine visible (ou semaine + suivante si
  2 semaines) vers le motif, puis matérialisation des cases vides.
- À l'édition d'un créneau : demander « cette semaine seulement »
  (override, `meal_cycle_id` null) ou « toutes les semaines futures »
  (met à jour le motif + occurrences liées).

**Alternatives écartées** : garder plusieurs cycles nommés ; motifs
parallèles — trop complexes pour 2 utilisateurs.

**Migration** : `supabase/migrations/0003_single_repeat_pattern.sql`.

---

## 2026-08-02 — Distinction des repas de la journée

**Contexte** : fallait-il distinguer petit-déjeuner / déjeuner / dîner
dès le départ, ou traiter "un plat par jour" de façon générique.

**Décision** : ajout d'un champ `meal_slot` (enum Postgres
`breakfast` / `lunch` / `dinner`) sur `meal_cycle_entries` et
`planned_meals`.

**Pourquoi un ENUM plutôt qu'un TEXT libre** : garantit au niveau base
de données qu'aucune valeur invalide ne peut être insérée (évite les
bugs silencieux type faute de frappe créant un slot fantôme).

---

## 2026-08-02 — Pas d'intégration API supermarché

**Contexte** : la liste de courses pourrait potentiellement se
construire à partir d'une API de supermarché (prix, disponibilité,
etc.).

**Décision** : les ingrédients sont saisis manuellement une fois par
plat (comme le nom du plat), puis réutilisés et agrégés automatiquement
pour générer la liste de courses. Aucune intégration externe.

**Pourquoi** : usage à 2 personnes, complexité et coût d'une
intégration API totalement disproportionnés par rapport au besoin. Le
modèle de données (`dish_ingredients`) suffit largement.

---

## 2026-08-02 — Offline limité à la liste de courses

**Contexte** : fallait-il rendre toute l'application offline-first, ou
cibler uniquement les écrans qui en ont vraiment besoin.

**Décision** : seule la liste de courses est offline (lecture +
écriture via Dexie/IndexedDB avec file de synchronisation). Le reste de
l'app (plats, cycles, planning) suppose une connexion réseau.

**Alternative écartée** : offline-first généralisé sur toute l'app —
rejeté car complexité inutile pour un besoin qui ne concerne en
pratique que la liste de courses consultée au supermarché.

**Stratégie de conflit retenue** : dernière écriture gagne (last write
wins). Un mécanisme de résolution de conflit plus sophistiqué (CRDT,
etc.) serait disproportionné pour 2 utilisateurs.

---

## 2026-08-02 — PWA plutôt que publication App Store / Play Store

**Contexte** : l'app doit être installable sur mobile pour un usage
privé (2 personnes).

**Décision** : PWA installable sur l'écran d'accueil (iOS et Android),
pas de publication sur les stores.

**Pourquoi** :
- Apple Developer Program coûte 99$/an, Google Play 25$ (unique), avec
  un processus de review, pour un bénéfice nul en usage privé.
- Une PWA bien faite (manifest + service worker) s'installe en plein
  écran, avec icône, et fonctionne offline pour les parties qui en ont
  besoin — indiscernable d'une app native pour cet usage.

**Réversibilité** : si le besoin de présence sur les stores apparaît
plus tard, le code Next.js peut être empaqueté avec Capacitor sans
réécriture.

---

## 2026-08-02 — Supabase plutôt que Firebase

**Contexte** : besoin d'une base de données + authentification gérées,
sans avoir à opérer un serveur, pour un budget de 0€/mois.

**Décision** : Supabase (Postgres managé + Auth + API auto-générée).

**Pourquoi plutôt que Firebase** : le modèle de données du projet est
fortement relationnel (plats ↔ ingrédients ↔ cycles ↔ planning ↔ liste
de courses), avec des contraintes d'unicité et des jointures naturelles
— un vrai SQL (Postgres) est plus adapté et plus simple à faire évoluer
proprement qu'un modèle documents (Firestore).

**Tier gratuit suffisant** : 500 Mo de DB et 50k auth/mois, très
largement au-dessus du besoin pour 2 utilisateurs.

---

## 2026-08-02 — Pas de VM, pas d'infra cloud payante

**Contexte** : usage strictement privé (2 personnes), donc trafic quasi
nul.

**Décision** : pas de VM (EC2, Cloud Run, etc.) à opérer soi-même.
Stack 100% BaaS/PaaS gratuite : Vercel (frontend) + Supabase
(backend/DB).

**Pourquoi** : une VM impose une charge de maintenance (patchs de
sécurité, monitoring, scaling) disproportionnée par rapport au besoin
et au trafic réel. Les tiers gratuits de Vercel et Supabase couvrent
largement l'usage visé.

**Coût total** : 0€/mois (hors nom de domaine personnalisé optionnel,
~10€/an).

---

## 2026-08-02 — Next.js + TypeScript comme stack frontend

**Contexte** : choix du framework frontend pour une PWA évolutive.

**Décision** : Next.js (App Router) + TypeScript.

**Pourquoi** :
- TypeScript réduit les bugs et facilite la maintenance à long terme.
- Next.js permet de garder une seule base de code pour le web, tout en
  ouvrant la porte à un empaquetage natif (Capacitor) si besoin plus
  tard, sans réécriture.

---

## 2026-08-02 — Séparation modèle de cycle / planning réel

**Contexte** : comment représenter un cycle répétitif tout en
permettant de modifier ponctuellement un jour sans casser la
répétition future.

**Décision** : deux tables distinctes — `meal_cycle_entries` (le
modèle répétitif : jour relatif + repas + plat) et `planned_meals` (le
planning calendaire réel, avec référence optionnelle au cycle
d'origine).

**Pourquoi** : permet de générer automatiquement le planning depuis un
cycle, tout en autorisant un override ponctuel (ex: remplacer le plat
du jour 5) sans modifier le cycle pour les semaines suivantes.

---

## 2026-08-04 — Déploiement production Vercel + Supabase

**Contexte** : l'application avait atteint un état utilisable localement,
mais pour une vraie utilisation en production il fallait connecter le
frontend Vercel à un projet Supabase réel.

**Décision** : maintenir l'architecture actuelle avec un frontend Next.js
hébergé sur Vercel et un backend Supabase (Postgres + Auth) connecté via
les variables d'environnement `NEXT_PUBLIC_SUPABASE_URL` et
`NEXT_PUBLIC_SUPABASE_ANON_KEY`.

**Impacts** :
- Le frontend Vercel doit recevoir les valeurs Supabase via ses variables
  d'environnement de production.
- La migration SQL de `supabase/migrations/0001_init.sql` doit être
  appliquée sur la base Supabase utilisée par l'application.
- Le mot de passe de base de données présent dans `.env` est un secret de
  connexion DB, mais il n'est pas la clé publique attendue par le frontend.

**Pourquoi** : cette combinaison conserve un coût nul ou très faible,
permet un déploiement simple et reste compatible avec le mode démo
local en cas d'absence de configuration Supabase.

---

## 2026-08-03 — Mode démo local lorsque Supabase est absent

**Contexte** : en développement local il était gênant d'obliger la
présence d'un projet Supabase et de ses clés d'environnement pour
lancer l'application et la tester.

**Décision** : introduire un backend de démonstration local (`src/lib/localDemo.ts`)
et une gestion d'auth locale (`src/features/auth/localAuth.ts`) activés
automatiquement quand `getSupabase()` renvoie `null` (i.e. variables
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` non définies).

**Impacts** :
- Permet de lancer, tester et démo l'application sans accès à Supabase.
- Les comptes créés en mode démo sont stockés côté client (`localStorage`).
- La logique de synchronisation offline (Dexie + `syncQueue`) reste
  active pour la liste de courses ; en mode demo la génération de
  liste écrit aussi dans Dexie/local state.

**Alternatives écartées** : forcer la présence d'un fichier `.env.local`
ou fournir des valeurs par défaut stockées dans le repo (risque de fuite
de clés / mauvaise pratique).

**Réversibilité** : si des variables Supabase sont fournies, l'app bascule
automatiquement vers Supabase sans perte de code.

---

## 2026-08-03 — Gestion locale de la session et rafraîchissement UI

**Contexte** : après création d'un compte local, l'UI devait refléter la
nouvelle session immédiatement sans forcer un reload manuel.

**Décision** : exposer `onLocalAuthStateChange()` dans
`src/features/auth/localAuth.ts` et utiliser `router.replace('/')` depuis
le `LoginScreen` pour garantir que l'état d'auth est rechargé et
que la file de synchronisation (si nécessaire) est rejouée.

