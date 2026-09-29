-- La liste « À acheter » n'est plus une section stockée remplie par des
-- boutons d'export : elle est calculée à partir des articles COCHÉS des
-- sections « dishes » (depuis le planning) et « extra » (courses
-- supplémentaires). `is_checked` change donc de sens sur ces sections :
-- coché = à acheter.
--
-- `is_bought` : l'article a été mis dans le panier (case cochée sur
-- l'écran « À acheter », au supermarché). Distinct de `is_checked`,
-- qui dit seulement que l'article fait partie de la liste.
alter table shopping_list_items add column if not exists is_bought boolean not null default false;

-- Jusqu'ici, les sections « dishes » et « extra » n'avaient pas de case
-- à cocher (is_checked toujours false). Par défaut, un article ajouté
-- ou généré est à acheter : on les coche tous, pour que « À acheter »
-- ne soit pas vide au premier chargement.
update shopping_list_items set is_checked = true where section in ('dishes', 'extra');

-- « Depuis le planning » devient une seule liste (la dernière générée)
-- au lieu d'une liste par période : sinon « À acheter » additionnerait
-- les articles d'anciennes périodes. On ne garde que la période la plus
-- récemment générée par utilisateur.
with latest as (
  select distinct on (user_id) user_id, period_start, period_end
  from shopping_list_items
  where section = 'dishes'
  order by user_id, updated_at desc
)
delete from shopping_list_items s
using latest l
where s.section = 'dishes'
  and s.user_id is not distinct from l.user_id
  and (s.period_start, s.period_end) is distinct from (l.period_start, l.period_end);

-- L'ancienne section « final » n'a plus d'usage.
delete from shopping_list_items where section = 'final';
alter table shopping_list_items drop constraint if exists shopping_list_items_section_check;
alter table shopping_list_items add constraint shopping_list_items_section_check
  check (section in ('dishes', 'extra'));
