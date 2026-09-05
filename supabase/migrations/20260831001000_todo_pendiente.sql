-- Bitácora de Mamá · La lista precargada nace en «Pendiente»
--
-- «Sugerido» era un estado intermedio que separaba lo que propuso la app de lo
-- que la familia decidió. En la práctica confunde: quien abre su bitácora por
-- primera vez espera ver todo pendiente por comprar, no en un limbo. Se unifica
-- en «Pendiente» y la familia va cambiando cada cosa a medida que decide.
--
-- El motivo por el que existía «Sugerido» sigue siendo real: 165 productos sin
-- precio inundarían la lista de regalos de los abuelos. Eso se resuelve abajo
-- con una regla mejor —y más honesta— que un estado aparte.

-- Lo ya precargado pasa a pendiente.
--
-- El filtro compara contra TEXTO, no contra el literal del enum: en una
-- instalación desde cero el valor «suggested» se añade en esta misma
-- transacción, y Postgres no deja usarlo hasta que se confirme. Comparar
-- status::text esquiva esa restricción y funciona en los dos casos.
update products set status = 'pending' where status::text = 'suggested';

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
    'pending',
    null
  from checklist_items i
  join qrh_categories q on q.code = i.qrh_code
  where q.preload
    and not i.is_bundle
    and not exists (
      select 1 from products p
      where p.project_id = p_project_id and p.item_code = i.code
    )
  order by q.sort_order, i.sort_order;

  get diagnostics v_insertados = row_count;
  return v_insertados;
end $$;

/**
 * La lista de regalos pasa a exigir precio.
 *
 * Antes bastaba con estar pendiente, y eso funcionaba porque la precarga usaba
 * un estado aparte. Ahora que todo nace pendiente, sin esta regla la abuela
 * abriría el enlace y vería 165 filas en blanco.
 *
 * Un producto sin precio tampoco es un regalo que alguien pueda evaluar: no
 * sabe cuánto cuesta ni dónde está. Poner el precio es la señal de que la
 * familia ya lo investigó y de verdad lo quiere.
 */
create or replace function ver_lista_regalos(p_token text)
returns table (
  id               uuid,
  name             text,
  brand            text,
  store            text,
  url              text,
  price            numeric,
  currency_code    text,
  qty              int,
  qrh_name         text,
  item_name        text,
  reserved_by_name text,
  reserved_at      timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_project_id uuid := proyecto_de_enlace(p_token);
begin
  if v_project_id is null then
    raise exception 'Ese enlace no existe o fue revocado';
  end if;

  return query
    select p.id, p.name, p.brand, p.store, p.url, p.price, p.currency_code, p.qty,
           q.name_es, coalesce(i.name_es, i.name_en),
           p.reserved_by_name, p.reserved_at
    from products p
    left join qrh_categories  q on q.code = p.qrh_code
    left join checklist_items i on i.code = p.item_code
    where p.project_id = v_project_id
      and p.status in ('pending', 'wishlist')
      and p.price is not null
    order by p.reserved_at nulls first, p.created_at;
end $$;

/**
 * Volver a empezar: borra el inventario y deja la lista recomendada limpia.
 * Pensado para la beta, cuando una bitácora se llenó de pruebas.
 */
create or replace function reiniciar_inventario(p_project_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_project_owner(p_project_id) then
    raise exception 'Sólo quien creó la bitácora puede reiniciarla';
  end if;

  delete from products        where project_id = p_project_id;
  delete from checklist_states where project_id = p_project_id;

  return precargar_sugerencias(p_project_id);
end $$;

revoke all on function reiniciar_inventario(uuid) from public;
grant execute on function reiniciar_inventario(uuid) to authenticated;
