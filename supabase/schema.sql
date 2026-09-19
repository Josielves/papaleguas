-- =========================================================================
-- PAPALEGUAS — Schema completo do Supabase
-- Execute este arquivo inteiro no SQL Editor do seu projeto Supabase.
-- =========================================================================

-- Extensões necessárias
create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------------
-- Tabela: profiles
-- -------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null,
  phone         text,
  address       text,
  account_type  text not null default 'passenger' check (account_type in ('passenger', 'driver')),
  avatar_url    text,
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles são visíveis por todos os usuários autenticados"
  on public.profiles for select
  to authenticated
  using (true);

create policy "usuário pode atualizar seu próprio perfil"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Cria automaticamente um profile quando um novo usuário se cadastra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, account_type, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'account_type', 'passenger'),
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------------------
-- Tabela: regions
-- -------------------------------------------------------------------------
create table if not exists public.regions (
  slug        text primary key,
  name        text not null,
  is_center   boolean not null default false,
  center_lat  double precision,
  center_lng  double precision
);

alter table public.regions enable row level security;

create policy "regions são públicas"
  on public.regions for select
  to authenticated
  using (true);

insert into public.regions (slug, name, is_center) values
  ('centro', 'Centro', true),
  ('norte',  'Norte',  false),
  ('sul',    'Sul',    false),
  ('leste',  'Leste',  false),
  ('oeste',  'Oeste',  false)
on conflict (slug) do nothing;

-- -------------------------------------------------------------------------
-- Tabela: price_rules
-- -------------------------------------------------------------------------
create table if not exists public.price_rules (
  id                 uuid primary key default gen_random_uuid(),
  origin_region      text not null references public.regions(slug),
  destination_region text not null references public.regions(slug),
  price              numeric(10, 2) not null,
  unique (origin_region, destination_region)
);

alter table public.price_rules enable row level security;

create policy "price_rules são públicas"
  on public.price_rules for select
  to authenticated
  using (true);

-- Função utilitária de preço (espelha a lógica do frontend em src/lib/supabase.js)
create or replace function public.get_route_price(p_origin text, p_destination text)
returns numeric
language sql
immutable
as $$
  select case
    when p_origin = p_destination then 0
    when p_origin = 'centro' or p_destination = 'centro' then 10
    else 15
  end;
$$;

-- -------------------------------------------------------------------------
-- Tabela: routes
-- -------------------------------------------------------------------------
create table if not exists public.routes (
  id                  uuid primary key default gen_random_uuid(),
  driver_id           uuid not null references public.profiles(id) on delete cascade,
  origin_region       text not null references public.regions(slug),
  destination_region  text not null references public.regions(slug),
  origin_address      text,
  destination_address text,
  origin_lat          double precision,
  origin_lng          double precision,
  destination_lat     double precision,
  destination_lng     double precision,
  departure_time      timestamptz not null,
  total_seats         int not null check (total_seats between 1 and 8),
  available_seats     int not null,
  vehicle_model       text,
  vehicle_plate       text,
  notes               text,
  status              text not null default 'scheduled' check (status in ('scheduled', 'open', 'full', 'cancelled')),
  started_at          timestamptz,
  driver_lat          double precision,
  driver_lng          double precision,
  location_updated_at timestamptz,
  created_at          timestamptz not null default now()
);

alter table public.routes enable row level security;

create policy "rotas abertas são visíveis por todos"
  on public.routes for select
  to authenticated
  using (true);

create policy "motorista pode atualizar suas próprias rotas"
  on public.routes for update
  to authenticated
  using (auth.uid() = driver_id);

create index if not exists routes_departure_time_idx on public.routes (departure_time);
create index if not exists routes_status_idx on public.routes (status);

-- -------------------------------------------------------------------------
-- Tabela: seats
-- -------------------------------------------------------------------------
create table if not exists public.seats (
  id            uuid primary key default gen_random_uuid(),
  route_id      uuid not null references public.routes(id) on delete cascade,
  seat_number   int not null,
  status        text not null default 'available' check (status in ('available', 'reserved')),
  passenger_id  uuid references public.profiles(id) on delete set null,
  reserved_at   timestamptz,
  unique (route_id, seat_number)
);

alter table public.seats enable row level security;

create policy "seats são visíveis por todos"
  on public.seats for select
  to authenticated
  using (true);

-- -------------------------------------------------------------------------
-- Tabela: bookings
-- -------------------------------------------------------------------------
create table if not exists public.bookings (
  id              uuid primary key default gen_random_uuid(),
  route_id        uuid not null references public.routes(id) on delete cascade,
  seat_id         uuid not null references public.seats(id) on delete cascade,
  passenger_id    uuid not null references public.profiles(id) on delete cascade,
  seat_number     int not null,
  pickup_address  text,
  pickup_lat      double precision,
  pickup_lng      double precision,
  status          text not null default 'confirmed' check (status in ('confirmed', 'pending', 'cancelled')),
  is_for_someone_else boolean not null default false,
  recipient_name  text,
  recipient_phone text,
  created_at      timestamptz not null default now()
);

alter table public.bookings enable row level security;

create policy "passageiro vê suas próprias reservas"
  on public.bookings for select
  to authenticated
  using (
    auth.uid() = passenger_id
    or auth.uid() in (select driver_id from public.routes where id = route_id)
  );

create policy "passageiro pode atualizar sua própria reserva"
  on public.bookings for update
  to authenticated
  using (auth.uid() = passenger_id);

create index if not exists bookings_passenger_idx on public.bookings (passenger_id);
create index if not exists bookings_route_idx on public.bookings (route_id);

-- -------------------------------------------------------------------------
-- Tabela: messages
-- -------------------------------------------------------------------------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  route_id    uuid not null references public.routes(id) on delete cascade,
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "mensagens visíveis por motorista e passageiro da reserva"
  on public.messages for select
  to authenticated
  using (
    auth.uid() = sender_id
    or auth.uid() in (
      select passenger_id from public.bookings where id = booking_id
      union
      select driver_id from public.routes where id = route_id
    )
  );

create policy "usuário pode enviar mensagem em reservas que participa"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and auth.uid() in (
      select passenger_id from public.bookings where id = booking_id
      union
      select driver_id from public.routes where id = route_id
    )
  );

create index if not exists messages_booking_idx on public.messages (booking_id, created_at);

-- -------------------------------------------------------------------------
-- RPC: create_route_with_seats
-- Cria a rota e todos os assentos (motorista ocupa o assento 0) em uma
-- única transação atômica.
-- -------------------------------------------------------------------------
create or replace function public.create_route_with_seats(
  p_driver_id           uuid,
  p_origin_region       text,
  p_destination_region  text,
  p_origin_address      text,
  p_destination_address text,
  p_origin_lat          double precision,
  p_origin_lng          double precision,
  p_destination_lat     double precision,
  p_destination_lng     double precision,
  p_departure_time      timestamptz,
  p_total_seats         int,
  p_vehicle_model       text,
  p_vehicle_plate       text,
  p_notes               text
)
returns public.routes
language plpgsql
security definer set search_path = public
as $$
declare
  v_route public.routes;
  i int;
begin
  if p_origin_region = p_destination_region then
    raise exception 'Origem e destino não podem ser iguais';
  end if;

  insert into public.routes (
    driver_id, origin_region, destination_region, origin_address, destination_address,
    origin_lat, origin_lng, destination_lat, destination_lng,
    departure_time, total_seats, available_seats, vehicle_model, vehicle_plate, notes
  ) values (
    p_driver_id, p_origin_region, p_destination_region, p_origin_address, p_destination_address,
    p_origin_lat, p_origin_lng, p_destination_lat, p_destination_lng,
    p_departure_time, p_total_seats, p_total_seats, p_vehicle_model, p_vehicle_plate, p_notes
  )
  returning * into v_route;

  for i in 1..p_total_seats loop
    insert into public.seats (route_id, seat_number, status)
    values (v_route.id, i, 'available');
  end loop;

  return v_route;
end;
$$;

grant execute on function public.create_route_with_seats to authenticated;

-- -------------------------------------------------------------------------
-- RPC: reserve_seat
-- Reserva um assento de forma atômica, evitando condição de corrida entre
-- dois passageiros reservando ao mesmo tempo. Se p_seat_number = 0 (ou
-- não informado), escolhe automaticamente o primeiro assento disponível.
-- -------------------------------------------------------------------------
create or replace function public.reserve_seat(
  p_route_id        uuid,
  p_seat_number     int,
  p_passenger_id    uuid,
  p_pickup_address  text default null,
  p_pickup_lat      double precision default null,
  p_pickup_lng      double precision default null
)
returns public.bookings
language plpgsql
security definer set search_path = public
as $$
declare
  v_seat public.seats;
  v_booking public.bookings;
  v_route public.routes;
begin
  select * into v_route from public.routes where id = p_route_id for update;

  if v_route is null then
    raise exception 'Rota não encontrada';
  end if;
  if v_route.status = 'cancelled' then
    raise exception 'Esta rota foi cancelada';
  end if;
  if v_route.status = 'scheduled' then
    raise exception 'Esta rota ainda não foi iniciada pelo motorista';
  end if;

  if p_seat_number is not null and p_seat_number > 0 then
    select * into v_seat
    from public.seats
    where route_id = p_route_id and seat_number = p_seat_number
    for update;
  else
    select * into v_seat
    from public.seats
    where route_id = p_route_id and status = 'available'
    order by seat_number
    limit 1
    for update;
  end if;

  if v_seat is null or v_seat.status <> 'available' then
    raise exception 'Assento não disponível';
  end if;

  update public.seats
  set status = 'reserved', passenger_id = p_passenger_id, reserved_at = now()
  where id = v_seat.id;

  insert into public.bookings (route_id, seat_id, passenger_id, seat_number, pickup_address, pickup_lat, pickup_lng, status)
  values (p_route_id, v_seat.id, p_passenger_id, v_seat.seat_number, p_pickup_address, p_pickup_lat, p_pickup_lng, 'confirmed')
  returning * into v_booking;

  update public.routes
  set available_seats = available_seats - 1,
      status = case when available_seats - 1 <= 0 then 'full' else status end
  where id = p_route_id;

  return v_booking;
end;
$$;

grant execute on function public.reserve_seat to authenticated;

-- -------------------------------------------------------------------------
-- RPC: start_route
-- O motorista chama isso quando sai para rodar a rota. Só a partir desse
-- momento a rota fica visível/reservável para os passageiros — a criação
-- da rota sozinha não a torna disponível.
-- -------------------------------------------------------------------------
create or replace function public.start_route(
  p_route_id   uuid,
  p_driver_id  uuid
)
returns public.routes
language plpgsql
security definer set search_path = public
as $$
declare
  v_route public.routes;
begin
  select * into v_route
  from public.routes
  where id = p_route_id and driver_id = p_driver_id
  for update;

  if v_route is null then
    raise exception 'Rota não encontrada ou você não é o motorista dela';
  end if;

  if v_route.status = 'cancelled' then
    raise exception 'Não é possível iniciar uma rota cancelada';
  end if;

  if v_route.status <> 'scheduled' then
    return v_route; -- já iniciada, apenas retorna o estado atual
  end if;

  update public.routes
  set status = case when available_seats <= 0 then 'full' else 'open' end,
      started_at = now()
  where id = p_route_id
  returning * into v_route;

  return v_route;
end;
$$;

grant execute on function public.start_route to authenticated;

-- -------------------------------------------------------------------------
-- RPC: update_driver_location
-- Chamada periodicamente pelo app do motorista (enquanto a rota está
-- 'open'/'full') para transmitir a posição em tempo real aos passageiros.
-- -------------------------------------------------------------------------
create or replace function public.update_driver_location(
  p_route_id  uuid,
  p_driver_id uuid,
  p_lat       double precision,
  p_lng       double precision
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.routes
  set driver_lat = p_lat,
      driver_lng = p_lng,
      location_updated_at = now()
  where id = p_route_id
    and driver_id = p_driver_id
    and status in ('open', 'full');
end;
$$;

grant execute on function public.update_driver_location to authenticated;

-- -------------------------------------------------------------------------
-- RPC: cancel_booking
-- Cancela a reserva do próprio passageiro, libera o assento e reabre a
-- rota se necessário — tudo em uma transação atômica e seguindo o mesmo
-- padrão de reserve_seat (evita depender de políticas de UPDATE amplas
-- nas tabelas seats/routes para o passageiro).
-- -------------------------------------------------------------------------
create or replace function public.cancel_booking(
  p_booking_id    uuid,
  p_passenger_id  uuid
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id and passenger_id = p_passenger_id
  for update;

  if v_booking is null then
    raise exception 'Reserva não encontrada';
  end if;

  if v_booking.status = 'cancelled' then
    return;
  end if;

  update public.bookings set status = 'cancelled' where id = p_booking_id;

  update public.seats
  set status = 'available', passenger_id = null, reserved_at = null
  where id = v_booking.seat_id;

  update public.routes
  set available_seats = least(available_seats + 1, total_seats),
      status = case when status = 'cancelled' then 'cancelled' else 'open' end
  where id = v_booking.route_id;
end;
$$;

grant execute on function public.cancel_booking to authenticated;

-- -------------------------------------------------------------------------
-- Realtime — habilita as tabelas usadas pelas subscriptions do frontend
-- -------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.seats;
alter publication supabase_realtime add table public.routes;

-- -------------------------------------------------------------------------
-- Storage — bucket para fotos de perfil (avatares)
-- -------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatares são publicamente visíveis"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

create policy "usuário pode enviar seu próprio avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "usuário pode atualizar seu próprio avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "usuário pode apagar seu próprio avatar"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- =========================================================================
-- Fim do schema
-- =========================================================================
