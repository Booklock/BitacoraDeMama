-- Bitácora de Mamá · Row Level Security
-- Regla única: sólo ves un proyecto si eres miembro de él (decisión D4).

-- ---------------------------------------------------------------------------
-- Helper. SECURITY DEFINER para romper la recursión: si la política de
-- project_members consultara project_members, Postgres entraría en bucle.
-- ---------------------------------------------------------------------------
create or replace function is_project_member(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from project_members
    where project_id = p_project_id and user_id = auth.uid()
  );
$$;

create or replace function is_project_owner(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from project_members
    where project_id = p_project_id and user_id = auth.uid() and role = 'owner'
  );
$$;

-- ---------------------------------------------------------------------------
-- Catálogo y tasas: lectura pública para cualquiera con sesión, sin escritura.
-- Se siembran con la service role key, nunca desde el navegador.
-- ---------------------------------------------------------------------------
alter table qrh_categories    enable row level security;
alter table checklist_items   enable row level security;
alter table item_satisfied_by enable row level security;
alter table fx_rates          enable row level security;

create policy "catálogo legible" on qrh_categories
  for select to authenticated using (true);
create policy "catálogo legible" on checklist_items
  for select to authenticated using (true);
create policy "catálogo legible" on item_satisfied_by
  for select to authenticated using (true);
create policy "tasas legibles" on fx_rates
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Proyectos
-- ---------------------------------------------------------------------------
alter table projects enable row level security;

create policy "ver proyectos propios" on projects
  for select to authenticated using (is_project_member(id));
create policy "crear proyecto propio" on projects
  for insert to authenticated with check (created_by = auth.uid());
create policy "editar si owner" on projects
  for update to authenticated using (is_project_owner(id));
create policy "borrar si owner" on projects
  for delete to authenticated using (is_project_owner(id));

-- ---------------------------------------------------------------------------
-- Membresías. El alta la hacen las funciones SECURITY DEFINER de abajo.
-- ---------------------------------------------------------------------------
alter table project_members enable row level security;

create policy "ver miembros del proyecto" on project_members
  for select to authenticated using (is_project_member(project_id));
create policy "editar mi propia fila" on project_members
  for update to authenticated using (user_id = auth.uid());
create policy "el owner saca miembros" on project_members
  for delete to authenticated using (is_project_owner(project_id) or user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Invitaciones: sólo el owner las ve y las crea. Unirse va por RPC, para que
-- nadie pueda listar códigos ajenos.
-- ---------------------------------------------------------------------------
alter table project_invites enable row level security;

create policy "el owner ve sus invitaciones" on project_invites
  for select to authenticated using (is_project_owner(project_id));
create policy "el owner invita" on project_invites
  for insert to authenticated with check (is_project_owner(project_id) and created_by = auth.uid());
create policy "el owner revoca" on project_invites
  for delete to authenticated using (is_project_owner(project_id));

-- ---------------------------------------------------------------------------
-- Datos del proyecto: mismo criterio para todas. Miembro = acceso completo.
-- ---------------------------------------------------------------------------
alter table project_settings enable row level security;
alter table payers           enable row level security;
alter table products         enable row level security;
alter table checklist_states enable row level security;

create policy "acceso de miembro" on project_settings
  for all to authenticated
  using (is_project_member(project_id)) with check (is_project_member(project_id));

create policy "acceso de miembro" on payers
  for all to authenticated
  using (is_project_member(project_id)) with check (is_project_member(project_id));

create policy "acceso de miembro" on products
  for all to authenticated
  using (is_project_member(project_id)) with check (is_project_member(project_id));

create policy "acceso de miembro" on checklist_states
  for all to authenticated
  using (is_project_member(project_id)) with check (is_project_member(project_id));
