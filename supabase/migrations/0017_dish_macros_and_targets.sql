-- Apports complets d'un plat et objectifs nutritionnels par compte.
--
-- 1. `dishes` : glucides et lipides (pour une portion), à côté des
--    calories et protéines de 0007. `null` = non renseigné, distinct
--    de 0, comme pour les autres apports.
--    `nutrition_estimated` = les apports ont été calculés par
--    l'application à partir du nom du plat (estimation à vérifier),
--    et non saisis à la main.
-- 2. `user_settings` : objectifs journaliers (kcal, protéines,
--    glucides, lipides), propres à chaque compte. `null` = pas
--    d'objectif pour cet apport.
--    `extra_list_name` reçoit une valeur par défaut, pour qu'une ligne
--    de réglages puisse être créée en enregistrant d'abord des
--    objectifs (sans avoir renommé l'onglet des courses).

alter table dishes add column if not exists carbs_g numeric(6, 1) check (carbs_g >= 0);
alter table dishes add column if not exists fat_g numeric(6, 1) check (fat_g >= 0);
alter table dishes add column if not exists nutrition_estimated boolean not null default false;

alter table user_settings
  alter column extra_list_name set default 'Courses supplémentaires';

alter table user_settings add column if not exists target_kcal integer
  check (target_kcal > 0);
alter table user_settings add column if not exists target_protein_g numeric(6, 1)
  check (target_protein_g > 0);
alter table user_settings add column if not exists target_carbs_g numeric(6, 1)
  check (target_carbs_g > 0);
alter table user_settings add column if not exists target_fat_g numeric(6, 1)
  check (target_fat_g > 0);

-- Prise en compte immédiate des nouvelles colonnes par l'API (PostgREST).
notify pgrst, 'reload schema';
