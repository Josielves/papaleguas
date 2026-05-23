create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  full_name text not null,
  role text not null check (role in ('passenger', 'driver')),
  avatar_url text,
  phone text,
  rating numeric(2, 1) default 5.0,
  created_at timestamptz not null default now()
);

create table if not exists public.driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id) on delete cascade,
  cnh_number text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id) on delete cascade,
  model text not null,
  color text,
  plate text not null,
  seats integer not null check (seats > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  origin_neighborhood text not null,
  destination text not null,
  stop_neighborhoods text[] not null default '{}',
  fixed_price numeric(10, 2) not null check (fixed_price >= 0),
  total_seats integer not null check (total_seats > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.route_schedules (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  departure_time time not null,
  weekdays integer[] not null default '{1,2,3,4,5}',
  created_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  passenger_id uuid not null references public.profiles(id) on delete cascade,
  schedule_id uuid references public.route_schedules(id) on delete set null,
  travel_date date not null,
  status text not null default 'reserved' check (status in ('reserved', 'accepted', 'cancelled', 'completed')),
  paid_amount numeric(10, 2),
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewed_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
