-- =========================================================================
-- PAPALEGUAS - consulta de veiculo por placa e suporte a vans
-- Execute depois de migration_mobile_push_and_realtime.sql.
-- =========================================================================

-- O perfil mantem o veiculo principal do motorista. A capacidade representa
-- somente os passageiros; o banco valida novamente esse limite ao criar rota.
alter table public.profiles add column if not exists vehicle_brand text;
alter table public.profiles add column if not exists vehicle_year int;
alter table public.profiles add column if not exists vehicle_model_year int;
alter table public.profiles add column if not exists vehicle_type text;
alter table public.profiles add column if not exists vehicle_capacity int;
alter table public.profiles add column if not exists vehicle_lookup_verified_at timestamptz;

update public.profiles
set vehicle_type = coalesce(vehicle_type, 'car'),
    vehicle_capacity = coalesce(vehicle_capacity, 6)
where vehicle_type is null or vehicle_capacity is null;

alter table public.profiles alter column vehicle_type set default 'car';
alter table public.profiles alter column vehicle_type set not null;
alter table public.profiles alter column vehicle_capacity set default 6;
alter table public.profiles alter column vehicle_capacity set not null;

alter table public.profiles drop constraint if exists profiles_vehicle_type_check;
alter table public.profiles add constraint profiles_vehicle_type_check
  check (vehicle_type in ('car', 'van'));

alter table public.profiles drop constraint if exists profiles_vehicle_capacity_check;
alter table public.profiles add constraint profiles_vehicle_capacity_check
  check (
    (vehicle_type = 'car' and vehicle_capacity between 1 and 8)
    or (vehicle_type = 'van' and vehicle_capacity between 4 and 20)
  );

alter table public.profiles drop constraint if exists profiles_vehicle_year_check;
alter table public.profiles add constraint profiles_vehicle_year_check
  check (vehicle_year is null or vehicle_year between 1886 and 2100);

alter table public.profiles drop constraint if exists profiles_vehicle_model_year_check;
alter table public.profiles add constraint profiles_vehicle_model_year_check
  check (vehicle_model_year is null or vehicle_model_year between 1886 and 2100);

-- A rota guarda uma fotografia do veiculo usado naquela viagem.
alter table public.routes add column if not exists vehicle_brand text;
alter table public.routes add column if not exists vehicle_year int;
alter table public.routes add column if not exists vehicle_model_year int;
alter table public.routes add column if not exists vehicle_color text;
alter table public.routes add column if not exists vehicle_type text;
alter table public.routes add column if not exists vehicle_capacity int;

update public.routes
set vehicle_type = coalesce(vehicle_type, case when total_seats > 8 then 'van' else 'car' end),
    vehicle_capacity = greatest(coalesce(vehicle_capacity, 0), total_seats, 6)
where vehicle_type is null or vehicle_capacity is null;

alter table public.routes alter column vehicle_type set default 'car';
alter table public.routes alter column vehicle_type set not null;
alter table public.routes alter column vehicle_capacity set default 6;
alter table public.routes alter column vehicle_capacity set not null;

alter table public.routes drop constraint if exists routes_total_seats_check;
alter table public.routes add constraint routes_total_seats_check
  check (total_seats between 1 and 20);

alter table public.routes drop constraint if exists routes_vehicle_type_check;
alter table public.routes add constraint routes_vehicle_type_check
  check (vehicle_type in ('car', 'van'));

alter table public.routes drop constraint if exists routes_vehicle_capacity_check;
alter table public.routes add constraint routes_vehicle_capacity_check
  check (vehicle_capacity between 1 and 20);

alter table public.routes drop constraint if exists routes_seats_within_vehicle_capacity_check;
alter table public.routes add constraint routes_seats_within_vehicle_capacity_check
  check (total_seats <= vehicle_capacity);

-- Cache privado: evita pagar repetidamente pela mesma placa. A placa e
-- transformada em SHA-256 pela Edge Function antes de chegar ao banco.
create table if not exists public.vehicle_lookup_cache (
  plate_hash  text not null,
  provider    text not null,
  response    jsonb not null,
  expires_at  timestamptz not null,
  updated_at  timestamptz not null default now(),
  primary key (plate_hash, provider)
);

alter table public.vehicle_lookup_cache enable row level security;
create index if not exists vehicle_lookup_cache_expiry_idx
  on public.vehicle_lookup_cache (expires_at);

-- Cota diaria por usuario para proteger saldo e impedir abuso da API paga.
create table if not exists public.vehicle_lookup_quota (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  usage_date     date not null default current_date,
  request_count  int not null default 0 check (request_count >= 0),
  updated_at     timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.vehicle_lookup_quota enable row level security;

create or replace function public.claim_vehicle_lookup_request(
  p_user_id uuid,
  p_daily_limit int default 20
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_count int;
begin
  if p_user_id is null or p_daily_limit < 1 then
    return false;
  end if;

  insert into public.vehicle_lookup_quota (user_id, usage_date, request_count, updated_at)
  values (p_user_id, current_date, 1, clock_timestamp())
  on conflict (user_id, usage_date) do update
    set request_count = vehicle_lookup_quota.request_count + 1,
        updated_at = clock_timestamp()
    where vehicle_lookup_quota.request_count < p_daily_limit
  returning request_count into v_count;

  return v_count is not null and v_count <= p_daily_limit;
end;
$$;

revoke all on function public.claim_vehicle_lookup_request(uuid, int) from public, anon, authenticated;
grant execute on function public.claim_vehicle_lookup_request(uuid, int) to service_role;

-- Substitui a RPC existente sem mudar sua assinatura. O tipo e a capacidade
-- sao lidos do perfil autenticado, impedindo que o cliente publique mais
-- assentos do que o veiculo cadastrado comporta.
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
  v_profile public.profiles;
  v_plate text;
  i int;
begin
  if auth.uid() is null or auth.uid() <> p_driver_id then
    raise exception 'Usuario nao autorizado para criar esta rota';
  end if;

  select * into v_profile
  from public.profiles
  where id = p_driver_id;

  if v_profile is null or v_profile.account_type <> 'driver' then
    raise exception 'Perfil de motorista nao encontrado';
  end if;

  if p_origin_region = p_destination_region then
    raise exception 'Origem e destino nao podem ser iguais';
  end if;

  if p_departure_time <= now() then
    raise exception 'A data de saida precisa ser no futuro';
  end if;

  if p_total_seats is null or p_total_seats < 1 or p_total_seats > v_profile.vehicle_capacity then
    raise exception 'Quantidade de assentos acima da capacidade cadastrada do veiculo';
  end if;

  v_plate := regexp_replace(upper(coalesce(nullif(trim(v_profile.vehicle_plate), ''), p_vehicle_plate, '')), '[^A-Z0-9]', '', 'g');
  if v_plate !~ '^[A-Z]{3}([0-9]{4}|[0-9][A-Z][0-9]{2})$' then
    raise exception 'Cadastre uma placa brasileira valida no perfil do motorista';
  end if;

  if nullif(trim(coalesce(nullif(v_profile.vehicle_model, ''), p_vehicle_model, '')), '') is null then
    raise exception 'Cadastre o modelo do veiculo no perfil do motorista';
  end if;

  insert into public.routes (
    driver_id, origin_region, destination_region, origin_address, destination_address,
    origin_lat, origin_lng, destination_lat, destination_lng,
    departure_time, total_seats, available_seats,
    vehicle_brand, vehicle_model, vehicle_plate, vehicle_year, vehicle_model_year,
    vehicle_color, vehicle_type, vehicle_capacity, notes
  ) values (
    p_driver_id, p_origin_region, p_destination_region, p_origin_address, p_destination_address,
    p_origin_lat, p_origin_lng, p_destination_lat, p_destination_lng,
    p_departure_time, p_total_seats, p_total_seats,
    v_profile.vehicle_brand, coalesce(nullif(v_profile.vehicle_model, ''), p_vehicle_model), v_plate,
    v_profile.vehicle_year, v_profile.vehicle_model_year, v_profile.vehicle_color,
    v_profile.vehicle_type, v_profile.vehicle_capacity, p_notes
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

-- =========================================================================
-- Fim da migracao
-- =========================================================================
