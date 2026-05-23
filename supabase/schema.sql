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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (auth_user_id, full_name, role, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'passenger'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (auth_user_id) do update
  set
    full_name = excluded.full_name,
    role = excluded.role,
    avatar_url = excluded.avatar_url;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.driver_documents enable row level security;
alter table public.vehicles enable row level security;
alter table public.routes enable row level security;
alter table public.route_schedules enable row level security;
alter table public.reservations enable row level security;
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
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

drop policy if exists "Routes are readable by everyone" on public.routes;
create policy "Routes are readable by everyone"
on public.routes for select
to anon, authenticated
using (active = true);

drop policy if exists "Drivers can manage own routes" on public.routes;
create policy "Drivers can manage own routes"
on public.routes for all
to authenticated
using (
  driver_id in (
    select id from public.profiles where auth_user_id = auth.uid() and role = 'driver'
  )
)
with check (
  driver_id in (
    select id from public.profiles where auth_user_id = auth.uid() and role = 'driver'
  )
);

drop policy if exists "Route schedules are readable by everyone" on public.route_schedules;
create policy "Route schedules are readable by everyone"
on public.route_schedules for select
to anon, authenticated
using (true);

drop policy if exists "Passengers can create own reservations" on public.reservations;
create policy "Passengers can create own reservations"
on public.reservations for insert
to authenticated
with check (
  passenger_id in (
    select id from public.profiles where auth_user_id = auth.uid()
  )
);

drop policy if exists "Users can read related reservations" on public.reservations;
create policy "Users can read related reservations"
on public.reservations for select
to authenticated
using (
  passenger_id in (select id from public.profiles where auth_user_id = auth.uid())
  or route_id in (
    select r.id
    from public.routes r
    join public.profiles p on p.id = r.driver_id
    where p.auth_user_id = auth.uid()
  )
);
