-- Bitácora de Mamá · El código de invitación se consume siempre
--
-- Fallo detectado probando el modelo de seguridad contra un Postgres real:
-- si quien redimía un código YA era miembro del proyecto, la función retornaba
-- temprano sin marcarlo como usado. El código quedaba vivo, y cualquier otra
-- persona que lo tuviera podía entrar con él.
--
-- Ahora el código se consume en todos los caminos: redimirlo lo gasta, sea
-- quien sea quien lo redima.

create or replace function join_project_with_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_invite project_invites%rowtype;
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

  -- El código se gasta aquí, antes de cualquier retorno, para que no quede
  -- vivo por ningún camino.
  update project_invites set used_at = now(), used_by = v_uid
    where code = v_invite.code;

  -- Ya era miembro: no es un error, simplemente lo llevamos al proyecto.
  if exists (select 1 from project_members
             where project_id = v_invite.project_id and user_id = v_uid) then
    return v_invite.project_id;
  end if;

  insert into project_members (project_id, user_id, role)
    values (v_invite.project_id, v_uid, 'member');

  return v_invite.project_id;
end $$;

revoke all on function join_project_with_code(text) from public;
grant execute on function join_project_with_code(text) to authenticated;
