-- Bitácora de Mamá · Instalación completa
-- GENERADO POR scripts/build-instalador.mjs — no editar a mano.
--
-- Pega este archivo entero en el SQL Editor de Supabase y pulsa Run.
-- Contiene 8 migraciones, ya en el orden correcto:
--   1. 20260831000100_schema.sql
--   2. 20260831000200_rls.sql
--   3. 20260831000300_functions.sql
--   4. 20260831000400_seed_catalog.sql
--   5. 20260831000500_alta_flexible.sql
--   6. 20260831000600_invitacion_un_solo_uso.sql
--   7. 20260831000700_lista_regalos.sql
--   8. 20260831000800_sugerencias.sql

begin;

-- ==========================================================================
-- 20260831000100_schema.sql
-- ==========================================================================
-- Bitácora de Mamá · Esquema base
-- Etapa 2. Ver docs/02-modelo-de-datos.md

-- ---------------------------------------------------------------------------
-- Enumeraciones (docs/02 §Enumeraciones)
-- ---------------------------------------------------------------------------
create type product_status as enum ('purchased', 'pending', 'wishlist', 'savings');
create type baby_stage     as enum ('pregnancy', 'm0_3', 'm3_6', 'm6_9', 'm9_12', 'all');
create type payer_role     as enum ('mother', 'father', 'gift', 'shared', 'extra');
create type member_role    as enum ('owner', 'member');
create type fx_source      as enum ('seed', 'api', 'manual');

-- ---------------------------------------------------------------------------
-- Catálogo del sistema: 13 QRH y 188 ítems (decisión D3, catálogo fijo)
-- Sin project_id: son globales. La columna queda prevista para ítems propios.
-- ---------------------------------------------------------------------------
create table qrh_categories (
  code            text primary key,
  sort_order      int  not null,
  name_en         text not null,
  name_es         text not null,
  description_es  text,
  is_manual       boolean not null default false
);

create table checklist_items (
  code               text primary key,
  qrh_code           text not null references qrh_categories(code) on delete cascade,
  sort_order         int  not null,
  name_en            text not null,
  name_es            text,
  default_qty_needed int  not null default 1,
  project_id         uuid,  -- null = ítem del sistema; previsto para D3 futura
  unique (qrh_code, sort_order)
);
create index on checklist_items (qrh_code);

-- Mapa de combos: qué compras completan este ítem (docs/01 §6.3)
create table item_satisfied_by (
  item_code        text not null references checklist_items(code) on delete cascade,
  source_item_code text not null references checklist_items(code) on delete cascade,
  primary key (item_code, source_item_code)
);
create index on item_satisfied_by (source_item_code);

-- ---------------------------------------------------------------------------
-- Tipos de cambio: fuente única de verdad, USD como base (decisión D7)
-- ---------------------------------------------------------------------------
create table fx_rates (
  currency_code text primary key,
  symbol        text not null,
  label_es      text not null,
  rate_to_usd   numeric(18,8) not null check (rate_to_usd > 0),
  source        fx_source not null default 'seed',
  fetched_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Proyectos y miembros (decisión D4: una pareja = dos usuarios, un proyecto)
-- ---------------------------------------------------------------------------
create table projects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'Mi bitácora',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table project_settings (
  project_id       uuid primary key references projects(id) on delete cascade,
  currency_code    text not null default 'USD',
  custom_symbol    text,
  custom_rate      numeric(18,8),
  baby_name        text,
  father_lastname  text,
  mother_lastname  text,
  updated_at       timestamptz not null default now()
);

create table payers (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  role       payer_role not null,
  name       text not null,
  sort_order int not null,
  is_active  boolean not null default true
);
create index on payers (project_id);

create table project_members (
  project_id uuid not null references projects(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       member_role not null default 'member',
  payer_id   uuid references payers(id) on delete set null,
  joined_at  timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index on project_members (user_id);

create table project_invites (
  code       text primary key,
  project_id uuid not null references projects(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '30 days'),
  used_at    timestamptz,
  used_by    uuid references auth.users(id) on delete set null
);
create index on project_invites (project_id);

-- ---------------------------------------------------------------------------
-- Inventario (= hoja Inventory). Sin límite de 207 filas.
-- ---------------------------------------------------------------------------
create table products (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects(id) on delete cascade,
  name              text not null,
  qrh_code          text references qrh_categories(code),
  item_code         text references checklist_items(code),
  brand             text,
  store             text,
  url               text,
  price             numeric(14,2),
  currency_code     text references fx_rates(currency_code),
  qty               int not null default 1 check (qty > 0),
  status            product_status not null default 'pending',
  payer_id          uuid references payers(id) on delete set null,
  notes             text,
  stage             baby_stage,
  -- Tasa congelada al comprar (decisión D7)
  fx_rate_to_usd    numeric(18,8),
  fx_rate_locked_at timestamptz,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on products (project_id);
create index on products (project_id, item_code);
create index on products (project_id, status);

-- ---------------------------------------------------------------------------
-- Overrides de checklist: sólo lo editable de la hoja QRH Checklists
-- ---------------------------------------------------------------------------
create table checklist_states (
  project_id       uuid not null references projects(id) on delete cascade,
  item_code        text not null references checklist_items(code) on delete cascade,
  not_applicable   boolean not null default false,
  qty_needed       int,
  notes            text,
  manual_completed boolean not null default false,
  updated_at       timestamptz not null default now(),
  primary key (project_id, item_code)
);

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger products_touch          before update on products
  for each row execute function touch_updated_at();
create trigger checklist_states_touch  before update on checklist_states
  for each row execute function touch_updated_at();
create trigger project_settings_touch  before update on project_settings
  for each row execute function touch_updated_at();

-- ==========================================================================
-- 20260831000200_rls.sql
-- ==========================================================================
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

-- ==========================================================================
-- 20260831000300_functions.sql
-- ==========================================================================
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

-- ==========================================================================
-- 20260831000400_seed_catalog.sql
-- ==========================================================================
-- Bitácora de Mamá · Semilla del catálogo y de los tipos de cambio
-- GENERADO POR scripts/generate-seed-sql.mjs — no editar a mano.
-- Fuente: data/seed/*.json, extraídos del Excel (ver docs/01-analisis-excel.md).

-- Tipos de cambio iniciales (decisión D7). Se refrescan luego por API.
insert into fx_rates (currency_code, symbol, label_es, rate_to_usd, source) values
  ('EUR', '€', 'EUR - Euro (€)', 1.144, 'seed'),
  ('USD', '$', 'USD - Dólar Estadounidense ($)', 1, 'seed'),
  ('CRC', '₡', 'CRC - Colón Costarricense (₡)', 0.0022, 'seed'),
  ('MXN', '$', 'MXN - Peso Mexicano ($)', 0.0575, 'seed'),
  ('GTQ', 'Q', 'GTQ - Quetzal Guatemalteco (Q)', 0.1311, 'seed'),
  ('COP', '$', 'COP - Peso Colombiano ($)', 0.000303, 'seed'),
  ('ARS', '$', 'ARS - Peso Argentino ($)', 0.000671, 'seed')
on conflict (currency_code) do nothing;

-- 13 categorías QRH
insert into qrh_categories (code, sort_order, name_en, name_es, description_es, is_manual) values
  ('QRH-001', 1, 'Nursery', 'Cuarto del bebé', 'Todo lo necesario para preparar la habitación del bebé.', false),
  ('QRH-002', 2, 'Wardrobe', 'Ropa del bebé', 'Toda la ropa y organización del guardarropa.', false),
  ('QRH-003', 3, 'Bath Time', 'Hora del baño', 'Todo lo relacionado con el baño del bebé.', false),
  ('QRH-004', 4, 'Breastfeeding', 'Lactancia', 'Productos específicos para la lactancia materna.', false),
  ('QRH-005', 5, 'Feeding', 'Alimentación', 'Productos generales para alimentar al bebé.', false),
  ('QRH-006', 6, 'Medical Appointments', 'Citas médicas', 'Seguimiento médico y documentos importantes.', false),
  ('QRH-007', 7, 'Hospital Bag - Baby', 'Maleta del bebé', 'Todo lo que necesita el bebé para el hospital.  (checklist manual — márcalo tú misma conforme lo vayas completando)', true),
  ('QRH-008', 8, 'Mom & Dad Bag', 'Maleta de mamá y papá', 'Todo lo necesario para los padres en el hospital.', false),
  ('QRH-009', 9, 'Mom Recovery', 'Recuperación postparto', 'Productos para la recuperación física de la mamá.', false),
  ('QRH-010', 10, 'Pregnancy Amenity Kit', 'Kit de bienestar para el embarazo', 'Artículos que hacen el embarazo mucho más cómodo (no obligatorios).', false),
  ('QRH-011', 11, 'On the Go', 'Salidas y transporte', 'Todo lo relacionado con movilidad y viajes.', false),
  ('QRH-012', 12, 'Landing', 'Llegada a casa', 'Checklist para verificar que todo esté listo antes de llegar a casa.  (checklist manual — márcalo tú misma conforme lo vayas completando)', true),
  ('QRH-013', 13, 'Baby Care', 'Cuidado del bebé', 'Productos de cuidado, salud básica e higiene diaria del bebé.', false)
on conflict (code) do nothing;

-- 188 ítems de checklist
insert into checklist_items (code, qrh_code, sort_order, name_en, name_es, default_qty_needed) values
  ('QRH-001-01', 'QRH-001', 1, 'Crib', 'Cuna', 1),
  ('QRH-001-02', 'QRH-001', 2, 'Bassinet', 'Moisés', 1),
  ('QRH-001-03', 'QRH-001', 3, 'Mattress', 'Colchón', 1),
  ('QRH-001-04', 'QRH-001', 4, 'Mattress Protector', 'Protector de colchón', 1),
  ('QRH-001-05', 'QRH-001', 5, 'Fitted Sheets', 'Sábanas ajustables', 1),
  ('QRH-001-06', 'QRH-001', 6, 'Baby Monitor', 'Monitor', 1),
  ('QRH-001-07', 'QRH-001', 7, 'Baby Monitor with Room Thermometer (Both)', 'Monitor con Termómetro de Cuarto (Ambos)', 1),
  ('QRH-001-08', 'QRH-001', 8, 'White Noise Machine', 'Máquina de sonido', 1),
  ('QRH-001-09', 'QRH-001', 9, 'Night Light', 'Luz nocturna', 1),
  ('QRH-001-10', 'QRH-001', 10, 'Night Light + White Noise Machine (Both)', 'Luz Nocturna + Máquina de Sonido (Ambas)', 1),
  ('QRH-001-11', 'QRH-001', 11, 'Blackout Curtains', 'Cortinas blackout', 1),
  ('QRH-001-12', 'QRH-001', 12, 'Rocking Chair', 'Mecedora', 1),
  ('QRH-001-13', 'QRH-001', 13, 'Dresser', 'Cómoda', 1),
  ('QRH-001-14', 'QRH-001', 14, 'Changing Table', 'Cambiador', 1),
  ('QRH-001-15', 'QRH-001', 15, 'Dresser Organizer', 'Organizador de cómoda', 1),
  ('QRH-001-16', 'QRH-001', 16, 'Diaper & Cream Organizer', 'Organizador de pañales y cremas', 1),
  ('QRH-001-17', 'QRH-001', 17, 'Trash Bin', 'Basurero', 1),
  ('QRH-001-18', 'QRH-001', 18, 'Closet Organization', 'Organización del clóset', 1),
  ('QRH-001-19', 'QRH-001', 19, 'Humidifier', 'Humidificador', 1),
  ('QRH-001-20', 'QRH-001', 20, 'Thermometer', 'Termómetro ambiente', 1),
  ('QRH-001-21', 'QRH-001', 21, 'Decor', 'Decoración', 1),
  ('QRH-001-22', 'QRH-001', 22, 'Other', 'Otro', 1),
  ('QRH-002-01', 'QRH-002', 1, 'Bodysuits 0-3 Months', 'Bodys 0-3 Meses', 1),
  ('QRH-002-02', 'QRH-002', 2, 'Bodysuits 3-6 Months', 'Bodys 3-6 Meses', 1),
  ('QRH-002-03', 'QRH-002', 3, 'Bodysuits 6-9 Months', 'Bodys 6-9 Meses', 1),
  ('QRH-002-04', 'QRH-002', 4, 'Bodysuits 9-12 Months', 'Bodys 9-12 Meses', 1),
  ('QRH-002-05', 'QRH-002', 5, 'Sleepers 0-3 Months', 'Piyamas 0-3 Meses', 1),
  ('QRH-002-06', 'QRH-002', 6, 'Sleepers 3-6 Months', 'Piyamas 3-6 Meses', 1),
  ('QRH-002-07', 'QRH-002', 7, 'Sleepers 6-9 Months', 'Piyamas 6-9 Meses', 1),
  ('QRH-002-08', 'QRH-002', 8, 'Sleepers 9-12 Months', 'Piyamas 9-12 Meses', 1),
  ('QRH-002-09', 'QRH-002', 9, 'Shirts 0-3 Months', 'Camisas 0-3 Meses', 1),
  ('QRH-002-10', 'QRH-002', 10, 'Shirts 3-6 Months', 'Camisas 3-6 Meses', 1),
  ('QRH-002-11', 'QRH-002', 11, 'Shirts 6-9 Months', 'Camisas 6-9 Meses', 1),
  ('QRH-002-12', 'QRH-002', 12, 'Shirts 9-12 Months', 'Camisas 9-12 Meses', 1),
  ('QRH-002-13', 'QRH-002', 13, 'Pants 0-3 Months', 'Pantalones 0-3 Meses', 1),
  ('QRH-002-14', 'QRH-002', 14, 'Pants 3-6 Months', 'Pantalones 3-6 Meses', 1),
  ('QRH-002-15', 'QRH-002', 15, 'Pants 6-9 Months', 'Pantalones 6-9 Meses', 1),
  ('QRH-002-16', 'QRH-002', 16, 'Pants 9-12 Months', 'Pantalones 9-12 Meses', 1),
  ('QRH-002-17', 'QRH-002', 17, 'Outfit Set 0-3 Months (Shirt + Pants)', 'Conjunto 0-3 Meses (Camisa + Pantalón)', 1),
  ('QRH-002-18', 'QRH-002', 18, 'Outfit Set 3-6 Months (Shirt + Pants)', 'Conjunto 3-6 Meses (Camisa + Pantalón)', 1),
  ('QRH-002-19', 'QRH-002', 19, 'Outfit Set 6-9 Months (Shirt + Pants)', 'Conjunto 6-9 Meses (Camisa + Pantalón)', 1),
  ('QRH-002-20', 'QRH-002', 20, 'Outfit Set 9-12 Months (Shirt + Pants)', 'Conjunto 9-12 Meses (Camisa + Pantalón)', 1),
  ('QRH-002-21', 'QRH-002', 21, 'Socks 0-3 Months', 'Medias 0-3 Meses', 1),
  ('QRH-002-22', 'QRH-002', 22, 'Socks 3-6 Months', 'Medias 3-6 Meses', 1),
  ('QRH-002-23', 'QRH-002', 23, 'Socks 6-9 Months', 'Medias 6-9 Meses', 1),
  ('QRH-002-24', 'QRH-002', 24, 'Socks 9-12 Months', 'Medias 9-12 Meses', 1),
  ('QRH-002-25', 'QRH-002', 25, 'Hats 0-3 Months', 'Gorros 0-3 Meses', 1),
  ('QRH-002-26', 'QRH-002', 26, 'Hats 3-6 Months', 'Gorros 3-6 Meses', 1),
  ('QRH-002-27', 'QRH-002', 27, 'Mittens 0-3 Months', 'Manoplas 0-3 Meses', 1),
  ('QRH-002-28', 'QRH-002', 28, 'Mittens 3-6 Months', 'Manoplas 3-6 Meses', 1),
  ('QRH-002-29', 'QRH-002', 29, 'Shoes 3-6 Months', 'Calzado 3-6 Meses', 1),
  ('QRH-002-30', 'QRH-002', 30, 'Shoes 6-9 Months', 'Calzado 6-9 Meses', 1),
  ('QRH-002-31', 'QRH-002', 31, 'Shoes 9-12 Months', 'Calzado 9-12 Meses', 1),
  ('QRH-002-32', 'QRH-002', 32, 'Swaddles', 'Arrullos', 1),
  ('QRH-002-33', 'QRH-002', 33, 'Sleep Sacks', 'Sacos de dormir', 1),
  ('QRH-002-34', 'QRH-002', 34, 'Going Home Outfit', 'Outfit de salida', 1),
  ('QRH-002-35', 'QRH-002', 35, 'Hangers', 'Ganchos', 1),
  ('QRH-002-36', 'QRH-002', 36, 'Drawer Organizers', 'Organizadores de gaveta', 1),
  ('QRH-002-37', 'QRH-002', 37, 'Laundry Basket', 'Cesto de ropa', 1),
  ('QRH-002-38', 'QRH-002', 38, 'Other', 'Otro', 1),
  ('QRH-003-01', 'QRH-003', 1, 'Baby Tub', 'Bañera', 1),
  ('QRH-003-02', 'QRH-003', 2, 'Bath Support', 'Soporte de baño', 1),
  ('QRH-003-03', 'QRH-003', 3, 'Baby Tub Set (Tub + Support + Changing Table + Thermometer)', 'Set de Baño (Tina + Soporte + Cambiador + Termómetro)', 1),
  ('QRH-003-04', 'QRH-003', 4, 'Hooded Towels', 'Toallas con capucha', 1),
  ('QRH-003-05', 'QRH-003', 5, 'Washcloths', 'Paños', 1),
  ('QRH-003-06', 'QRH-003', 6, 'Baby Soap', 'Jabón', 1),
  ('QRH-003-07', 'QRH-003', 7, 'Shampoo', 'Shampoo', 1),
  ('QRH-003-08', 'QRH-003', 8, 'Lotion', 'Loción', 1),
  ('QRH-003-09', 'QRH-003', 9, 'Bath Thermometer', 'Termómetro de baño', 1),
  ('QRH-003-10', 'QRH-003', 10, 'Bath Toys', 'Juguetes de baño', 1),
  ('QRH-003-11', 'QRH-003', 11, 'Storage', 'Almacenaje', 1),
  ('QRH-003-12', 'QRH-003', 12, 'Other', 'Otro', 1),
  ('QRH-004-01', 'QRH-004', 1, 'Breast Pump', 'Sacaleches', 1),
  ('QRH-004-02', 'QRH-004', 2, 'Nursing Pillow', 'Cojín de lactancia', 1),
  ('QRH-004-03', 'QRH-004', 3, 'Milk Storage Bags', 'Bolsas de almacenamiento', 1),
  ('QRH-004-04', 'QRH-004', 4, 'Nursing Bras', 'Sujetadores de lactancia', 1),
  ('QRH-004-05', 'QRH-004', 5, 'Nipple Cream', 'Crema para pezones', 1),
  ('QRH-004-06', 'QRH-004', 6, 'Breast Pads', 'Discos absorbentes', 1),
  ('QRH-004-07', 'QRH-004', 7, 'Milk Catcher', 'Recolector de leche', 1),
  ('QRH-004-08', 'QRH-004', 8, 'Manual Pump', 'Sacaleches manual', 1),
  ('QRH-004-09', 'QRH-004', 9, 'Nursing Cover', 'Cubierta de lactancia', 1),
  ('QRH-004-10', 'QRH-004', 10, 'Cooler Bag', 'Bolsa térmica', 1),
  ('QRH-004-11', 'QRH-004', 11, 'Ice Packs', 'Compresas frías', 1),
  ('QRH-004-12', 'QRH-004', 12, 'Other', 'Otro', 1),
  ('QRH-005-01', 'QRH-005', 1, 'Bottles', 'Biberones', 1),
  ('QRH-005-02', 'QRH-005', 2, 'Bottle Nipples', 'Tetinas', 1),
  ('QRH-005-03', 'QRH-005', 3, 'Bottle Brush', 'Cepillo de biberones', 1),
  ('QRH-005-04', 'QRH-005', 4, 'Sterilizer', 'Esterilizador', 1),
  ('QRH-005-05', 'QRH-005', 5, 'Drying Rack', 'Escurridor', 1),
  ('QRH-005-06', 'QRH-005', 6, 'Sterilizer, Wash & Dry Rack (All-in-One)', 'Esterilizador, Lava y Escurre (Todo en Uno)', 1),
  ('QRH-005-07', 'QRH-005', 7, 'Formula', 'Fórmula', 1),
  ('QRH-005-08', 'QRH-005', 8, 'Formula Dispenser', 'Dispensador de fórmula', 1),
  ('QRH-005-09', 'QRH-005', 9, 'Bottle Warmer', 'Calentador de biberones', 1),
  ('QRH-005-10', 'QRH-005', 10, 'Burp Cloths', 'Paños de eructo', 1),
  ('QRH-005-11', 'QRH-005', 11, 'Bibs', 'Baberos', 1),
  ('QRH-005-12', 'QRH-005', 12, 'High Chair', 'Silla alta', 1),
  ('QRH-005-13', 'QRH-005', 13, 'Baby Utensils', 'Utensilios de bebé', 1),
  ('QRH-005-14', 'QRH-005', 14, 'Other', 'Otro', 1),
  ('QRH-006-01', 'QRH-006', 1, 'Pediatrician', 'Pediatra', 1),
  ('QRH-006-02', 'QRH-006', 2, 'OB/GYN', 'Ginecólogo', 1),
  ('QRH-006-03', 'QRH-006', 3, 'Vaccinations', 'Vacunas', 1),
  ('QRH-006-04', 'QRH-006', 4, 'Insurance', 'Seguro', 1),
  ('QRH-006-05', 'QRH-006', 5, 'Birth Registration', 'Registro de nacimiento', 1),
  ('QRH-006-06', 'QRH-006', 6, 'Medical Records', 'Historial médico', 1),
  ('QRH-006-07', 'QRH-006', 7, 'Pharmacy', 'Farmacia', 1),
  ('QRH-006-08', 'QRH-006', 8, 'Emergency Contacts', 'Contactos de emergencia', 1),
  ('QRH-006-09', 'QRH-006', 9, 'Medical Documents', 'Documentos médicos', 1),
  ('QRH-006-10', 'QRH-006', 10, 'Other', 'Otro', 1),
  ('QRH-007-01', 'QRH-007', 1, 'Going Home Outfit', 'Outfit de salida', 1),
  ('QRH-007-02', 'QRH-007', 2, 'Swaddle', 'Arrullo', 1),
  ('QRH-007-03', 'QRH-007', 3, 'Blanket', 'Cobija', 1),
  ('QRH-007-04', 'QRH-007', 4, 'Hat', 'Gorro', 1),
  ('QRH-007-05', 'QRH-007', 5, 'Diapers', 'Pañales', 1),
  ('QRH-007-06', 'QRH-007', 6, 'Wipes', 'Toallitas', 1),
  ('QRH-007-07', 'QRH-007', 7, 'Pacifier', 'Chupón', 1),
  ('QRH-007-08', 'QRH-007', 8, 'Bottles', 'Biberones', 1),
  ('QRH-007-09', 'QRH-007', 9, 'Car Seat', 'Silla de auto', 1),
  ('QRH-007-10', 'QRH-007', 10, 'Documents', 'Documentos', 1),
  ('QRH-007-11', 'QRH-007', 11, 'Other', 'Otro', 1),
  ('QRH-008-01', 'QRH-008', 1, 'Mom Clothes', 'Ropa de mamá', 1),
  ('QRH-008-02', 'QRH-008', 2, 'Dad Clothes', 'Ropa de papá', 1),
  ('QRH-008-03', 'QRH-008', 3, 'Nursing Bra', 'Sujetador de lactancia', 1),
  ('QRH-008-04', 'QRH-008', 4, 'Toiletries', 'Artículos de aseo', 1),
  ('QRH-008-05', 'QRH-008', 5, 'Chargers', 'Cargadores', 1),
  ('QRH-008-06', 'QRH-008', 6, 'Camera', 'Cámara', 1),
  ('QRH-008-07', 'QRH-008', 7, 'Snacks', 'Snacks', 1),
  ('QRH-008-08', 'QRH-008', 8, 'Water Bottle', 'Botella de agua', 1),
  ('QRH-008-09', 'QRH-008', 9, 'Pillow', 'Almohada', 1),
  ('QRH-008-10', 'QRH-008', 10, 'Slippers', 'Pantuflas', 1),
  ('QRH-008-11', 'QRH-008', 11, 'Documents', 'Documentos', 1),
  ('QRH-008-12', 'QRH-008', 12, 'Entertainment', 'Entretenimiento', 1),
  ('QRH-008-13', 'QRH-008', 13, 'Other', 'Otro', 1),
  ('QRH-009-01', 'QRH-009', 1, 'Peri Bottle', 'Botella perineal', 1),
  ('QRH-009-02', 'QRH-009', 2, 'Ice Pads', 'Compresas frías', 1),
  ('QRH-009-03', 'QRH-009', 3, 'Maternity Pads', 'Toallas de maternidad', 1),
  ('QRH-009-04', 'QRH-009', 4, 'Disposable Underwear', 'Ropa interior desechable', 1),
  ('QRH-009-05', 'QRH-009', 5, 'Nursing Bras', 'Sujetadores de lactancia', 1),
  ('QRH-009-06', 'QRH-009', 6, 'Nipple Cream', 'Crema para pezones', 1),
  ('QRH-009-07', 'QRH-009', 7, 'Sitz Bath', 'Baño de asiento', 1),
  ('QRH-009-08', 'QRH-009', 8, 'Pain Relief', 'Analgésicos', 1),
  ('QRH-009-09', 'QRH-009', 9, 'Stool Softener', 'Ablandador de heces', 1),
  ('QRH-009-10', 'QRH-009', 10, 'Water Bottle', 'Botella de agua', 1),
  ('QRH-009-11', 'QRH-009', 11, 'Recovery Pillow', 'Almohada de recuperación', 1),
  ('QRH-009-12', 'QRH-009', 12, 'Frida Mom Kit (Disposable Underwear + Ice Pads + Pain Relief)', 'Kit Frida Mom (Ropa Interior Desechable + Compresas Frías + Analgésicos)', 1),
  ('QRH-009-13', 'QRH-009', 13, 'Other', 'Otro', 1),
  ('QRH-010-01', 'QRH-010', 1, 'Compression Socks', 'Medias de compresión', 1),
  ('QRH-010-02', 'QRH-010', 2, 'Belly Oil', 'Aceite para vientre', 1),
  ('QRH-010-03', 'QRH-010', 3, 'Stretch Mark Cream', 'Crema antiestrías', 1),
  ('QRH-010-04', 'QRH-010', 4, 'Magnesium', 'Magnesio', 1),
  ('QRH-010-05', 'QRH-010', 5, 'Prenatal Vitamins', 'Vitaminas prenatales', 1),
  ('QRH-010-06', 'QRH-010', 6, 'Pregnancy Pillow', 'Almohada de embarazo', 1),
  ('QRH-010-07', 'QRH-010', 7, 'Belly Band', 'Banda de maternidad', 1),
  ('QRH-010-08', 'QRH-010', 8, 'Heating Pad', 'Almohadilla térmica', 1),
  ('QRH-010-09', 'QRH-010', 9, 'Lip Balm', 'Bálsamo labial', 1),
  ('QRH-010-10', 'QRH-010', 10, 'Electrolytes', 'Electrolitos', 1),
  ('QRH-010-11', 'QRH-010', 11, 'Snacks', 'Snacks', 1),
  ('QRH-010-12', 'QRH-010', 12, 'Journal', 'Diario', 1),
  ('QRH-010-13', 'QRH-010', 13, 'Other', 'Otro', 1),
  ('QRH-011-01', 'QRH-011', 1, 'Stroller', 'Carrito', 1),
  ('QRH-011-02', 'QRH-011', 2, 'Car Seat', 'Silla de auto', 1),
  ('QRH-011-03', 'QRH-011', 3, 'Baby Carrier', 'Portabebé', 1),
  ('QRH-011-04', 'QRH-011', 4, 'Diaper Bag', 'Pañalera', 1),
  ('QRH-011-05', 'QRH-011', 5, 'Travel Organizer', 'Organizador de viaje', 1),
  ('QRH-011-06', 'QRH-011', 6, 'Rain Cover', 'Cubierta de lluvia', 1),
  ('QRH-011-07', 'QRH-011', 7, 'Stroller Fan', 'Ventilador de carrito', 1),
  ('QRH-011-08', 'QRH-011', 8, 'Cup Holder', 'Portavasos', 1),
  ('QRH-011-09', 'QRH-011', 9, 'Car Mirror', 'Espejo de auto', 1),
  ('QRH-011-10', 'QRH-011', 10, 'Car Organizer', 'Organizador de auto', 1),
  ('QRH-011-11', 'QRH-011', 11, 'Other', 'Otro', 1),
  ('QRH-012-01', 'QRH-012', 1, 'Car Seat Installed', 'Silla de auto instalada', 1),
  ('QRH-012-02', 'QRH-012', 2, 'Nursery Ready', 'Cuarto listo', 1),
  ('QRH-012-03', 'QRH-012', 3, 'Feeding Station Ready', 'Estación de alimentación lista', 1),
  ('QRH-012-04', 'QRH-012', 4, 'Diaper Station Ready', 'Estación de pañales lista', 1),
  ('QRH-012-05', 'QRH-012', 5, 'Bassinet Ready', 'Moisés listo', 1),
  ('QRH-012-06', 'QRH-012', 6, 'First Pediatric Appointment', 'Primera cita pediátrica', 1),
  ('QRH-012-07', 'QRH-012', 7, 'Home Essentials Stocked', 'Esenciales del hogar listos', 1),
  ('QRH-012-08', 'QRH-012', 8, 'Family Contact List', 'Lista de contactos familiares', 1),
  ('QRH-012-09', 'QRH-012', 9, 'Other', 'Otro', 1),
  ('QRH-013-01', 'QRH-013', 1, 'Skin Cream', 'Crema para la piel', 1),
  ('QRH-013-02', 'QRH-013', 2, 'Diaper Rash Cream', 'Crema para el culito', 1),
  ('QRH-013-03', 'QRH-013', 3, 'Vitamins & Supplements', 'Vitaminas o suplementos', 1),
  ('QRH-013-04', 'QRH-013', 4, 'Thermometer', 'Termómetro', 1),
  ('QRH-013-05', 'QRH-013', 5, 'Nasal Aspirator', 'Saca mocos', 1),
  ('QRH-013-06', 'QRH-013', 6, 'Nebulizer', 'Nebulizador', 1),
  ('QRH-013-07', 'QRH-013', 7, 'Nasal Aspirator + Nebulizer (Both)', 'Saca Mocos + Nebulizador (Ambos)', 1),
  ('QRH-013-08', 'QRH-013', 8, 'Hand Sanitizer', 'Alcohol en gel', 1),
  ('QRH-013-09', 'QRH-013', 9, 'Emergency Kit', 'Kit de emergencia', 1),
  ('QRH-013-10', 'QRH-013', 10, 'Other', 'Otro', 1)
on conflict (code) do nothing;

-- Mapa de combos: 216 relaciones (docs/01 §6.3)
insert into item_satisfied_by (item_code, source_item_code) values
  ('QRH-001-01', 'QRH-001-01'),
  ('QRH-001-02', 'QRH-001-02'),
  ('QRH-001-03', 'QRH-001-03'),
  ('QRH-001-04', 'QRH-001-04'),
  ('QRH-001-05', 'QRH-001-05'),
  ('QRH-001-06', 'QRH-001-06'),
  ('QRH-001-06', 'QRH-001-07'),
  ('QRH-001-07', 'QRH-001-07'),
  ('QRH-001-08', 'QRH-001-08'),
  ('QRH-001-08', 'QRH-001-10'),
  ('QRH-001-09', 'QRH-001-09'),
  ('QRH-001-09', 'QRH-001-10'),
  ('QRH-001-10', 'QRH-001-10'),
  ('QRH-001-11', 'QRH-001-11'),
  ('QRH-001-12', 'QRH-001-12'),
  ('QRH-001-13', 'QRH-001-13'),
  ('QRH-001-14', 'QRH-001-14'),
  ('QRH-001-14', 'QRH-003-03'),
  ('QRH-001-15', 'QRH-001-15'),
  ('QRH-001-16', 'QRH-001-16'),
  ('QRH-001-17', 'QRH-001-17'),
  ('QRH-001-18', 'QRH-001-18'),
  ('QRH-001-19', 'QRH-001-19'),
  ('QRH-001-20', 'QRH-001-20'),
  ('QRH-001-20', 'QRH-001-07'),
  ('QRH-001-21', 'QRH-001-21'),
  ('QRH-001-22', 'QRH-001-22'),
  ('QRH-002-01', 'QRH-002-01'),
  ('QRH-002-02', 'QRH-002-02'),
  ('QRH-002-03', 'QRH-002-03'),
  ('QRH-002-04', 'QRH-002-04'),
  ('QRH-002-05', 'QRH-002-05'),
  ('QRH-002-06', 'QRH-002-06'),
  ('QRH-002-07', 'QRH-002-07'),
  ('QRH-002-08', 'QRH-002-08'),
  ('QRH-002-09', 'QRH-002-09'),
  ('QRH-002-09', 'QRH-002-17'),
  ('QRH-002-10', 'QRH-002-10'),
  ('QRH-002-10', 'QRH-002-18'),
  ('QRH-002-11', 'QRH-002-11'),
  ('QRH-002-11', 'QRH-002-19'),
  ('QRH-002-12', 'QRH-002-12'),
  ('QRH-002-12', 'QRH-002-20'),
  ('QRH-002-13', 'QRH-002-13'),
  ('QRH-002-13', 'QRH-002-17'),
  ('QRH-002-14', 'QRH-002-14'),
  ('QRH-002-14', 'QRH-002-18'),
  ('QRH-002-15', 'QRH-002-15'),
  ('QRH-002-15', 'QRH-002-19'),
  ('QRH-002-16', 'QRH-002-16'),
  ('QRH-002-16', 'QRH-002-20'),
  ('QRH-002-17', 'QRH-002-17'),
  ('QRH-002-18', 'QRH-002-18'),
  ('QRH-002-19', 'QRH-002-19'),
  ('QRH-002-20', 'QRH-002-20'),
  ('QRH-002-21', 'QRH-002-21'),
  ('QRH-002-22', 'QRH-002-22'),
  ('QRH-002-23', 'QRH-002-23'),
  ('QRH-002-24', 'QRH-002-24'),
  ('QRH-002-25', 'QRH-002-25'),
  ('QRH-002-26', 'QRH-002-26'),
  ('QRH-002-27', 'QRH-002-27'),
  ('QRH-002-28', 'QRH-002-28'),
  ('QRH-002-29', 'QRH-002-29'),
  ('QRH-002-30', 'QRH-002-30'),
  ('QRH-002-31', 'QRH-002-31'),
  ('QRH-002-32', 'QRH-002-32'),
  ('QRH-002-33', 'QRH-002-33'),
  ('QRH-002-34', 'QRH-002-34'),
  ('QRH-002-35', 'QRH-002-35'),
  ('QRH-002-36', 'QRH-002-36'),
  ('QRH-002-37', 'QRH-002-37'),
  ('QRH-002-38', 'QRH-002-38'),
  ('QRH-003-01', 'QRH-003-01'),
  ('QRH-003-01', 'QRH-003-03'),
  ('QRH-003-02', 'QRH-003-02'),
  ('QRH-003-02', 'QRH-003-03'),
  ('QRH-003-03', 'QRH-003-03'),
  ('QRH-003-04', 'QRH-003-04'),
  ('QRH-003-05', 'QRH-003-05'),
  ('QRH-003-06', 'QRH-003-06'),
  ('QRH-003-07', 'QRH-003-07'),
  ('QRH-003-08', 'QRH-003-08'),
  ('QRH-003-09', 'QRH-003-09'),
  ('QRH-003-09', 'QRH-003-03'),
  ('QRH-003-10', 'QRH-003-10'),
  ('QRH-003-11', 'QRH-003-11'),
  ('QRH-003-12', 'QRH-003-12'),
  ('QRH-004-01', 'QRH-004-01'),
  ('QRH-004-02', 'QRH-004-02'),
  ('QRH-004-03', 'QRH-004-03'),
  ('QRH-004-04', 'QRH-004-04'),
  ('QRH-004-04', 'QRH-009-05'),
  ('QRH-004-05', 'QRH-004-05'),
  ('QRH-004-05', 'QRH-009-06'),
  ('QRH-004-06', 'QRH-004-06'),
  ('QRH-004-07', 'QRH-004-07'),
  ('QRH-004-08', 'QRH-004-08'),
  ('QRH-004-09', 'QRH-004-09'),
  ('QRH-004-10', 'QRH-004-10'),
  ('QRH-004-11', 'QRH-004-11'),
  ('QRH-004-12', 'QRH-004-12'),
  ('QRH-005-01', 'QRH-005-01'),
  ('QRH-005-02', 'QRH-005-02'),
  ('QRH-005-03', 'QRH-005-03'),
  ('QRH-005-03', 'QRH-005-06'),
  ('QRH-005-04', 'QRH-005-04'),
  ('QRH-005-04', 'QRH-005-06'),
  ('QRH-005-05', 'QRH-005-05'),
  ('QRH-005-05', 'QRH-005-06'),
  ('QRH-005-06', 'QRH-005-06'),
  ('QRH-005-07', 'QRH-005-07'),
  ('QRH-005-08', 'QRH-005-08'),
  ('QRH-005-09', 'QRH-005-09'),
  ('QRH-005-10', 'QRH-005-10'),
  ('QRH-005-11', 'QRH-005-11'),
  ('QRH-005-12', 'QRH-005-12'),
  ('QRH-005-13', 'QRH-005-13'),
  ('QRH-005-14', 'QRH-005-14'),
  ('QRH-006-01', 'QRH-006-01'),
  ('QRH-006-02', 'QRH-006-02'),
  ('QRH-006-03', 'QRH-006-03'),
  ('QRH-006-04', 'QRH-006-04'),
  ('QRH-006-05', 'QRH-006-05'),
  ('QRH-006-06', 'QRH-006-06'),
  ('QRH-006-07', 'QRH-006-07'),
  ('QRH-006-08', 'QRH-006-08'),
  ('QRH-006-09', 'QRH-006-09'),
  ('QRH-006-10', 'QRH-006-10'),
  ('QRH-007-01', 'QRH-007-01'),
  ('QRH-007-02', 'QRH-007-02'),
  ('QRH-007-03', 'QRH-007-03'),
  ('QRH-007-04', 'QRH-007-04'),
  ('QRH-007-05', 'QRH-007-05'),
  ('QRH-007-06', 'QRH-007-06'),
  ('QRH-007-07', 'QRH-007-07'),
  ('QRH-007-08', 'QRH-007-08'),
  ('QRH-007-09', 'QRH-007-09'),
  ('QRH-007-10', 'QRH-007-10'),
  ('QRH-007-11', 'QRH-007-11'),
  ('QRH-008-01', 'QRH-008-01'),
  ('QRH-008-02', 'QRH-008-02'),
  ('QRH-008-03', 'QRH-008-03'),
  ('QRH-008-04', 'QRH-008-04'),
  ('QRH-008-05', 'QRH-008-05'),
  ('QRH-008-06', 'QRH-008-06'),
  ('QRH-008-07', 'QRH-008-07'),
  ('QRH-008-08', 'QRH-008-08'),
  ('QRH-008-09', 'QRH-008-09'),
  ('QRH-008-10', 'QRH-008-10'),
  ('QRH-008-11', 'QRH-008-11'),
  ('QRH-008-12', 'QRH-008-12'),
  ('QRH-008-13', 'QRH-008-13'),
  ('QRH-009-01', 'QRH-009-01'),
  ('QRH-009-02', 'QRH-009-02'),
  ('QRH-009-02', 'QRH-009-12'),
  ('QRH-009-03', 'QRH-009-03'),
  ('QRH-009-04', 'QRH-009-04'),
  ('QRH-009-04', 'QRH-009-12'),
  ('QRH-009-05', 'QRH-009-05'),
  ('QRH-009-05', 'QRH-004-04'),
  ('QRH-009-06', 'QRH-009-06'),
  ('QRH-009-06', 'QRH-004-05'),
  ('QRH-009-07', 'QRH-009-07'),
  ('QRH-009-08', 'QRH-009-08'),
  ('QRH-009-08', 'QRH-009-12'),
  ('QRH-009-09', 'QRH-009-09'),
  ('QRH-009-10', 'QRH-009-10'),
  ('QRH-009-11', 'QRH-009-11'),
  ('QRH-009-12', 'QRH-009-12'),
  ('QRH-009-13', 'QRH-009-13'),
  ('QRH-010-01', 'QRH-010-01'),
  ('QRH-010-02', 'QRH-010-02'),
  ('QRH-010-03', 'QRH-010-03'),
  ('QRH-010-04', 'QRH-010-04'),
  ('QRH-010-05', 'QRH-010-05'),
  ('QRH-010-06', 'QRH-010-06'),
  ('QRH-010-07', 'QRH-010-07'),
  ('QRH-010-08', 'QRH-010-08'),
  ('QRH-010-09', 'QRH-010-09'),
  ('QRH-010-10', 'QRH-010-10'),
  ('QRH-010-11', 'QRH-010-11'),
  ('QRH-010-12', 'QRH-010-12'),
  ('QRH-010-13', 'QRH-010-13'),
  ('QRH-011-01', 'QRH-011-01'),
  ('QRH-011-02', 'QRH-011-02'),
  ('QRH-011-03', 'QRH-011-03'),
  ('QRH-011-04', 'QRH-011-04'),
  ('QRH-011-05', 'QRH-011-05'),
  ('QRH-011-06', 'QRH-011-06'),
  ('QRH-011-07', 'QRH-011-07'),
  ('QRH-011-08', 'QRH-011-08'),
  ('QRH-011-09', 'QRH-011-09'),
  ('QRH-011-10', 'QRH-011-10'),
  ('QRH-011-11', 'QRH-011-11'),
  ('QRH-012-01', 'QRH-012-01'),
  ('QRH-012-02', 'QRH-012-02'),
  ('QRH-012-03', 'QRH-012-03'),
  ('QRH-012-04', 'QRH-012-04'),
  ('QRH-012-05', 'QRH-012-05'),
  ('QRH-012-06', 'QRH-012-06'),
  ('QRH-012-07', 'QRH-012-07'),
  ('QRH-012-08', 'QRH-012-08'),
  ('QRH-012-09', 'QRH-012-09'),
  ('QRH-013-01', 'QRH-013-01'),
  ('QRH-013-02', 'QRH-013-02'),
  ('QRH-013-03', 'QRH-013-03'),
  ('QRH-013-04', 'QRH-013-04'),
  ('QRH-013-05', 'QRH-013-05'),
  ('QRH-013-05', 'QRH-013-07'),
  ('QRH-013-06', 'QRH-013-06'),
  ('QRH-013-06', 'QRH-013-07'),
  ('QRH-013-07', 'QRH-013-07'),
  ('QRH-013-08', 'QRH-013-08'),
  ('QRH-013-09', 'QRH-013-09'),
  ('QRH-013-10', 'QRH-013-10')
on conflict do nothing;

-- ==========================================================================
-- 20260831000500_alta_flexible.sql
-- ==========================================================================
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

-- ==========================================================================
-- 20260831000600_invitacion_un_solo_uso.sql
-- ==========================================================================
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

-- ==========================================================================
-- 20260831000700_lista_regalos.sql
-- ==========================================================================
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

create type share_kind as enum ('registry');

create table share_links (
  token      text primary key,
  project_id uuid not null references projects(id) on delete cascade,
  kind       share_kind not null default 'registry',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index on share_links (project_id);

alter table share_links enable row level security;

-- Sólo los miembros ven y gestionan los enlaces de su propio proyecto.
-- Quien use el enlace no toca esta tabla: entra por las funciones de abajo.
create policy "miembros gestionan sus enlaces" on share_links
  for all to authenticated
  using (is_project_member(project_id)) with check (is_project_member(project_id));

-- Quién se apuntó a comprar cada cosa.
alter table products add column reserved_by_name text;
alter table products add column reserved_at      timestamptz;

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

-- ==========================================================================
-- 20260831000800_sugerencias.sql
-- ==========================================================================
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

commit;
