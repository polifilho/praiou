-- =========================
-- REGIÕES
-- =========================
create table regions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- =========================
-- PRAIAS
-- =========================
create table beaches (
  id uuid primary key default gen_random_uuid(),
  region_id uuid references regions(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- =========================
-- BARRAQUEIROS (NEGÓCIO)
-- =========================
create table vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  beach_id uuid references beaches(id) on delete set null,
  description text,
  rating_avg numeric default 0,
  rating_count int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- =========================
-- USUÁRIOS (CLIENTES - PERFIL)
-- =========================
create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz default now()
);

-- =========================
-- RELAÇÃO USUÁRIO ⇄ BARRACA
-- =========================
create table vendor_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  vendor_id uuid references vendors(id) on delete cascade,
  role text default 'OWNER',
  created_at timestamptz default now(),
  unique (user_id, vendor_id)
);

-- =========================
-- ITENS DO BARRAQUEIRO
-- =========================
create table vendor_items (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references vendors(id) on delete cascade,
  name text not null,
  price numeric not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- =========================
-- RESERVAS
-- =========================
create table reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  vendor_id uuid references vendors(id) on delete cascade,
  beach_id uuid references beaches(id),
  arrival_time timestamptz not null,
  expires_at timestamptz not null,
  status text not null check (
    status in ('PENDING', 'CONFIRMED', 'ARRIVED', 'NO_SHOW', 'CANCELED')
  ),
  total numeric not null,
  created_at timestamptz default now()
);

-- =========================
-- ITENS DA RESERVA
-- =========================
create table reservation_items (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references reservations(id) on delete cascade,
  item_id uuid references vendor_items(id),
  quantity int not null,
  unit_price numeric not null
);
