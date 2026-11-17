-- 0018 — Noms harmonisés : renommage d'un ingrédient partout, et cuisines
-- des plats suggérés.
--
-- 1. user_settings.dish_cuisines : cuisines dont l'application propose des
--    plats (catalogue `src/features/dishes/catalog.ts`). NULL = toutes.
-- 2. rename_ingredient(id, nouveau_nom) : renomme un ingrédient dans tous
--    les plats et la liste de courses. Si l'utilisateur a déjà un
--    ingrédient de ce nom (casse ignorée), les deux sont fusionnés en une
--    seule transaction : lignes de plats et articles de courses rebranchés
--    sur l'ingrédient existant, quantités additionnées quand une même ligne
--    existait des deux côtés, puis l'ancien ingrédient supprimé.
--    SECURITY INVOKER : les règles RLS de l'appelant s'appliquent.

alter table public.user_settings
  add column if not exists dish_cuisines text[]
  constraint user_settings_dish_cuisines_check check (
    dish_cuisines is null
    or (
      cardinality(dish_cuisines) >= 1
      and dish_cuisines <@ array['tunisienne', 'classique', 'monde']::text[]
    )
  );

create or replace function public.rename_ingredient(p_ingredient_id uuid, p_new_name text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_new_name, ''), '\s+', ' ', 'g'));
  v_source public.ingredients%rowtype;
  v_target_id uuid;
  r record;
begin
  if v_name = '' then
    raise exception 'Le nouveau nom de l''ingrédient est vide';
  end if;

  select * into v_source from public.ingredients where id = p_ingredient_id for update;
  if not found then
    raise exception 'Ingrédient introuvable';
  end if;

  -- Ingrédient du même utilisateur qui porte déjà ce nom (le nom exact d'abord).
  select id into v_target_id
  from public.ingredients
  where user_id is not distinct from v_source.user_id
    and id <> v_source.id
    and lower(name) = lower(v_name)
  order by (name = v_name) desc, created_at
  limit 1;

  if v_target_id is null then
    update public.ingredients set name = v_name where id = v_source.id;
    return v_source.id;
  end if;

  -- Plats qui contiennent déjà l'ingrédient cible : une seule ligne
  -- (unique dish_id + ingredient_id), quantités additionnées si même unité.
  for r in
    select s.id as source_line, t.id as target_line, s.quantity, s.unit, t.unit as target_unit
    from public.dish_ingredients s
    join public.dish_ingredients t
      on t.dish_id = s.dish_id and t.ingredient_id = v_target_id
    where s.ingredient_id = v_source.id
  loop
    if r.unit = r.target_unit then
      update public.dish_ingredients set quantity = quantity + r.quantity where id = r.target_line;
    end if;
    delete from public.dish_ingredients where id = r.source_line;
  end loop;
  update public.dish_ingredients set ingredient_id = v_target_id where ingredient_id = v_source.id;

  -- Liste de courses : même article (utilisateur, unité, période, section)
  -- des deux côtés → une seule ligne, quantités additionnées.
  for r in
    select s.id as source_line, t.id as target_line, s.quantity, s.is_checked, s.is_bought
    from public.shopping_list_items s
    join public.shopping_list_items t
      on t.ingredient_id = v_target_id
     and t.user_id is not distinct from s.user_id
     and t.unit = s.unit
     and t.section = s.section
     and t.period_start is not distinct from s.period_start
     and t.period_end is not distinct from s.period_end
    where s.ingredient_id = v_source.id
  loop
    update public.shopping_list_items
    set quantity = quantity + r.quantity,
        is_checked = is_checked or r.is_checked,
        is_bought = is_bought and r.is_bought,
        updated_at = now()
    where id = r.target_line;
    delete from public.shopping_list_items where id = r.source_line;
  end loop;
  update public.shopping_list_items
  set ingredient_id = v_target_id, updated_at = now()
  where ingredient_id = v_source.id;

  delete from public.ingredients where id = v_source.id;
  update public.ingredients set name = v_name where id = v_target_id and name <> v_name;
  return v_target_id;
end;
$$;

revoke all on function public.rename_ingredient(uuid, text) from public, anon;
grant execute on function public.rename_ingredient(uuid, text) to authenticated;
