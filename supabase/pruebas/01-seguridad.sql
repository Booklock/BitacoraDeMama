-- Bitácora de Mamá · Prueba del modelo de seguridad
--
-- Comprueba que una familia no puede ver ni tocar los datos de otra. Cada
-- comprobación falla ruidosamente: si el archivo termina sin error, pasó todo.
--
-- Se ejecuta con scripts/probar-sql.sh contra un Postgres local.

\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'mama@ejemplo.com'),
  ('22222222-2222-2222-2222-222222222222', 'extrana@ejemplo.com'),
  ('33333333-3333-3333-3333-333333333333', 'pareja@ejemplo.com');

set role authenticated;

-- ---------------------------------------------------------------------------
-- Mamá monta su bitácora
-- ---------------------------------------------------------------------------
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
select create_project('EUR') as proyecto \gset
insert into payers (project_id, role, name, sort_order)
  values (:'proyecto', 'mother', 'Fabiana', 1);
insert into products (project_id, name, qrh_code, item_code, price, currency_code, qty, status)
  values (:'proyecto', 'Cuna secreta', 'QRH-001', 'QRH-001-01', 400, 'EUR', 1, 'purchased');
select create_invite_code(:'proyecto') as codigo \gset

-- Se guardan como parámetros de sesión para poder leerlos desde los bloques DO.
select set_config('prueba.proyecto', :'proyecto', false);
select set_config('prueba.codigo',   :'codigo',   false);

-- ---------------------------------------------------------------------------
-- Una extraña no ve nada de lo ajeno
-- ---------------------------------------------------------------------------
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';

do $$
begin
  if (select count(*) from products)          <> 0 then raise exception 'FALLO: ve productos ajenos'; end if;
  if (select count(*) from projects)          <> 0 then raise exception 'FALLO: ve proyectos ajenos'; end if;
  if (select count(*) from payers)            <> 0 then raise exception 'FALLO: ve pagadores ajenos'; end if;
  if (select count(*) from project_invites)   <> 0 then raise exception 'FALLO: ve invitaciones ajenas'; end if;
  if (select count(*) from project_settings)  <> 0 then raise exception 'FALLO: ve ajustes ajenos'; end if;
  raise notice 'OK · una extraña no lee nada del proyecto ajeno';
end $$;

-- Escribir en el proyecto ajeno debe romperse contra la política, no pasar.
do $$
declare v_proyecto uuid := current_setting('prueba.proyecto')::uuid;
begin
  begin
    insert into products (project_id, name, qty, status)
      values (v_proyecto, 'Intruso', 1, 'pending');
    raise exception 'FALLO: pudo insertar en el proyecto ajeno';
  exception when insufficient_privilege then
    raise notice 'OK · la base rechaza escribir en el proyecto ajeno';
  end;

  begin
    insert into project_members (project_id, user_id, role)
      values (v_proyecto, auth.uid(), 'owner');
    raise exception 'FALLO: pudo colarse como miembro';
  exception when insufficient_privilege then
    raise notice 'OK · la base rechaza añadirse como miembro';
  end;

  -- Borrar y actualizar no dan error: la política los deja sin filas que tocar.
  delete from products where project_id = v_proyecto;
  if found then raise exception 'FALLO: borró productos ajenos'; end if;

  update project_settings set currency_code = 'ARS' where project_id = v_proyecto;
  if found then raise exception 'FALLO: cambió los ajustes ajenos'; end if;
  raise notice 'OK · borrar y actualizar lo ajeno no afecta ninguna fila';
end $$;

-- ---------------------------------------------------------------------------
-- El catálogo del sistema es de sólo lectura
-- ---------------------------------------------------------------------------
do $$
begin
  update checklist_items set name_es = 'hackeado' where code = 'QRH-001-01';
  if found then raise exception 'FALLO: modificó el catálogo'; end if;
  delete from qrh_categories where code = 'QRH-001';
  if found then raise exception 'FALLO: borró una categoría del catálogo'; end if;
  raise notice 'OK · el catálogo no se puede modificar';
end $$;

-- ---------------------------------------------------------------------------
-- La invitación: sirve una vez y se gasta por cualquier camino
-- ---------------------------------------------------------------------------
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';
do $$
declare v_codigo text := current_setting('prueba.codigo');
begin
  perform join_project_with_code(v_codigo);
  if (select count(*) from products) <> 1 then
    raise exception 'FALLO: la pareja no ve la bitácora tras unirse';
  end if;
  raise notice 'OK · la pareja se une y ve la misma bitácora';

  -- Redimirlo de nuevo, siendo ya miembro, no debe dejarlo vivo.
  begin
    perform join_project_with_code(v_codigo);
    raise exception 'FALLO: el código seguía vivo tras usarse';
  exception when others then
    if sqlerrm not like '%ya se us%' then raise; end if;
    raise notice 'OK · el código ya usado no se puede redimir otra vez';
  end;
end $$;

-- El agujero que esta prueba encontró: si quien redime ya era miembro, el
-- código quedaba sin gastar y cualquiera podía entrar con él.
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
do $$
declare v_codigo text := current_setting('prueba.codigo');
begin
  begin
    perform join_project_with_code(v_codigo);
    raise exception 'FALLO DE SEGURIDAD: una extraña entró con un código gastado';
  exception when others then
    if sqlerrm not like '%ya se us%' then raise; end if;
  end;
  if (select count(*) from products) <> 0 then
    raise exception 'FALLO: la extraña acabó viendo la bitácora';
  end if;
  raise notice 'OK · un código gastado no deja entrar a nadie más';
end $$;

-- Un código inventado tampoco.
do $$
begin
  begin
    perform join_project_with_code('AAAA-BBBB');
    raise exception 'FALLO: entró con un código inexistente';
  exception when others then
    if sqlerrm not like '%no existe%' then raise; end if;
    raise notice 'OK · un código inventado no sirve';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Estado final visto por mamá
-- ---------------------------------------------------------------------------
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
do $$
begin
  if (select count(*) from project_members) <> 2 then
    raise exception 'FALLO: el proyecto tiene % miembros, se esperaban 2 (mamá y pareja)',
      (select count(*) from project_members);
  end if;
  if (select count(*) from products) <> 1 then raise exception 'FALLO: se perdió un producto'; end if;
  if (select currency_code from project_settings limit 1) <> 'EUR' then
    raise exception 'FALLO: cambió la moneda';
  end if;
  raise notice 'OK · estado final correcto: 2 miembros, 1 producto, moneda intacta';
end $$;

reset role;
\echo ''
\echo 'TODAS LAS COMPROBACIONES DE SEGURIDAD PASARON'
