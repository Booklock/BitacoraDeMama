-- Bitácora de Mamá · El alta completa, tal como la ejecuta el asistente
--
-- Reproduce la secuencia exacta de crearProyecto() en src/lib/datos/proyecto.ts:
-- la RPC de alta, el insert de pagadores, el enlace del miembro con su pagador
-- y el guardado de los datos del bebé. Si esto pasa, un fallo en el asistente
-- no está en la base.

\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email)
  values ('99999999-9999-9999-9999-999999999999', 'alta@ejemplo.com');

set role authenticated;
set request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999"}';

select create_project('USD') as pid \gset

insert into payers (project_id, role, name, sort_order) values
  (:'pid', 'mother', 'Fabiana',              1),
  (:'pid', 'father', 'Papá',                 2),
  (:'pid', 'gift',   'Regalo (Baby Shower)', 3),
  (:'pid', 'shared', 'Común',                4),
  (:'pid', 'extra',  'Abuela Rosa',          5);

update project_members
  set payer_id = (select id from payers where project_id = :'pid' and role = 'mother')
  where project_id = :'pid' and user_id = auth.uid();

update project_settings
  set baby_name = 'Sebastián', father_lastname = 'Montalto', mother_lastname = 'Araya'
  where project_id = :'pid';

do $$
begin
  if (select count(*) from mis_proyectos) <> 1 then
    raise exception 'FALLO: el alta no dejó un proyecto visible';
  end if;
  if (select mi_rol from mis_proyectos limit 1) <> 'owner' then
    raise exception 'FALLO: quien crea la bitácora no queda como owner';
  end if;
  if (select count(*) from payers) <> 5 then
    raise exception 'FALLO: se esperaban 5 pagadores, hay %', (select count(*) from payers);
  end if;
  if (select payer_id from project_members limit 1) is null then
    raise exception 'FALLO: el miembro no quedó enlazado con su pagador';
  end if;
  if (select baby_name from project_settings limit 1) <> 'Sebastián' then
    raise exception 'FALLO: no se guardaron los datos del bebé';
  end if;
  raise notice 'OK · el alta deja proyecto, owner, 5 pagadores y datos del bebé';
end $$;

-- Sin nada escrito, el alta también tiene que funcionar: en el asistente todo
-- es opcional (decisión D6).
do $$
declare v_pid uuid;
begin
  v_pid := create_project('EUR');
  if (select count(*) from mis_proyectos) <> 2 then
    raise exception 'FALLO: no se puede crear una segunda bitácora vacía';
  end if;
  if (select currency_code from project_settings where project_id = v_pid) <> 'EUR' then
    raise exception 'FALLO: no respetó la moneda elegida';
  end if;
  raise notice 'OK · una bitácora sin datos opcionales también se crea';
end $$;

-- Una moneda inexistente no debe romper el alta: cae a USD.
do $$
declare v_pid uuid;
begin
  v_pid := create_project('MONEDA-QUE-NO-EXISTE');
  if (select currency_code from project_settings where project_id = v_pid) <> 'USD' then
    raise exception 'FALLO: una moneda desconocida no cayó a USD';
  end if;
  raise notice 'OK · una moneda desconocida cae a USD en vez de fallar';
end $$;

reset role;
\echo ''
\echo 'PRUEBAS DEL ALTA: TODAS PASARON'
