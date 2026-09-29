-- Semaines enregistrées : un « modèle » de semaine (plats choisis et
-- leur jour/repas) qu'on peut réutiliser plus tard pour remplir une
-- semaine du planning. Indépendant du motif de répétition
-- (meal_cycles) : on peut en avoir plusieurs, et les appliquer ne
-- crée aucun lien entre la semaine remplie et le modèle.
create table if not exists saved_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_saved_weeks_user on saved_weeks (user_id);

-- day_offset : 0 = lundi … 6 = dimanche. Une entrée a soit un plat,
-- soit un repas spécial (même règle que planned_meals, voir 0008).
-- Supprimer un plat supprime ses entrées dans les semaines enregistrées.
create table if not exists saved_week_entries (
  id uuid primary key default gen_random_uuid(),
  saved_week_id uuid not null references saved_weeks(id) on delete cascade,
  day_offset smallint not null check (day_offset between 0 and 6),
  meal_slot meal_slot_type not null,
  dish_id uuid references dishes(id) on delete cascade,
  special text check (special is null or special in ('eating_out')),
  check ((dish_id is null) <> (special is null)),
  unique (saved_week_id, day_offset, meal_slot)
);

alter table saved_weeks enable row level security;
alter table saved_week_entries enable row level security;

create policy "authenticated_full_access" on saved_weeks
  for all
  using (auth.role() = 'authenticated' and user_id = auth.uid())
  with check (auth.role() = 'authenticated' and user_id = auth.uid());

create policy "authenticated_full_access" on saved_week_entries
  for all
  using (
    auth.role() = 'authenticated' and exists (
      select 1
      from saved_weeks sw
      where sw.id = saved_week_entries.saved_week_id
        and sw.user_id = auth.uid()
    )
  )
  with check (
    auth.role() = 'authenticated' and exists (
      select 1
      from saved_weeks sw
      where sw.id = saved_week_entries.saved_week_id
        and sw.user_id = auth.uid()
    )
  );
