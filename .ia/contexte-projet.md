# Contexte projet

Ce projet consiste à développer une application web et mobile (PWA)
permettant aux utilisateurs de planifier leurs repas de manière simple
et flexible.

## Objectif

Aider les utilisateurs à mieux s'organiser, réduire le temps passé à
réfléchir aux repas et faciliter les courses.

## Usage cible

Application privée, à usage strictement personnel : 2 utilisateurs
(un couple). Pas de vocation à être publiée publiquement ni à
accueillir d'autres foyers pour l'instant.

## Fonctionnalités principales

- Créer un planning de repas pour chaque jour, avec distinction entre
  petit-déjeuner, déjeuner, collation et dîner. Le petit-déjeuner et la
  collation peuvent être masqués depuis le panneau « Affichage » du
  Planning. Les cases issues de la répétition sont encadrées en vert.
- Sur une case du planning, choisir un repas « spécial » (ex. « Manger
  dehors ») à la place d'un plat : ne compte pas dans la liste de
  courses, ne fait jamais partie du motif de répétition.
- Rendre une semaine répétitive depuis le Planning, avec une fréquence
  libre choisie par l'utilisateur (« toutes les N semaines », pas
  seulement 1 ou 2). Pas d'onglet ni de ressource « Cycles » séparée —
  la répétition est un paramètre du planning. Lors d'une modification
  d'un repas précis, choisir entre cette semaine seulement ou le modèle
  pour toutes les semaines à venir. Si des repas sont déjà planifiés à
  la main sur des semaines à venir et entrent en conflit avec la
  fréquence choisie, l'utilisateur en est averti avant de valider (pour
  changer de fréquence, ou confirmer le remplacement).
- Enregistrer une semaine du Planning sous un nom (plats + jours/repas,
  repas spéciaux compris), puis s'en servir plus tard pour remplir une
  autre semaine : la semaine affichée est alors entièrement remplacée
  (après confirmation). Plusieurs semaines enregistrées possibles,
  supprimables ; indépendant de la répétition.
- Associer une photo (optionnelle) à un plat, visible sur sa fiche
  (écran Plats) ; le Planning n'affiche que le nom du plat.
- Renseigner (optionnellement) les calories et les protéines d'un plat,
  pour une portion. Le Planning peut afficher, pour chaque jour, la somme
  des calories et/ou des protéines des repas affichés.
- Associer une liste d'ingrédients à chaque plat. Les ingrédients sont
  saisis manuellement une fois par plat et réutilisés ensuite — pas
  d'intégration avec une API de supermarché.
- Générer automatiquement les ingrédients nécessaires pour les
  prochains jours ou les prochaines semaines (agrégation des
  ingrédients des plats planifiés sur une période).
- Permettre à l'utilisateur de vérifier ce qu'il lui manque avant de
  faire les courses (liste de courses cochable).
- L'écran Courses a deux onglets : « Depuis le planning » (générée
  depuis les plats planifiés sur une période choisie ; une nouvelle
  génération remplace la précédente) et « Courses supplémentaires »
  (ajout à la main, avec recherche parmi les ingrédients déjà utilisés
  — sinon création à la volée). Chaque article a une case à cocher :
  **coché = à acheter**, et il apparaît alors automatiquement dans la
  liste « À acheter » (plus de bouton d'export). Les articles générés
  ou ajoutés sont cochés par défaut ; on décoche ce qu'on a déjà.
  « À acheter » (en bas de l'écran Courses et sur son propre onglet)
  fusionne les articles cochés par ingrédient + unité ; y cocher un
  article le met « dans le panier », « ✕ » le décoche dans son onglet
  d'origine, « Vider » décoche tout. « À acheter » doit être
  consultable et modifiable hors-ligne (usage typique : au supermarché,
  sans réseau) ; générer/ajouter suppose une connexion réseau (comme le
  reste de l'app hors liste de courses).
- Rechercher un plat par son nom (ou sa description) depuis l'écran
  Plats, pour retrouver rapidement une recette au fur et à mesure que
  la liste s'agrandit.

## Contraintes

- Développement progressif, code propre, maintenable et facilement
  extensible.
- Budget cible : 0€/mois (voir `decisions.md` pour le raisonnement).
- Pas de présence sur l'App Store / Play Store dans un premier temps :
  la PWA installée sur l'écran d'accueil suffit à l'usage visé.

## Développement local et mode démo

- L'application peut désormais être lancée **sans configuration Supabase**
  : un backend local de démonstration est automatiquement utilisé lorsque
  `NEXT_PUBLIC_SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY` sont absents.
- Ce mode permet de créer des comptes locaux (stockés en `localStorage`),
  de gérer plats/planning (avec répétition) et de générer une liste de courses
  persistée localement. C'est un outil de développement et de démonstration
  — pour la production, Supabase reste le backend attendu.
- La version actuelle est également **déployée sur Vercel**. Pour passer
  d'un usage local à un usage réel, il faut renseigner les variables
  `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans
  Vercel, puis appliquer la migration SQL de `supabase/migrations/0001_init.sql`
  sur la base Supabase de production.

Ce document décrit le **besoin fonctionnel**. Les choix techniques et
leurs justifications sont dans `../decisions.md`. Les règles de travail
pour tout assistant IA intervenant sur ce projet sont dans `../agents.md`.
