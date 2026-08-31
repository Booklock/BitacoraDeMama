-- Bitácora de Mamá · Alta de proyecto flexible
--
-- La versión anterior creaba siempre los cuatro pagadores del Excel. El
-- asistente de primeros pasos necesita decidirlos: puede que no haya pareja,
-- o que además participen los abuelos. Ahora la función sólo crea el proyecto
-- y la membresía, y el cliente inserta los pagadores que correspondan.

drop function if exists create_project_for_current_user(text, payer_role, text);

create or replace function create_project(p_currency_code text default 'USD')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_project_id uuid;
  v_currency   text;
begin
  if v_uid is null then
    raise exception 'Se necesita sesión iniciada';
  end if;

  -- Moneda válida o USD. Nunca falla por una moneda desconocida.
  select currency_code into v_currency from fx_rates where currency_code = p_currency_code;
  v_currency := coalesce(v_currency, 'USD');

  insert into projects (created_by) values (v_uid) returning id into v_project_id;
  insert into project_settings (project_id, currency_code) values (v_project_id, v_currency);
  insert into project_members (project_id, user_id, role)
    values (v_project_id, v_uid, 'owner');

  return v_project_id;
end $$;

revoke all on function create_project(text) from public;
grant execute on function create_project(text) to authenticated;

-- Un usuario podría quedarse sin proyecto si el asistente falla a medias.
-- Esta vista le devuelve el suyo sin tener que hacer el join a mano.
create or replace view mis_proyectos as
  select p.id, p.name, p.created_at, m.role as mi_rol
  from projects p
  join project_members m on m.project_id = p.id
  where m.user_id = auth.uid();

grant select on mis_proyectos to authenticated;
