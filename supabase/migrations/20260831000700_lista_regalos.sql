-- Bitácora de Mamá · Lista de regalos para la familia
--
-- Dos formas distintas de compartir una bitácora:
--
--   pareja  → cuenta propia, ve y edita todo (project_invites, un solo uso)
--   regalos → enlace público, ve SÓLO lo que falta por comprar, y puede
--             apuntarse a comprar algo (este archivo)
--
-- Los abuelos y los tíos no van a crearse una cuenta. Por eso el enlace de
-- regalos funciona sin sesión: quien tiene el enlace, entra. Eso obliga a dos
-- cosas — que el token sea largo e imposible de adivinar, y que NUNCA se dé
-- acceso directo a las tablas: todo pasa por funciones que sólo devuelven lo
-- que la familia debe ver.

do $$ begin
  create type share_kind as enum ('registry');
exception when duplicate_object then null;
end $$;

create table if not exists share_links (
  token      text primary key,
  project_id uuid not null references projects(id) on delete cascade,
  kind       share_kind not null default 'registry',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists idx_share_links_project_id on share_links (project_id);

alter table share_links enable row level security;

-- Sólo los miembros ven y gestionan los enlaces de su propio proyecto.
-- Quien use el enlace no toca esta tabla: entra por las funciones de abajo.
drop policy if exists "miembros gestionan sus enlaces" on share_links;
create policy "miembros gestionan sus enlaces" on share_links
  for all to authenticated
  using (is_project_member(project_id)) with check (is_project_member(project_id));

-- Quién se apuntó a comprar cada cosa.
alter table products add column if not exists reserved_by_name text;
alter table products add column if not exists reserved_at      timestamptz;

-- ---------------------------------------------------------------------------
-- Crear y revocar el enlace
-- ---------------------------------------------------------------------------
create or replace function crear_enlace_regalos(p_project_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Sin caracteres ambiguos: este token viaja en una URL, pero alguien puede
  -- acabar dictándolo por teléfono.
  v_alfabeto constant text := 'abcdefghijkmnopqrstuvwxyz23456789';
  v_token text := '';
begin
  if not is_project_member(p_project_id) then
    raise exception 'No tienes acceso a esta bitácora';
  end if;

  -- 24 caracteres sobre un alfabeto de 33 ≈ 121 bits. No se adivina.
  for i in 1..24 loop
    v_token := v_token || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
  end loop;

  -- Un enlace vivo por proyecto: generar uno nuevo invalida el anterior, que
  -- es lo que alguien espera al pulsar "generar enlace" por segunda vez.
  update share_links set revoked_at = now()
    where project_id = p_project_id and kind = 'registry' and revoked_at is null;

  insert into share_links (token, project_id, created_by)
    values (v_token, p_project_id, auth.uid());

  return v_token;
end $$;

create or replace function revocar_enlace_regalos(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update share_links set revoked_at = now()
    where token = p_token and is_project_member(project_id);
  if not found then
    raise exception 'No se encontró ese enlace';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Lo que ve la familia
-- ---------------------------------------------------------------------------
create or replace function proyecto_de_enlace(p_token text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select project_id from share_links
  where token = p_token and revoked_at is null;
$$;

/** Cabecera de la lista: nombre del bebé y moneda. Nada más. */
create or replace function ver_cabecera_regalos(p_token text)
returns json
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

  return (
    select json_build_object(
      'baby_name',     coalesce(s.baby_name, ''),
      'currency_code', s.currency_code
    )
    from project_settings s where s.project_id = v_project_id
  );
end $$;

/**
 * La lista de regalos: sólo lo que falta por comprar.
 *
 * Deliberadamente NO devuelve lo ya comprado, ni los totales, ni quién paga
 * qué, ni las notas de los padres. La familia ve lo que necesita para regalar
 * y nada de la economía de la casa.
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
    order by p.reserved_at nulls first, p.created_at;
end $$;

/** «Yo lo compro»: aparta el producto a nombre de quien lo dice. */
create or replace function reservar_regalo(p_token text, p_product_id uuid, p_nombre text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid := proyecto_de_enlace(p_token);
  v_reservado  text;
begin
  if v_project_id is null then
    raise exception 'Ese enlace no existe o fue revocado';
  end if;
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'Hace falta tu nombre para apartarlo';
  end if;

  select reserved_by_name into v_reservado from products
    where id = p_product_id and project_id = v_project_id
    for update;

  if not found then
    raise exception 'Ese regalo ya no está en la lista';
  end if;
  if v_reservado is not null then
    raise exception 'Ya lo apartó %', v_reservado;
  end if;

  update products
    set reserved_by_name = trim(p_nombre), reserved_at = now()
    where id = p_product_id and project_id = v_project_id;
end $$;

/** Soltar algo que se apartó por error. */
create or replace function liberar_regalo(p_token text, p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid := proyecto_de_enlace(p_token);
begin
  if v_project_id is null then
    raise exception 'Ese enlace no existe o fue revocado';
  end if;

  update products set reserved_by_name = null, reserved_at = null
    where id = p_product_id and project_id = v_project_id;
  if not found then
    raise exception 'Ese regalo ya no está en la lista';
  end if;
end $$;

/**
 * «Ya lo compré»: marca el producto como comprado, con lo que el checklist de
 * los padres se completa solo. Se atribuye al pagador de regalos si existe,
 * para que el dashboard cuadre.
 */
create or replace function marcar_regalo_comprado(p_token text, p_product_id uuid, p_nombre text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid := proyecto_de_enlace(p_token);
  v_pagador    uuid;
  v_moneda     text;
  v_tasa       numeric;
begin
  if v_project_id is null then
    raise exception 'Ese enlace no existe o fue revocado';
  end if;
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'Hace falta tu nombre';
  end if;

  select id into v_pagador from payers
    where project_id = v_project_id and role = 'gift' limit 1;

  select currency_code into v_moneda from products
    where id = p_product_id and project_id = v_project_id;
  if not found then
    raise exception 'Ese regalo ya no está en la lista';
  end if;

  -- Se congela el cambio del día, igual que cuando compran los padres.
  select rate_to_usd into v_tasa from fx_rates where currency_code = v_moneda;

  update products
    set status            = 'purchased',
        payer_id          = coalesce(payer_id, v_pagador),
        reserved_by_name  = trim(p_nombre),
        reserved_at       = coalesce(reserved_at, now()),
        fx_rate_to_usd    = coalesce(fx_rate_to_usd, v_tasa),
        fx_rate_locked_at = coalesce(fx_rate_locked_at, now())
    where id = p_product_id and project_id = v_project_id;
end $$;

-- ---------------------------------------------------------------------------
-- Permisos: la familia entra sin sesión, así que estas funciones las puede
-- ejecutar `anon`. Ninguna da acceso a las tablas: cada una comprueba el token
-- y devuelve sólo lo suyo.
-- ---------------------------------------------------------------------------
revoke all on function crear_enlace_regalos(uuid)              from public;
revoke all on function revocar_enlace_regalos(text)            from public;
revoke all on function proyecto_de_enlace(text)                from public;
revoke all on function ver_cabecera_regalos(text)              from public;
revoke all on function ver_lista_regalos(text)                 from public;
revoke all on function reservar_regalo(text, uuid, text)       from public;
revoke all on function liberar_regalo(text, uuid)              from public;
revoke all on function marcar_regalo_comprado(text, uuid, text) from public;

grant execute on function crear_enlace_regalos(uuid)   to authenticated;
grant execute on function revocar_enlace_regalos(text) to authenticated;

grant execute on function ver_cabecera_regalos(text)              to anon, authenticated;
grant execute on function ver_lista_regalos(text)                 to anon, authenticated;
grant execute on function reservar_regalo(text, uuid, text)       to anon, authenticated;
grant execute on function liberar_regalo(text, uuid)              to anon, authenticated;
grant execute on function marcar_regalo_comprado(text, uuid, text) to anon, authenticated;

-- proyecto_de_enlace es interna: no se expone a nadie.
