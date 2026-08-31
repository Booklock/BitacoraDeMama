-- Bitácora de Mamá · Funciones de alta y de unión en pareja
-- Decisiones D4 (pareja sobre un proyecto) y D6 (configuración pre-rellenada).

-- ---------------------------------------------------------------------------
-- Crear proyecto para quien se registra "empezando yo".
-- Deja lista la configuración: moneda, los 4 pagadores del Excel, y el nombre
-- de quien se registró ya puesto en el rol que eligió.
-- ---------------------------------------------------------------------------
create or replace function create_project_for_current_user(
  p_display_name  text,
  p_role          payer_role default 'mother',
  p_currency_code text default 'USD'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_project_id uuid;
  v_payer_id   uuid;
  v_currency   text;
begin
  if v_uid is null then
    raise exception 'Se necesita sesión iniciada';
  end if;
  if p_role not in ('mother', 'father') then
    raise exception 'El rol inicial debe ser mother o father';
  end if;

  -- Moneda válida o USD. Nunca falla por una moneda desconocida.
  select currency_code into v_currency from fx_rates where currency_code = p_currency_code;
  v_currency := coalesce(v_currency, 'USD');

  insert into projects (created_by) values (v_uid) returning id into v_project_id;

  insert into project_settings (project_id, currency_code)
    values (v_project_id, v_currency);

  -- Los 4 pagadores por defecto del Excel (Configuración!C22:C25).
  -- El rol de quien se registra toma su nombre real; el otro queda editable.
  insert into payers (project_id, role, name, sort_order) values
    (v_project_id, 'mother',
      case when p_role = 'mother' then coalesce(nullif(trim(p_display_name), ''), 'Mamá') else 'Mamá' end, 1),
    (v_project_id, 'father',
      case when p_role = 'father' then coalesce(nullif(trim(p_display_name), ''), 'Papá') else 'Papá' end, 2),
    (v_project_id, 'gift',   'Regalo (Baby Shower)', 3),
    (v_project_id, 'shared', 'Común',                4);

  select id into v_payer_id from payers
    where project_id = v_project_id and role = p_role;

  insert into project_members (project_id, user_id, role, payer_id)
    values (v_project_id, v_uid, 'owner', v_payer_id);

  return v_project_id;
end $$;

-- ---------------------------------------------------------------------------
-- Generar un código de invitación legible, del tipo LUNA-4K2P.
-- Sin caracteres ambiguos (0/O, 1/I) porque se dicta en voz alta.
-- ---------------------------------------------------------------------------
create or replace function create_invite_code(p_project_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_try  int := 0;
begin
  if not is_project_owner(p_project_id) then
    raise exception 'Sólo quien creó la bitácora puede invitar';
  end if;

  loop
    v_try := v_try + 1;
    if v_try > 20 then
      raise exception 'No se pudo generar un código libre';
    end if;

    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
      if i = 4 then v_code := v_code || '-'; end if;
    end loop;

    exit when not exists (select 1 from project_invites where code = v_code);
  end loop;

  insert into project_invites (code, project_id, created_by)
    values (v_code, p_project_id, auth.uid());

  return v_code;
end $$;

-- ---------------------------------------------------------------------------
-- Unirse con un código. Va por RPC y no por RLS para que nadie pueda listar
-- ni tantear códigos ajenos: o el código es exacto y vigente, o no pasa nada.
-- ---------------------------------------------------------------------------
create or replace function join_project_with_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_invite  project_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'Se necesita sesión iniciada';
  end if;

  select * into v_invite from project_invites
    where code = upper(trim(p_code))
    for update;

  if not found then
    raise exception 'Ese código no existe';
  end if;
  if v_invite.used_at is not null then
    raise exception 'Ese código ya se usó';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'Ese código ya venció';
  end if;

  -- Ya era miembro: no es un error, simplemente lo llevamos al proyecto.
  if exists (select 1 from project_members
             where project_id = v_invite.project_id and user_id = v_uid) then
    return v_invite.project_id;
  end if;

  insert into project_members (project_id, user_id, role)
    values (v_invite.project_id, v_uid, 'member');

  update project_invites set used_at = now(), used_by = v_uid
    where code = v_invite.code;

  return v_invite.project_id;
end $$;

revoke all on function create_project_for_current_user(text, payer_role, text) from public;
revoke all on function create_invite_code(uuid)  from public;
revoke all on function join_project_with_code(text) from public;
grant execute on function create_project_for_current_user(text, payer_role, text) to authenticated;
grant execute on function create_invite_code(uuid)  to authenticated;
grant execute on function join_project_with_code(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Diagnóstico de instalación. Devuelve sólo recuentos —nunca el contenido del
-- catálogo, que es propiedad de la marca— para que la portada pueda decir si
-- la base ya quedó conectada y sembrada. Ejecutable sin sesión iniciada.
-- ---------------------------------------------------------------------------
create or replace function installation_status()
returns json
language sql
security definer
set search_path = public
stable
as $$
  select json_build_object(
    'qrh_categories',  (select count(*) from qrh_categories),
    'checklist_items', (select count(*) from checklist_items),
    'fx_rates',        (select count(*) from fx_rates)
  );
$$;

revoke all on function installation_status() from public;
grant execute on function installation_status() to anon, authenticated;
