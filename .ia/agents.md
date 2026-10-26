# Instructions pour les assistants IA

Ce fichier définit les règles de travail permanentes pour tout outil IA
(Claude, Claude Code, Cursor, Copilot, etc.) intervenant sur ce projet.
À lire avant toute contribution. En cas de conflit entre ce fichier et
une demande ponctuelle, demander confirmation plutôt que de trancher
silencieusement.

## Rôle attendu

Agir comme un développeur senior full-stack et architecte logiciel.

## Principes de conception

- Privilégier des solutions **simples, robustes et évolutives**.
- Éviter la complexité inutile : ne pas ajouter d'abstraction, de
  couche, ou de dépendance qui ne répond pas à un besoin concret et
  actuel du projet.
- Expliquer les choix techniques importants (pourquoi cette solution
  plutôt qu'une autre), pas seulement livrer du code.
- Proposer une architecture modulaire et maintenable (voir
  `.ia/architecture.md` pour l'existant).
- Respecter les bonnes pratiques : Clean Code, SOLID, séparation des
  responsabilités.
- Code lisible, documenté quand nécessaire (le "pourquoi", pas le
  "quoi"), et facile à tester.
- Ne pas introduire de dépendance sans nécessité réelle. Avant d'ajouter
  une librairie, vérifier qu'elle apporte une valeur qui ne se répond
  pas simplement avec ce qui existe déjà dans le projet.

## Avant de développer une fonctionnalité importante

1. Proposer rapidement l'approche retenue et les impacts éventuels
   (schéma de données, fichiers touchés, dépendances) avant d'écrire le
   code.
2. Si une décision de conception est ambiguë ou a plusieurs solutions
   raisonnables, **poser la question avant d'implémenter** plutôt que
   de choisir seul.
3. Une fois la fonctionnalité posée et un choix structurant fait,
   consigner la décision dans `decisions.md` (voir plus bas).

## Notes récentes (à lire)

- Le dépôt supporte désormais un **mode démo local** (fallback) lorsque
  les variables `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  ne sont pas fournies. Dans ce cas, l'application fonctionne entièrement
  en local (données stockées côté client) pour faciliter le développement
  et les démonstrations sans Supabase.
- La version actuelle a été **déployée sur Vercel**. Le frontend est
  accessible publiquement, mais la production réelle nécessite encore :
  - les variables `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    dans Vercel,
  - l'application de la migration SQL de `supabase/migrations/0001_init.sql`
    sur le projet Supabase utilisé en production,
  - l'activation de l'authentification email dans Supabase si nécessaire.
- Le mot de passe de base de données présent dans `.env` n'est pas la
  valeur à fournir à Vercel pour `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  Il sert à l'accès direct à la base, pas au client frontend.
- Le fallback est volontairement limité : il vise à rendre l'app utilisable
  localement (création de comptes locaux, gestion des plats, planning
  avec répétition et génération de liste). Les décisions structurantes liées à
  Supabase doivent être consignées dans `decisions.md`.
- **Pas d'onglet Cycles.** La répétition est un paramètre du Planning
  (chaque semaine / toutes les 2 semaines), avec un seul motif actif.
  Voir `decisions.md`.

## En modifiant du code existant

- Privilégier des **changements ciblés** plutôt qu'une réécriture
  complète, sauf demande explicite contraire.
- Ne pas renommer, déplacer ou restructurer du code sans lien avec la
  tâche demandée.

## Migrations SQL (`supabase/migrations/`)

- **Une migration déjà créée ne se modifie pas.** Une fois un fichier
  `NNNN_xxx.sql` ajouté au dépôt, il est considéré comme figé — même
  s'il n'a pas encore été appliqué à la base de production. Pour
  corriger ou compléter un schéma, créer un **nouveau** fichier
  `NNNN+1_xxx.sql` qui modifie ce qu'il faut (`alter table`, etc.),
  jamais éditer un fichier existant.
- Exception : si une migration vient d'être ajoutée **dans la même
  tâche, avant tout commit et avant d'avoir été signalée comme prête à
  appliquer**, elle peut encore être ajustée (on est en train de
  l'écrire, pas de la corriger après coup). Dès que la tâche est
  terminée / commitée, elle passe en figé.
- Raison : les migrations sont une séquence appliquée dans l'ordre sur
  la base réelle. Modifier un fichier déjà exécuté (ou que l'utilisateur
  croit déjà exécuté) désynchronise le schéma réel de l'historique du
  dépôt, sans que rien ne le signale.

## Déploiement et application des migrations (workflow automatisé)

Demandé explicitement par l'utilisateur le 2026-09-22 : reproduire ce
qu'il faisait à la main (un fichier par migration dans le SQL Editor de
Supabase, exécuté à chaque push) sans qu'il ait à le refaire lui-même.

- **Push sans demander confirmation.** Ce dépôt n'utilise ni branches
  ni PR : tout part directement sur `main` (Vercel redéploie
  automatiquement sur push, voir `.github/workflows/deploy-vercel.yml`).
  Une fois une tâche terminée et `.ia/` mis à jour, committer et
  `git push origin main` sans demander confirmation supplémentaire —
  l'autorisation est ici, permanente.
- **Appliquer directement sur la base de production tout fichier
  `supabase/migrations/NNNN_xxx.sql` ajouté dans la tâche**, dans la
  foulée du push, sans demander confirmation ni attendre que
  l'utilisateur le fasse lui-même dans le SQL Editor. Utiliser une
  connexion Postgres directe (voir ci-dessous), jamais de saisie
  manuelle demandée à l'utilisateur pour ce cas précis.
- **Ne jamais réappliquer une migration déjà exécutée** (cohérent avec
  la section « Migrations SQL » ci-dessus). Si l'exécution échoue à
  mi-chemin, signaler précisément où plutôt que de relancer tout le
  fichier ou d'improviser une correction.
- **Si la base n'est pas joignable** depuis l'environnement de
  l'assistant au moment de l'exécution, le dire clairement, laisser la
  ou les migrations non appliquées, et donner le SQL exact à coller
  dans le SQL Editor en secours pour ce cas précis — ne pas improviser
  une autre méthode risquée.

**Connexion à utiliser** : `SUPABASE_SESSION_POOLER_URI` dans `.env`
(chaîne du **Session pooler** Supabase/Supavisor — Project Settings →
Database → Connect → Session pooler). Fonctionne (testé le
2026-09-22) : contrairement à `SUPABASE_DB_URI` (connexion directe,
hôte `db.<ref>.supabase.co`, IPv6 uniquement — injoignable depuis un
environnement sans sortie IPv6), le pooler résout en IPv4. Préférer le
mode **Session** au mode **Transaction** pour des migrations (DDL) :
une session dédiée, pas de comportement surprenant de pgbouncer en
mode transaction.

**Alternative (testée le 2026-10-26)** : quand le connecteur Supabase
(MCP) est disponible dans la session, l'utiliser plutôt que la
connexion Postgres : projet `meal_planner` (ref `tueqwextvbtuojpfonov`),
`apply_migration` avec le contenu exact du fichier (nom = nom du fichier
sans `.sql`), vérification avant/après via `execute_sql` sur
`information_schema`. Les migrations 0001–0016 ont été appliquées à la
main : la table d'historique de Supabase ne commence qu'à 0017.

**Comment exécuter une migration** : pas de client Postgres dans les
dépendances du projet (`pg` n'est utile qu'à l'assistant, pas à
l'app — ne pas l'ajouter à `package.json`, voir « Principes de
conception »). Installer `pg` dans un dossier temporaire (scratchpad,
hors du dépôt), s'y connecter avec `SUPABASE_SESSION_POOLER_URI` et
`ssl: { rejectUnauthorized: false }`, exécuter le contenu du fichier
`.sql` dans une transaction (`BEGIN`/`COMMIT`, `ROLLBACK` si erreur).
Vérifier avant/après via `information_schema.columns` /
`pg_constraint` / `pg_indexes` que les objets attendus n'existaient pas
puis existent, plutôt que de supposer que ça a marché. Supprimer le
dossier temporaire une fois fait.

## Contraintes produit à respecter (ne pas remettre en cause sans le signaler)

- **Usage privé, 2 utilisateurs** (un couple). Pas de gestion multi-
  foyers, pas de séparation de données par utilisateur : les données
  sont partagées entre les deux comptes.
- **Budget cible : 0€/mois.** Ne pas proposer de service payant sans le
  signaler explicitement et expliquer pourquoi le gratuit ne suffit
  plus.
- **Pas d'API de supermarché.** Les ingrédients sont saisis
  manuellement une fois par plat, puis réutilisés. Aucune intégration
  externe pour la liste de courses.
- **PWA uniquement**, pas de publication App Store / Play Store pour
  l'instant (voir `decisions.md`).
- **Offline limité à la liste de courses.** Le reste de l'application
  (création de plats, planning) suppose une connexion réseau.
  Ne pas étendre l'offline à d'autres écrans sans discussion préalable.
- **Un seul motif de répétition**, piloté depuis le Planning — pas de
  ressource / onglet « Cycles » séparé. Ne pas réintroduire des cycles
  nommés multiples sans discussion.
- **Stratégie de conflit de synchronisation : dernière écriture gagne.**
  Ne pas introduire de système de résolution de conflit plus complexe
  (CRDT, etc.) sans besoin démontré.

## Stack déjà décidée (ne pas changer sans discussion)

- Next.js (App Router) + TypeScript
- Supabase (Postgres + Auth)
- Dexie (IndexedDB) pour l'offline
- Serwist pour le service worker PWA
- Vercel pour l'hébergement

Voir `decisions.md` pour le détail et les alternatives déjà écartées.

## Documents de référence

- `README.md` — vue d'ensemble et mise en route.
- `.ia/contexte-projet.md` — besoin fonctionnel.
- `.ia/architecture.md` — architecture technique détaillée.
- `.ia/workflow-ia.md` — procédure de mise à jour du dossier `.ia/`
  après chaque fonctionnalité.
- `decisions.md` — historique des choix techniques et pourquoi.
- `supabase/migrations/` — schéma de base de données, source de vérité
  du modèle de données.

## Tenue à jour de ce dossier

Toute décision structurante (choix de librairie, changement de schéma,
nouvelle contrainte produit) doit être ajoutée à `decisions.md` au
moment où elle est prise, pas après coup. Si le périmètre fonctionnel
change, mettre à jour `.ia/contexte-projet.md` en conséquence.

**Après chaque fonctionnalité développée, le dossier `.ia/` doit être
mis à jour avant de considérer la tâche terminée.** Voir
`.ia/workflow-ia.md` pour la procédure détaillée (quel fichier mettre
à jour, et quand).
