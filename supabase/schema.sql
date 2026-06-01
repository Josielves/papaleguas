-- ============================================================
-- PAPALEGUAS - Schema completo com localização, chat e reservas
-- ============================================================

-- Extensão para UUID
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABELA: profiles
-- ============================================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  phone text,
  account_type text not null check (account_type in ('cliente','motorista')),
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Perfil visível para autenticados"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "Usuário edita próprio perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger para criar perfil automaticamente ao cadastrar
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name, account_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'account_type', 'cliente')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- TABELA: regions (regiões da cidade)
-- ============================================================
create table if not exists public.regions (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,          -- 'Centro', 'Norte', 'Sul', 'Leste', 'Oeste'
  slug text not null unique,          -- 'centro', 'norte', 'sul', 'leste', 'oeste'
  is_center boolean default false,    -- Centro é ponto central
  lat double precision,
  lng double precision,
  created_at timestamptz default now()
);

-- Inserir regiões padrão
insert into public.regions (name, slug, is_center, lat, lng) values
  ('Centro',  'centro', true,  -3.7327, -38.5270),
  ('Norte',   'norte',  false, -3.6900, -38.5270),
  ('Sul',     'sul',    false, -3.8000, -38.5270),
  ('Leste',   'leste',  false, -3.7327, -38.4700),
  ('Oeste',   'oeste',  false, -3.7327, -38.5900)
on conflict (slug) do nothing;

-- ============================================================
-- TABELA: price_rules (tabela de preços por par de regiões)
-- ============================================================
create table if not exists public.price_rules (
  id uuid default uuid_generate_v4() primary key,
  origin_slug text not null,
  destination_slug text not null,
  price numeric(6,2) not null,
  unique (origin_slug, destination_slug)
);

-- Regras de preço:
-- Centro → qualquer região = R$10
-- Entre regiões (extremos) = R$15
insert into public.price_rules (origin_slug, destination_slug, price) values
  -- Saindo do Centro
  ('centro', 'norte',  10.00),
  ('centro', 'sul',    10.00),
  ('centro', 'leste',  10.00),
  ('centro', 'oeste',  10.00),
  -- Chegando ao Centro
  ('norte',  'centro', 10.00),
  ('sul',    'centro', 10.00),
  ('leste',  'centro', 10.00),
  ('oeste',  'centro', 10.00),
  -- Entre extremos (R$15)
  ('norte',  'sul',    15.00),
  ('norte',  'leste',  15.00),
  ('norte',  'oeste',  15.00),
  ('sul',    'norte',  15.00),
  ('sul',    'leste',  15.00),
  ('sul',    'oeste',  15.00),
  ('leste',  'norte',  15.00),
  ('leste',  'sul',    15.00),
  ('leste',  'oeste',  15.00),
  ('oeste',  'norte',  15.00),
  ('oeste',  'sul',    15.00),
  ('oeste',  'leste',  15.00)
on conflict (origin_slug, destination_slug) do nothing;

-- ============================================================
-- TABELA: routes (rotas criadas pelo motorista)
-- ============================================================
create table if not exists public.routes (
  id uuid default uuid_generate_v4() primary key,
  driver_id uuid references public.profiles(id) on delete cascade not null,
  origin_region text not null,           -- slug da região de origem
  destination_region text not null,      -- slug da região de destino
  origin_address text,                   -- endereço detalhado de partida
  destination_address text,              -- endereço detalhado de chegada
  origin_lat double precision,
  origin_lng double precision,
  destination_lat double precision,
  destination_lng double precision,
  departure_time timestamptz not null,
  total_seats int not null default 4,
  available_seats int not null default 4,
  price numeric(6,2) not null,
  status text not null default 'open' check (status in ('open','full','in_progress','completed','cancelled')),
  vehicle_model text,
  vehicle_plate text,
  notes text,
  created_at timestamptz default now()
);

alter table public.routes enable row level security;

create policy "Rotas visíveis para autenticados"
  on public.routes for select
  using (auth.role() = 'authenticated');

create policy "Motorista cria próprias rotas"
  on public.routes for insert
  with check (auth.uid() = driver_id);

create policy "Motorista atualiza próprias rotas"
  on public.routes for update
  using (auth.uid() = driver_id);

create policy "Motorista cancela próprias rotas"
  on public.routes for delete
  using (auth.uid() = driver_id);

-- ============================================================
-- TABELA: seats (assentos de uma rota)
-- ============================================================
create table if not exists public.seats (
  id uuid default uuid_generate_v4() primary key,
  route_id uuid references public.routes(id) on delete cascade not null,
  seat_number int not null,
  status text not null default 'available' check (status in ('available','reserved','occupied')),
  passenger_id uuid references public.profiles(id) on delete set null,
  reserved_at timestamptz,
  unique (route_id, seat_number)
);

alter table public.seats enable row level security;

create policy "Assentos visíveis para autenticados"
  on public.seats for select
  using (auth.role() = 'authenticated');

create policy "Passageiro reserva assento"
  on public.seats for update
  using (
    auth.role() = 'authenticated' and
    (passenger_id is null or passenger_id = auth.uid())
  );

-- ============================================================
-- TABELA: bookings (reservas)
-- ============================================================
create table if not exists public.bookings (
  id uuid default uuid_generate_v4() primary key,
  route_id uuid references public.routes(id) on delete cascade not null,
  passenger_id uuid references public.profiles(id) on delete cascade not null,
  seat_id uuid references public.seats(id) on delete set null,
  seat_number int not null,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  price numeric(6,2) not null,
  status text not null default 'confirmed' check (status in ('confirmed','cancelled','completed')),
  created_at timestamptz default now(),
  unique (route_id, passenger_id)
);

alter table public.bookings enable row level security;

create policy "Passageiro vê próprias reservas"
  on public.bookings for select
  using (
    auth.uid() = passenger_id or
    auth.uid() in (select driver_id from public.routes where id = route_id)
  );

create policy "Passageiro cria reserva"
  on public.bookings for insert
  with check (auth.uid() = passenger_id);

create policy "Passageiro cancela reserva"
  on public.bookings for update
  using (auth.uid() = passenger_id);

-- ============================================================
-- TABELA: messages (chat por reserva)
-- ============================================================
create table if not exists public.messages (
  id uuid default uuid_generate_v4() primary key,
  booking_id uuid references public.bookings(id) on delete cascade not null,
  route_id uuid references public.routes(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  read boolean default false,
  created_at timestamptz default now()
);

alter table public.messages enable row level security;

create policy "Mensagens visíveis para participantes"
  on public.messages for select
  using (
    auth.uid() = sender_id or
    auth.uid() in (select passenger_id from public.bookings where id = booking_id) or
    auth.uid() in (select driver_id from public.routes where id = route_id)
  );

create policy "Participantes enviam mensagens"
  on public.messages for insert
  with check (
    auth.uid() = sender_id and (
      auth.uid() in (select passenger_id from public.bookings where id = booking_id) or
      auth.uid() in (select driver_id from public.routes where id = route_id)
    )
  );

-- ============================================================
-- FUNÇÃO: reservar assento atomicamente
-- ============================================================
create or replace function public.reserve_seat(
  p_route_id uuid,
  p_seat_number int,
  p_passenger_id uuid,
  p_pickup_address text default null,
  p_pickup_lat double precision default null,
  p_pickup_lng double precision default null
)
returns json language plpgsql security definer as $$
declare
  v_seat_id uuid;
  v_price numeric;
  v_booking_id uuid;
  v_available int;
begin
  -- Verificar se rota existe e está aberta
  select available_seats, price
  into v_available, v_price
  from public.routes
  where id = p_route_id and status = 'open'
  for update;

  if not found then
    return json_build_object('error', 'Rota não encontrada ou indisponível');
  end if;

  if v_available <= 0 then
    return json_build_object('error', 'Sem assentos disponíveis');
  end if;

  -- Pegar o assento específico ou o próximo disponível
  if p_seat_number > 0 then
    select id into v_seat_id
    from public.seats
    where route_id = p_route_id
      and seat_number = p_seat_number
      and status = 'available'
    for update;
  else
    select id, seat_number into v_seat_id, p_seat_number
    from public.seats
    where route_id = p_route_id and status = 'available'
    order by seat_number
    limit 1
    for update;
  end if;

  if v_seat_id is null then
    return json_build_object('error', 'Assento não disponível');
  end if;

  -- Verificar se passageiro já tem reserva
  if exists (
    select 1 from public.bookings
    where route_id = p_route_id and passenger_id = p_passenger_id and status = 'confirmed'
  ) then
    return json_build_object('error', 'Você já tem uma reserva nessa rota');
  end if;

  -- Atualizar assento
  update public.seats
  set status = 'reserved', passenger_id = p_passenger_id, reserved_at = now()
  where id = v_seat_id;

  -- Criar reserva
  insert into public.bookings (route_id, passenger_id, seat_id, seat_number, pickup_address, pickup_lat, pickup_lng, price)
  values (p_route_id, p_passenger_id, v_seat_id, p_seat_number, p_pickup_address, p_pickup_lat, p_pickup_lng, v_price)
  returning id into v_booking_id;

  -- Atualizar contagem de assentos disponíveis
  update public.routes
  set available_seats = available_seats - 1,
      status = case when available_seats - 1 = 0 then 'full' else 'open' end
  where id = p_route_id;

  return json_build_object('success', true, 'booking_id', v_booking_id, 'seat_number', p_seat_number, 'price', v_price);
end;
$$;

-- ============================================================
-- FUNÇÃO: criar rota com assentos automaticamente
-- ============================================================
create or replace function public.create_route_with_seats(
  p_driver_id uuid,
  p_origin_region text,
  p_destination_region text,
  p_origin_address text,
  p_destination_address text,
  p_origin_lat double precision,
  p_origin_lng double precision,
  p_destination_lat double precision,
  p_destination_lng double precision,
  p_departure_time timestamptz,
  p_total_seats int,
  p_vehicle_model text default null,
  p_vehicle_plate text default null,
  p_notes text default null
)
returns json language plpgsql security definer as $$
declare
  v_route_id uuid;
  v_price numeric;
  i int;
begin
  -- Buscar preço baseado nas regiões
  select price into v_price
  from public.price_rules
  where origin_slug = p_origin_region and destination_slug = p_destination_region;

  if v_price is null then
    v_price := 10.00; -- preço padrão
  end if;

  -- Criar rota
  insert into public.routes (
    driver_id, origin_region, destination_region,
    origin_address, destination_address,
    origin_lat, origin_lng, destination_lat, destination_lng,
    departure_time, total_seats, available_seats, price,
    vehicle_model, vehicle_plate, notes
  ) values (
    p_driver_id, p_origin_region, p_destination_region,
    p_origin_address, p_destination_address,
    p_origin_lat, p_origin_lng, p_destination_lat, p_destination_lng,
    p_departure_time, p_total_seats, p_total_seats, v_price,
    p_vehicle_model, p_vehicle_plate, p_notes
  ) returning id into v_route_id;

  -- Criar assentos
  for i in 1..p_total_seats loop
    insert into public.seats (route_id, seat_number, status)
    values (v_route_id, i, 'available');
  end loop;

  return json_build_object('success', true, 'route_id', v_route_id, 'price', v_price);
end;
$$;

-- ============================================================
-- REALTIME: habilitar para mensagens e assentos
-- ============================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.seats;
alter publication supabase_realtime add table public.routes;
alter publication supabase_realtime add table public.bookings;
