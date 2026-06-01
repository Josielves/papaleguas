-- ============================================================
-- PAPALEGUAS - Supabase schema
-- Auth, perfis, Pix, regioes, rotas, reservas, chat e realtime
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ============================================================
-- PERFIS
-- Compatível com os nomes usados no app atual e no schema anterior.
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  full_name text,
  name text,
  role text,
  account_type text,
  avatar_url text,
  phone text,
  pix_key text,
  rating numeric(2, 1) default 5.0,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists auth_user_id uuid unique;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists role text;
alter table public.profiles add column if not exists account_type text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists pix_key text;
alter table public.profiles add column if not exists rating numeric(2, 1) default 5.0;

-- ============================================================
-- REGIOES E PRECOS
-- ============================================================
create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  is_center boolean default false,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

insert into public.regions (name, slug, is_center, lat, lng) values
  ('Centro', 'centro', true, -3.7327, -38.5270),
  ('Norte', 'norte', false, -3.6900, -38.5270),
  ('Sul', 'sul', false, -3.8000, -38.5270),
  ('Leste', 'leste', false, -3.7327, -38.4700),
  ('Oeste', 'oeste', false, -3.7327, -38.5900)
on conflict (slug) do update
set name = excluded.name,
    is_center = excluded.is_center,
    lat = excluded.lat,
    lng = excluded.lng;

create table if not exists public.region_fares (
  id uuid primary key default gen_random_uuid(),
  origin_region text not null,
  destination_region text not null,
  fare numeric(10, 2) not null check (fare >= 0),
  label text not null,
  unique (origin_region, destination_region)
);

insert into public.region_fares (origin_region, destination_region, fare, label)
values
  ('Centro', 'Centro', 7, 'Mesma regiao'),
  ('Norte', 'Norte', 7, 'Mesma regiao'),
  ('Sul', 'Sul', 7, 'Mesma regiao'),
  ('Leste', 'Leste', 7, 'Mesma regiao'),
  ('Oeste', 'Oeste', 7, 'Mesma regiao'),
  ('Centro', 'Norte', 9, 'Centro para regiao'),
  ('Centro', 'Sul', 9, 'Centro para regiao'),
  ('Centro', 'Leste', 9, 'Centro para regiao'),
  ('Centro', 'Oeste', 9, 'Centro para regiao'),
  ('Norte', 'Centro', 9, 'Regiao para centro'),
  ('Sul', 'Centro', 9, 'Regiao para centro'),
  ('Leste', 'Centro', 9, 'Regiao para centro'),
  ('Oeste', 'Centro', 9, 'Regiao para centro'),
  ('Norte', 'Sul', 16, 'Extremos de regioes'),
  ('Sul', 'Norte', 16, 'Extremos de regioes'),
  ('Leste', 'Oeste', 16, 'Extremos de regioes'),
  ('Oeste', 'Leste', 16, 'Extremos de regioes'),
  ('Norte', 'Leste', 12, 'Regioes adjacentes'),
  ('Norte', 'Oeste', 12, 'Regioes adjacentes'),
  ('Sul', 'Leste', 12, 'Regioes adjacentes'),
  ('Sul', 'Oeste', 12, 'Regioes adjacentes'),
  ('Leste', 'Norte', 12, 'Regioes adjacentes'),
  ('Oeste', 'Norte', 12, 'Regioes adjacentes'),
  ('Leste', 'Sul', 12, 'Regioes adjacentes'),
  ('Oeste', 'Sul', 12, 'Regioes adjacentes')
on conflict (origin_region, destination_region) do update
set fare = excluded.fare,
    label = excluded.label;

-- ============================================================
-- DOCUMENTOS, VEICULOS E ROTAS
-- ============================================================
create table if not exists public.driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id) on delete cascade,
  cnh_number text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id) on delete cascade,
  model text,
  color text,
  plate text,
  seats integer not null default 4 check (seats > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  origin_neighborhood text,
  destination text,
  stop_neighborhoods text[] not null default '{}',
  origin_region text not null default 'Centro',
  destination_region text not null default 'Centro',
  origin_address text,
  destination_address text,
  origin_lat double precision,
  origin_lng double precision,
  destination_lat double precision,
  destination_lng double precision,
  current_lat double precision,
  current_lng double precision,
  departure_time timestamptz,
  total_seats integer not null default 4 check (total_seats > 0),
  available_seats integer not null default 4 check (available_seats >= 0),
  fixed_price numeric(10, 2),
  price numeric(10, 2),
  status text not null default 'open' check (status in ('open', 'full', 'in_progress', 'completed', 'cancelled')),
  in_route boolean not null default false,
  active boolean not null default true,
  vehicle_model text,
  vehicle_plate text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.routes add column if not exists origin_neighborhood text;
alter table public.routes add column if not exists destination text;
alter table public.routes add column if not exists stop_neighborhoods text[] not null default '{}';
alter table public.routes add column if not exists origin_region text not null default 'Centro';
alter table public.routes add column if not exists destination_region text not null default 'Centro';
alter table public.routes add column if not exists origin_address text;
alter table public.routes add column if not exists destination_address text;
alter table public.routes add column if not exists current_lat double precision;
alter table public.routes add column if not exists current_lng double precision;
alter table public.routes add column if not exists available_seats integer not null default 4;
alter table public.routes add column if not exists fixed_price numeric(10, 2);
alter table public.routes add column if not exists price numeric(10, 2);
alter table public.routes add column if not exists in_route boolean not null default false;
alter table public.routes add column if not exists active boolean not null default true;

create table if not exists public.route_schedules (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  departure_time time not null,
  weekdays integer[] not null default '{1,2,3,4,5}',
  created_at timestamptz not null default now()
);

-- ============================================================
-- RESERVAS, ASSENTOS, PAGAMENTO PIX E CHAT
-- ============================================================
create table if not exists public.seats (
  id uuid primary key default gen_random_uuid(),
  route_id uuid references public.routes(id) on delete cascade not null,
  seat_number integer not null,
  status text not null default 'available' check (status in ('available', 'reserved', 'occupied')),
  passenger_id uuid references public.profiles(id) on delete set null,
  reserved_at timestamptz,
  unique (route_id, seat_number)
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  passenger_id uuid not null references public.profiles(id) on delete cascade,
  schedule_id uuid references public.route_schedules(id) on delete set null,
  travel_date date default current_date,
  status text not null default 'reserved' check (status in ('reserved', 'accepted', 'cancelled', 'completed')),
  payment_method text not null default 'pix' check (payment_method in ('pix')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'refunded')),
  paid_amount numeric(10, 2),
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  route_id uuid references public.routes(id) on delete cascade not null,
  passenger_id uuid references public.profiles(id) on delete cascade not null,
  seat_id uuid references public.seats(id) on delete set null,
  seat_number integer,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  price numeric(10, 2),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  unique (route_id, passenger_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references public.reservations(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  route_id uuid references public.routes(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text,
  content text,
  read boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references public.reservations(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewed_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PERFIL AUTOMATICO AO CADASTRAR NO SUPABASE AUTH
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_account_type text;
  v_name text;
begin
  v_role := coalesce(new.raw_user_meta_data ->> 'role', 'passenger');
  v_account_type := case when v_role = 'driver' then 'motorista' else 'cliente' end;
  v_name := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1));

  insert into public.profiles (id, auth_user_id, full_name, name, role, account_type, avatar_url, phone, pix_key)
  values (
    new.id,
    new.id,
    v_name,
    v_name,
    v_role,
    v_account_type,
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'pix_key'
  )
  on conflict (id) do update
  set
    auth_user_id = excluded.auth_user_id,
    full_name = excluded.full_name,
    name = excluded.name,
    role = excluded.role,
    account_type = excluded.account_type,
    avatar_url = excluded.avatar_url,
    phone = excluded.phone,
    pix_key = excluded.pix_key;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- ============================================================
-- FUNCOES
-- ============================================================
create or replace function public.reserve_seat(
  p_route_id uuid,
  p_passenger_id uuid,
  p_seat_number integer default null,
  p_pickup_address text default null,
  p_pickup_lat double precision default null,
  p_pickup_lng double precision default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_seat_id uuid;
  v_seat_number integer;
  v_price numeric;
  v_booking_id uuid;
  v_available integer;
begin
  select available_seats, coalesce(price, fixed_price)
  into v_available, v_price
  from public.routes
  where id = p_route_id and active = true and status in ('open', 'in_progress')
  for update;

  if not found then
    return json_build_object('error', 'Rota nao encontrada ou indisponivel');
  end if;

  if v_available <= 0 then
    return json_build_object('error', 'Sem assentos disponiveis');
  end if;

  if p_seat_number is not null then
    select id, seat_number into v_seat_id, v_seat_number
    from public.seats
    where route_id = p_route_id and seat_number = p_seat_number and status = 'available'
    for update;
  else
    select id, seat_number into v_seat_id, v_seat_number
    from public.seats
    where route_id = p_route_id and status = 'available'
    order by seat_number
    limit 1
    for update;
  end if;

  if v_seat_id is null then
    insert into public.seats (route_id, seat_number, status, passenger_id, reserved_at)
    values (p_route_id, v_available, 'reserved', p_passenger_id, now())
    returning id, seat_number into v_seat_id, v_seat_number;
  else
    update public.seats
    set status = 'reserved', passenger_id = p_passenger_id, reserved_at = now()
    where id = v_seat_id;
  end if;

  insert into public.bookings (route_id, passenger_id, seat_id, seat_number, pickup_address, pickup_lat, pickup_lng, price)
  values (p_route_id, p_passenger_id, v_seat_id, v_seat_number, p_pickup_address, p_pickup_lat, p_pickup_lng, v_price)
  on conflict (route_id, passenger_id) do update
  set status = 'confirmed'
  returning id into v_booking_id;

  insert into public.reservations (route_id, passenger_id, status, payment_method, payment_status, paid_amount)
  values (p_route_id, p_passenger_id, 'reserved', 'pix', 'pending', v_price);

  update public.routes
  set available_seats = greatest(available_seats - 1, 0),
      status = case when greatest(available_seats - 1, 0) = 0 then 'full' else status end
  where id = p_route_id;

  return json_build_object('success', true, 'booking_id', v_booking_id, 'seat_number', v_seat_number, 'price', v_price);
end;
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles enable row level security;
alter table public.driver_documents enable row level security;
alter table public.vehicles enable row level security;
alter table public.routes enable row level security;
alter table public.route_schedules enable row level security;
alter table public.seats enable row level security;
alter table public.reservations enable row level security;
alter table public.bookings enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "Profiles are readable by authenticated users" on public.profiles;
create policy "Profiles are readable by authenticated users"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = auth_user_id or auth.uid() = id)
with check (auth.uid() = auth_user_id or auth.uid() = id);

drop policy if exists "Routes are readable by everyone" on public.routes;
create policy "Routes are readable by everyone"
on public.routes for select
to anon, authenticated
using (active = true and available_seats > 0);

drop policy if exists "Drivers can manage own routes" on public.routes;
create policy "Drivers can manage own routes"
on public.routes for all
to authenticated
using (driver_id in (select id from public.profiles where auth_user_id = auth.uid() or id = auth.uid()))
with check (driver_id in (select id from public.profiles where auth_user_id = auth.uid() or id = auth.uid()));

drop policy if exists "Seats are readable by authenticated users" on public.seats;
create policy "Seats are readable by authenticated users"
on public.seats for select
to authenticated
using (true);

drop policy if exists "Passengers can create own reservations" on public.reservations;
create policy "Passengers can create own reservations"
on public.reservations for insert
to authenticated
with check (passenger_id in (select id from public.profiles where auth_user_id = auth.uid() or id = auth.uid()));

drop policy if exists "Users can read related reservations" on public.reservations;
create policy "Users can read related reservations"
on public.reservations for select
to authenticated
using (
  passenger_id in (select id from public.profiles where auth_user_id = auth.uid() or id = auth.uid())
  or route_id in (
    select r.id
    from public.routes r
    join public.profiles p on p.id = r.driver_id
    where p.auth_user_id = auth.uid() or p.id = auth.uid()
  )
);

drop policy if exists "Users can read related bookings" on public.bookings;
create policy "Users can read related bookings"
on public.bookings for select
to authenticated
using (
  passenger_id in (select id from public.profiles where auth_user_id = auth.uid() or id = auth.uid())
  or route_id in (
    select r.id
    from public.routes r
    join public.profiles p on p.id = r.driver_id
    where p.auth_user_id = auth.uid() or p.id = auth.uid()
  )
);

drop policy if exists "Passengers can create own bookings" on public.bookings;
create policy "Passengers can create own bookings"
on public.bookings for insert
to authenticated
with check (passenger_id in (select id from public.profiles where auth_user_id = auth.uid() or id = auth.uid()));

drop policy if exists "Users can read messages from reserved trips" on public.messages;
create policy "Users can read messages from reserved trips"
on public.messages for select
to authenticated
using (
  sender_id in (select id from public.profiles where auth_user_id = auth.uid() or id = auth.uid())
  or reservation_id in (
    select rr.id
    from public.reservations rr
    where rr.passenger_id in (select id from public.profiles where auth_user_id = auth.uid() or id = auth.uid())
       or rr.route_id in (
        select r.id
        from public.routes r
        join public.profiles p on p.id = r.driver_id
        where p.auth_user_id = auth.uid() or p.id = auth.uid()
      )
  )
  or booking_id in (
    select b.id
    from public.bookings b
    where b.passenger_id in (select id from public.profiles where auth_user_id = auth.uid() or id = auth.uid())
  )
);

drop policy if exists "Users can send messages after reservation" on public.messages;
create policy "Users can send messages after reservation"
on public.messages for insert
to authenticated
with check (sender_id in (select id from public.profiles where auth_user_id = auth.uid() or id = auth.uid()));

-- ============================================================
-- REALTIME
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'routes'
  ) then
    alter publication supabase_realtime add table public.routes;
  end if;

  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'seats'
  ) then
    alter publication supabase_realtime add table public.seats;
  end if;

  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;

  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reservations'
  ) then
    alter publication supabase_realtime add table public.reservations;
  end if;

  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
