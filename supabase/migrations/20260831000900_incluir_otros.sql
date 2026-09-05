-- Bitácora de Mamá · Incluir los «Otro» en la lista recomendada
--
-- La precarga los dejaba fuera por considerarlos placeholders. Pero son
-- justamente el hueco para lo que el catálogo no cubre: sin ellos, una familia
-- que compra algo fuera de la lista no tiene dónde apuntarlo dentro de su
-- categoría. Se incluyen, nombrados con su categoría para que no aparezcan
-- trece filas idénticas llamadas «Otro».
--
-- «Llegada a casa» sigue fuera: sus ítems son comprobaciones («Cuarto listo»),
-- no compras, y viven en la pestaña de checklists.

create or replace function precargar_sugerencias(p_project_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_insertados int;
begin
  if not is_project_member(p_project_id) then
    raise exception 'No tienes acceso a esta bitácora';
  end if;

  insert into products (project_id, name, qrh_code, item_code, qty, status, stage)
  select
    p_project_id,
    case
      when i.is_placeholder then 'Otro — ' || q.name_es
      else coalesce(i.name_es, i.name_en)
    end,
    i.qrh_code,
    i.code,
    greatest(i.default_qty_needed, 1),
    'suggested',
    null
  from checklist_items i
  join qrh_categories q on q.code = i.qrh_code
  where q.preload
    and not i.is_bundle
    -- Idempotente: si ya se precargó, no duplica.
    and not exists (
      select 1 from products p
      where p.project_id = p_project_id and p.item_code = i.code
    )
  order by q.sort_order, i.sort_order;

  get diagnostics v_insertados = row_count;
  return v_insertados;
end $$;

revoke all on function precargar_sugerencias(uuid) from public;
grant execute on function precargar_sugerencias(uuid) to authenticated;
