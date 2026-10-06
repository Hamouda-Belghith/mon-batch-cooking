-- Réglages d'un utilisateur, une ligne par compte (créée à la première
-- modification ; absente = valeurs par défaut côté application).
-- Pour l'instant : le nom de l'onglet « Courses supplémentaires »,
-- modifiable en cliquant dessus dans l'écran Courses.
create table if not exists user_settings (
  user_id uuid primary key,
  extra_list_name text not null
    check (char_length(btrim(extra_list_name)) between 1 and 60),
  updated_at timestamptz not null default now()
);

alter table user_settings enable row level security;

create policy "authenticated_full_access" on user_settings
  for all
  using (auth.role() = 'authenticated' and user_id = auth.uid())
  with check (auth.role() = 'authenticated' and user_id = auth.uid());
