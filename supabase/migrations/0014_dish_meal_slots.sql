-- Catégories d'un plat : les repas pour lesquels il est proposé dans le
-- planning (petit-déjeuner, déjeuner, collation, dîner). Un plat peut en
-- avoir plusieurs (ex. du poisson : déjeuner et dîner). On réutilise
-- `meal_slot_type` : une catégorie correspond exactement à un créneau
-- du planning.
--
-- Les plats existants (et tout plat inséré sans préciser ses
-- catégories) deviennent « déjeuner + dîner ».
alter table dishes
  add column if not exists meal_slots meal_slot_type[] not null default '{lunch,dinner}';

alter table dishes add constraint dishes_meal_slots_not_empty
  check (cardinality(meal_slots) >= 1);
