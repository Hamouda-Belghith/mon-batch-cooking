-- 0019 — Harmonisation des noms existants (données).
--
-- 1. Ingrédients : chaque ingrédient saisi à la main prend le nom du
--    catalogue (`src/features/ingredients/catalog.ts`), dans tous les
--    comptes. Correspondances calculées le 2026-11-17 par l'algorithme de
--    l'application (`features/ingredients/matching.ts`) sur les noms en
--    base, validées par l'utilisateur ; deux correspondances partielles
--    ajoutées à sa demande (« l7am ou poulet », « patate douce kbira »).
--    Les doublons d'un même compte (« bsal », « Bsal », « onion ») sont
--    fusionnés par rename_ingredient (0018). Non touchés : « ´ », « abc »
--    (aucune correspondance).
-- 2. Plats : doublons d'un même compte retirés (même nom à l'écriture
--    près). On garde le plat le plus utilisé (planning, cycle, semaines
--    enregistrées), puis celui qui a le plus d'ingrédients ; le planning
--    est rebranché dessus et ses catégories complétées. Aucun plat n'est
--    renommé vers le catalogue : seulement mis en forme (espaces,
--    majuscule initiale), comme le fait désormais l'application.
-- 3. Index uniques insensibles à la casse sur les noms d'ingrédients et de
--    plats d'un même compte : filet de sécurité contre les nouveaux doublons.

do $$
declare
  r record;
begin
  for r in
    select i.id, m.new_name
    from public.ingredients i
    join (values
      ('ail', 'Ail'),
      ('aubergine', 'Aubergine'),
      ('baby potatoe', 'Pomme de terre grenaille'),
      ('banane', 'Banane'),
      ('barquette', 'Barquettes alimentaires'),
      ('beterave', 'Betterave'),
      ('betterave', 'Betterave'),
      ('beurre', 'Beurre'),
      ('Beurre cacahouète', 'Beurre de cacahuète'),
      ('bouratta', 'Burrata'),
      ('bsal', 'Oignon'),
      ('Bsal', 'Oignon'),
      ('Cacao', 'Cacao en poudre'),
      ('Café capsule', 'Capsules de café'),
      ('Café grain', 'Café en grains'),
      ('cajou', 'Noix de cajou'),
      ('carotte', 'Carotte'),
      ('celery', 'Céleri'),
      ('Champignion', 'Champignon'),
      ('chapelure', 'Chapelure'),
      ('cheveux d''ange', 'Cheveux d''ange'),
      ('citron', 'Citron'),
      ('cotelette', 'Côtelettes d''agneau'),
      ('Creme fraiche', 'Crème fraîche'),
      ('creme liquide', 'Crème liquide'),
      ('crevette', 'Crevettes'),
      ('dindon', 'Rôti de dinde'),
      ('djej', 'Poulet'),
      ('Djej', 'Poulet'),
      ('dorade', 'Dorade'),
      ('emmental', 'Emmental'),
      ('epinard', 'Épinards'),
      ('épinards', 'Épinards'),
      ('escalope', 'Escalope de poulet'),
      ('Escalope', 'Escalope de poulet'),
      ('fakous', 'Concombre'),
      ('farine', 'Farine'),
      ('fecule de pomme de terre', 'Fécule de pomme de terre'),
      ('felfel', 'Piment vert'),
      ('felfel bar abid', 'Felfel bar abid'),
      ('frite', 'Frites surgelées'),
      ('fromage', 'Fromage râpé'),
      ('Gant four', 'Gant de four'),
      ('gingembre', 'Gingembre frais'),
      ('glacon', 'Glaçons'),
      ('Granula', 'Granola'),
      ('homs', 'Pois chiches'),
      ('hout', 'Poisson'),
      ('huile de sesame', 'Huile de sésame'),
      ('jben', 'Fromage frais'),
      ('jeune pousse', 'Jeunes pousses'),
      ('jus', 'Jus de fruits'),
      ('kebda', 'Foie d''agneau'),
      ('khobz', 'Pain'),
      ('kosksi', 'Couscous'),
      ('l7am', 'Bœuf en morceaux'),
      ('l7am habra', 'Viande sans os (habra)'),
      ('l7am ou poulet', 'Bœuf en morceaux'),
      ('lait', 'Lait'),
      ('Lait amande', 'Lait d''amande'),
      ('laitue', 'Salade verte'),
      ('lasagne', 'Feuilles de lasagne'),
      ('levure chimique', 'Levure chimique'),
      ('loubya', 'Haricots blancs'),
      ('noisette', 'Noisettes'),
      ('oeufs', 'Œufs'),
      ('onion', 'Oignon'),
      ('orange', 'Orange'),
      ('patate douce', 'Patate douce'),
      ('patate douce kbira', 'Patate douce'),
      ('patate douche', 'Patate douce'),
      ('pate', 'Pâtes'),
      ('pate feuilleté', 'Pâte feuilletée'),
      ('pate makloub', 'Pâte à pain'),
      ('persil', 'Persil'),
      ('pillon', 'Pilons de poulet'),
      ('pois chiche', 'Pois chiches'),
      ('poivre', 'Poivre noir'),
      ('poivron', 'Poivron'),
      ('pomme de terre', 'Pomme de terre'),
      ('poulet', 'Poulet'),
      ('riz', 'Riz'),
      ('sac poubelle', 'Sacs poubelle'),
      ('Sac poubelle', 'Sacs poubelle'),
      ('sacs poubelle', 'Sacs poubelle'),
      ('salade', 'Salade verte'),
      ('sauce soja', 'Sauce soja'),
      ('sauce tomate', 'Sauce tomate'),
      ('saumon', 'Saumon'),
      ('sel', 'Sel'),
      ('tahina', 'Tahini'),
      ('thon', 'Thon en conserve'),
      ('tmatem', 'Tomate'),
      ('tomate', 'Tomate'),
      ('tomate cerise', 'Tomate cerise'),
      ('tomate concentré', 'Concentré de tomate'),
      ('tomates', 'Tomate'),
      ('vaiselle', 'Liquide vaisselle'),
      ('variante', 'Variantes'),
      ('viande hachée', 'Viande hachée'),
      ('viande jarret', 'Jarret de bœuf'),
      ('yaourt', 'Yaourt')
    ) as m(old_name, new_name) on i.name = m.old_name
    order by i.created_at, i.id
  loop
    perform public.rename_ingredient(r.id, r.new_name);
  end loop;
end $$;

do $$
declare
  g record;
  keep record;
  dup record;
begin
  -- Groupes de doublons repérés par l'application (même clé de nom).
  for g in
    select d.user_id, m.grp
    from public.dishes d
    join (values
      (1, 'pate au saumon'), (1, 'pate saumon'),
      (2, 'cheveux d''ange')
    ) as m(grp, name) on d.name = m.name
    group by d.user_id, m.grp
    having count(*) > 1
  loop
    select d.* into keep
    from public.dishes d
    join (values
      (1, 'pate au saumon'), (1, 'pate saumon'),
      (2, 'cheveux d''ange')
    ) as m(grp, name) on d.name = m.name and m.grp = g.grp
    where d.user_id is not distinct from g.user_id
    order by
      (select count(*) from public.planned_meals p where p.dish_id = d.id)
      + (select count(*) from public.meal_cycle_entries e where e.dish_id = d.id)
      + (select count(*) from public.saved_week_entries s where s.dish_id = d.id)
      + (select count(*) from public.meal_repeats x where x.dish_id = d.id) desc,
      (select count(*) from public.dish_ingredients di where di.dish_id = d.id) desc,
      d.created_at
    limit 1;

    for dup in
      select d.*
      from public.dishes d
      join (values
        (1, 'pate au saumon'), (1, 'pate saumon'),
        (2, 'cheveux d''ange')
      ) as m(grp, name) on d.name = m.name and m.grp = g.grp
      where d.user_id is not distinct from g.user_id and d.id <> keep.id
    loop
      update public.planned_meals set dish_id = keep.id where dish_id = dup.id;
      update public.meal_cycle_entries set dish_id = keep.id where dish_id = dup.id;
      update public.saved_week_entries set dish_id = keep.id where dish_id = dup.id;
      update public.meal_repeats set dish_id = keep.id where dish_id = dup.id;
      update public.dishes
      set meal_slots = array(
            select s from unnest(meal_slots || dup.meal_slots) as s group by s order by s
          ),
          description = coalesce(description, dup.description),
          photo_url = coalesce(photo_url, dup.photo_url)
      where id = keep.id;
      delete from public.dishes where id = dup.id;
    end loop;
  end loop;
end $$;

update public.dishes d
set name = upper(left(f.compact, 1)) || substr(f.compact, 2)
from (
  select id, btrim(regexp_replace(name, '\s+', ' ', 'g')) as compact from public.dishes
) as f
where d.id = f.id
  and d.name <> upper(left(f.compact, 1)) || substr(f.compact, 2);

create unique index if not exists idx_ingredients_user_id_lower_name
  on public.ingredients (user_id, lower(name));
create unique index if not exists idx_dishes_user_id_lower_name
  on public.dishes (user_id, lower(name));
