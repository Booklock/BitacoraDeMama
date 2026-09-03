-- Bitácora de Mamá · La lista recomendada, precargada
--
-- La base del producto es que una mamá abra la app y YA vea la lista completa
-- de lo que suele hacer falta, en vez de una pantalla en blanco. Al crear una
-- bitácora se precargan los ítems del catálogo como «sugeridos».
--
-- «Sugerido» es un estado propio, no un pendiente: la app lo propuso, la
-- familia todavía no ha decidido nada. Por eso no cuenta como gasto ni aparece
-- en la lista de regalos de la familia — llenar la lista de los abuelos con 158
-- productos sin precio la haría inútil.

-- El valor nuevo se puede añadir dentro de una transacción, pero Postgres no
-- deja USARLO hasta que se confirme. Por eso las funciones de abajo son
-- PL/pgSQL: su cuerpo no se valida al crearlas.
alter type product_status add value if not exists 'suggested';

-- ---------------------------------------------------------------------------
-- Qué se precarga y qué no
-- ---------------------------------------------------------------------------
alter table qrh_categories  add column if not exists preload        boolean not null default true;
alter table checklist_items add column if not exists is_bundle      boolean not null default false;
alter table checklist_items add column if not exists is_placeholder boolean not null default false;

-- «Llegada a casa» son comprobaciones, no compras: "Cuarto listo", "Silla de
-- auto instalada". No tienen sitio en un inventario.
update qrh_categories set preload = false where code = 'QRH-012';

-- Los combos duplican a los ítems que satisfacen. Tener a la vez "Monitor" y
-- "Monitor con Termómetro (Ambos)" en la lista de la compra confunde; el combo
-- sigue existiendo en el checklist para quien lo compre.
update checklist_items i set is_bundle = true
where exists (
  select 1 from item_satisfied_by s
  where s.source_item_code = i.code and s.item_code <> i.code
);

-- "Otro" es un hueco para lo que no encaje, no un producto.
update checklist_items set is_placeholder = true where name_en = 'Other';

-- ---------------------------------------------------------------------------
-- La precarga
-- ---------------------------------------------------------------------------
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
    coalesce(i.name_es, i.name_en),
    i.qrh_code,
    i.code,
    greatest(i.default_qty_needed, 1),
    'suggested',
    null
  from checklist_items i
  join qrh_categories q on q.code = i.qrh_code
  where q.preload
    and not i.is_bundle
    and not i.is_placeholder
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
