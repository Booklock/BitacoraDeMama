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
