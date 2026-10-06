-- Vue « Mois » du planning : chaque semaine de la rotation (le motif de
-- répétition, `duration_days` = 7 × nombre de semaines) a une couleur
-- qui la suit quand on réordonne la rotation. `week_colors[i]` = indice
-- de palette de la i-ème semaine depuis `start_date`. Null = couleurs
-- par défaut (0, 1, 2…), comme pour les rotations créées avant.
alter table meal_cycles add column if not exists week_colors smallint[];
