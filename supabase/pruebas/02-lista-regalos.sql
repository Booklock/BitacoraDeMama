-- Bitácora de Mamá · Prueba del enlace de regalos
--
-- El enlace lo abre gente sin cuenta, así que lo importante es lo que NO
-- devuelve: nada de lo ya comprado, ni totales, ni datos de otras familias.

\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'papa@ejemplo.com'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'otrafamilia@ejemplo.com');

set role authenticated;

-- --------------------------------------------------------------------------
-- La familia que espera bebé
-- --------------------------------------------------------------------------
set request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001"}';
select create_project('USD') as proyecto \gset
insert into payers (project_id, role, name, sort_order)
  values (:'proyecto', 'gift', 'Regalo (Baby Shower)', 1);
update project_settings set baby_name = 'Valentina' where project_id = :'proyecto';

insert into products (project_id, name, qrh_code, item_code, price, currency_code, qty, status) values
  (:'proyecto', 'Carrito Nuna',   'QRH-011', 'QRH-011-01', 890, 'USD', 1, 'wishlist'),
  (:'proyecto', 'Silla de auto',  'QRH-011', 'QRH-011-02', 340, 'USD', 1, 'pending'),
  (:'proyecto', 'Cuna YA COMPRADA','QRH-001','QRH-001-01', 400, 'USD', 1, 'purchased');

select crear_enlace_regalos(:'proyecto') as token \gset
select set_config('prueba.token', :'token', false);
select set_config('prueba.proyecto', :'proyecto', false);

-- --------------------------------------------------------------------------
-- Otra familia, para comprobar que no se cruzan
-- --------------------------------------------------------------------------
set request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002"}';
select create_project('EUR') as ajeno \gset
insert into products (project_id, name, price, currency_code, qty, status)
  values (:'ajeno', 'Secreto de otra familia', 99, 'EUR', 1, 'wishlist');

-- --------------------------------------------------------------------------
-- Ahora entra la abuela: SIN cuenta
-- --------------------------------------------------------------------------
reset role;
set role anon;

do $$
declare
  v_token text := current_setting('prueba.token');
  v_filas int;
  v_id    uuid;
begin
  -- Sólo lo pendiente, nunca lo ya comprado.
  select count(*) into v_filas from ver_lista_regalos(v_token);
  if v_filas <> 2 then
    raise exception 'FALLO: la lista devuelve % filas, se esperaban 2', v_filas;
  end if;
  if exists (select 1 from ver_lista_regalos(v_token) where name like '%YA COMPRADA%') then
    raise exception 'FALLO DE PRIVACIDAD: muestra lo ya comprado';
  end if;
  if exists (select 1 from ver_lista_regalos(v_token) where name like '%otra familia%') then
    raise exception 'FALLO DE SEGURIDAD: muestra datos de otra familia';
  end if;
  raise notice 'OK · la lista muestra sólo lo pendiente de esa familia';

  -- Sin acceso directo a las tablas, aunque tenga el enlace.
  begin
    perform 1 from products limit 1;
    if found then raise exception 'FALLO: anon lee la tabla products'; end if;
  exception when insufficient_privilege then
    null; -- esperado
  end;
  raise notice 'OK · sin sesión no se puede leer la tabla directamente';

  -- Un token inventado no abre nada.
  begin
    perform ver_lista_regalos('token-inventado-cualquiera');
    raise exception 'FALLO: un token falso devolvió la lista';
  exception when others then
    if sqlerrm not like '%no existe%' then raise; end if;
    raise notice 'OK · un enlace inventado no abre nada';
  end;

  -- La abuela aparta el carrito.
  select id into v_id from ver_lista_regalos(v_token) where name = 'Carrito Nuna';
  perform reservar_regalo(v_token, v_id, 'Abuela Rosa');
  if (select reserved_by_name from ver_lista_regalos(v_token) where id = v_id) <> 'Abuela Rosa' then
    raise exception 'FALLO: no se guardó quién lo apartó';
  end if;
  raise notice 'OK · la abuela aparta un regalo a su nombre';

  -- El tío llega tarde al mismo regalo.
  begin
    perform reservar_regalo(v_token, v_id, 'Tío Beto');
    raise exception 'FALLO: dos personas apartaron el mismo regalo';
  exception when others then
    if sqlerrm not like '%Ya lo apart%' then raise; end if;
    raise notice 'OK · nadie puede apartar algo ya apartado';
  end;

  -- La abuela lo compra: sale de la lista y cuenta para el checklist.
  perform marcar_regalo_comprado(v_token, v_id, 'Abuela Rosa');
  if exists (select 1 from ver_lista_regalos(v_token) where id = v_id) then
    raise exception 'FALLO: lo comprado sigue en la lista';
  end if;
  raise notice 'OK · lo comprado desaparece de la lista';
end $$;

-- --------------------------------------------------------------------------
-- Los padres ven el efecto en su bitácora
-- --------------------------------------------------------------------------
reset role;
set role authenticated;
set request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001"}';

do $$
begin
  if (select status from products where name = 'Carrito Nuna') <> 'purchased' then
    raise exception 'FALLO: el regalo no quedó como comprado';
  end if;
  if (select reserved_by_name from products where name = 'Carrito Nuna') <> 'Abuela Rosa' then
    raise exception 'FALLO: no consta quién lo regaló';
  end if;
  if (select fx_rate_to_usd from products where name = 'Carrito Nuna') is null then
    raise exception 'FALLO: no se congeló el tipo de cambio';
  end if;
  if (select p.name from payers p
      join products pr on pr.payer_id = p.id where pr.name = 'Carrito Nuna') <> 'Regalo (Baby Shower)' then
    raise exception 'FALLO: no se atribuyó al pagador de regalos';
  end if;
  raise notice 'OK · los padres ven el regalo comprado, con nombre y cambio congelado';
end $$;

-- --------------------------------------------------------------------------
-- Revocar el enlace lo cierra de inmediato
-- --------------------------------------------------------------------------
do $$
declare v_token text := current_setting('prueba.token');
begin
  perform revocar_enlace_regalos(v_token);
  begin
    perform ver_lista_regalos(v_token);
    raise exception 'FALLO: el enlace revocado sigue abriendo la lista';
  exception when others then
    if sqlerrm not like '%revocado%' then raise; end if;
    raise notice 'OK · revocar el enlace lo cierra de inmediato';
  end;
end $$;

-- Alguien de otra familia no puede revocar enlaces ajenos.
set request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002"}';
do $$
begin
  perform crear_enlace_regalos(current_setting('prueba.proyecto')::uuid);
  raise exception 'FALLO: creó un enlace para un proyecto ajeno';
exception when others then
  if sqlerrm not like '%No tienes acceso%' then raise; end if;
  raise notice 'OK · no se pueden crear enlaces de bitácoras ajenas';
end $$;

reset role;
\echo ''
\echo 'PRUEBAS DE LA LISTA DE REGALOS: TODAS PASARON'
