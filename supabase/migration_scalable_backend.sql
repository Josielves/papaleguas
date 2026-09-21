-- =========================================================================
-- PAPALEGUAS - base operacional para crescimento
-- Execute depois de migration_operations_and_waitlist.sql.
-- =========================================================================

-- Localizacao e uma carga de escrita frequente. Mantemos o ultimo ponto em
-- uma tabela estreita para nao reescrever a linha completa da rota.
create table if not exists public.route_locations (
  route_id      uuid primary key references public.routes(id) on delete cascade,
  driver_id     uuid not null references public.profiles(id) on delete cascade,
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  accuracy_m    double precision check (accuracy_m is null or accuracy_m between 0 and 100000),
  heading       double precision check (heading is null or heading between 0 and 360),
  speed_mps     double precision check (speed_mps is null or speed_mps between 0 and 200),
  recorded_at   timestamptz not null default now()
);

alter table public.route_locations enable row level security;

drop policy if exists "localizacao visivel aos participantes" on public.route_locations;
create policy "localizacao visivel aos participantes"
  on public.route_locations for select
  to authenticated
  using (
    exists (
      select 1
      from public.routes r
      where r.id = route_id
        and (
          r.driver_id = auth.uid()
          or r.status in ('open', 'full')
          or exists (
            select 1
            from public.bookings b
            where b.route_id = r.id
              and b.passenger_id = auth.uid()
              and b.status in ('confirmed', 'pending')
          )
        )
    )
  );

create index if not exists route_locations_driver_idx
  on public.route_locations (driver_id, recorded_at desc);

-- Preserva o ultimo ponto salvo pela versao anterior do aplicativo.
insert into public.route_locations (route_id, driver_id, lat, lng, recorded_at)
select id, driver_id, driver_lat, driver_lng, coalesce(location_updated_at, now())
from public.routes
where driver_lat is not null and driver_lng is not null
on conflict (route_id) do nothing;

-- Remove a assinatura antiga, que confiava no driver_id recebido do cliente.
drop function if exists public.update_driver_location(uuid, uuid, double precision, double precision);

create or replace function public.update_driver_location(
  p_route_id   uuid,
  p_driver_id  uuid,
  p_lat        double precision,
  p_lng        double precision,
  p_accuracy_m double precision default null,
  p_heading    double precision default null,
  p_speed_mps  double precision default null
)
returns public.route_locations
language plpgsql
security definer set search_path = public
as $$
declare
  v_route public.routes;
  v_location public.route_locations;
begin
  if auth.uid() is null or auth.uid() <> p_driver_id then
    raise exception 'Usuario nao autorizado para atualizar esta localizacao';
  end if;

  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Coordenadas invalidas';
  end if;

  select * into v_route
  from public.routes
  where id = p_route_id;

  if v_route is null or v_route.driver_id <> p_driver_id then
    raise exception 'Rota nao encontrada para este motorista';
  end if;
  if v_route.status not in ('open', 'full') then
    raise exception 'A rota nao esta em operacao';
  end if;

  insert into public.route_locations (
    route_id, driver_id, lat, lng, accuracy_m, heading, speed_mps, recorded_at
  ) values (
    p_route_id, p_driver_id, p_lat, p_lng, p_accuracy_m, p_heading, p_speed_mps, clock_timestamp()
  )
  on conflict (route_id) do update
  set driver_id = excluded.driver_id,
      lat = excluded.lat,
      lng = excluded.lng,
      accuracy_m = excluded.accuracy_m,
      heading = excluded.heading,
      speed_mps = excluded.speed_mps,
      recorded_at = excluded.recorded_at
  -- Limite autoritativo: clientes modificados nao podem gravar sem controle.
  where public.route_locations.recorded_at <= clock_timestamp() - interval '5 seconds'
  returning * into v_location;

  if v_location is null then
    select * into v_location
    from public.route_locations
    where route_id = p_route_id;
  end if;

  return v_location;
end;
$$;

revoke all on function public.update_driver_location(
  uuid, uuid, double precision, double precision, double precision, double precision, double precision
) from public;
grant execute on function public.update_driver_location(
  uuid, uuid, double precision, double precision, double precision, double precision, double precision
) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.route_locations;
exception when duplicate_object then null;
end $$;

-- Cache privado usado pela Edge Function de geocodificacao. Nenhum cliente
-- acessa estas tabelas diretamente; a service_role faz a mediacao.
create table if not exists public.geocoding_cache (
  cache_key   text primary key,
  response    jsonb not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.geocoding_cache enable row level security;
revoke all on table public.geocoding_cache from anon, authenticated;
grant select, insert, update, delete on table public.geocoding_cache to service_role;

create index if not exists geocoding_cache_expiry_idx
  on public.geocoding_cache (expires_at);

create table if not exists public.geocoding_provider_state (
  provider         text primary key,
  last_request_at  timestamptz not null default '-infinity'::timestamptz
);

alter table public.geocoding_provider_state enable row level security;
revoke all on table public.geocoding_provider_state from anon, authenticated;
grant select, insert, update on table public.geocoding_provider_state to service_role;

-- Serializa chamadas ao Nominatim publico. Em producao de alto volume,
-- configure um provedor contratado e nao use este limitador global.
create or replace function public.claim_geocoding_request(
  p_provider text,
  p_min_interval_ms integer default 1100
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_last_request timestamptz;
begin
  if p_min_interval_ms < 1000 or p_min_interval_ms > 60000 then
    raise exception 'Intervalo de geocodificacao invalido';
  end if;

  insert into public.geocoding_provider_state (provider)
  values (p_provider)
  on conflict (provider) do nothing;

  select last_request_at into v_last_request
  from public.geocoding_provider_state
  where provider = p_provider
  for update;

  if v_last_request > clock_timestamp() - make_interval(secs => p_min_interval_ms / 1000.0) then
    return false;
  end if;

  update public.geocoding_provider_state
  set last_request_at = clock_timestamp()
  where provider = p_provider;

  return true;
end;
$$;

revoke all on function public.claim_geocoding_request(text, integer) from public, anon, authenticated;
grant execute on function public.claim_geocoding_request(text, integer) to service_role;

-- Reduz a exposicao de telefone, endereco e dados de veiculo. Um perfil fica
-- visivel apenas para o proprio usuario ou para participantes de uma rota.
drop policy if exists "profiles são visíveis por todos os usuários autenticados" on public.profiles;
drop policy if exists "profiles sao visiveis por todos os usuarios autenticados" on public.profiles;
drop policy if exists "perfis visiveis aos participantes" on public.profiles;
create policy "perfis visiveis aos participantes"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.routes r
      where r.driver_id = profiles.id
        and r.status in ('scheduled', 'open', 'full')
    )
    or exists (
      select 1
      from public.bookings b
      join public.routes r on r.id = b.route_id
      where b.status in ('confirmed', 'pending')
        and (
          (b.passenger_id = profiles.id and r.driver_id = auth.uid())
          or (r.driver_id = profiles.id and b.passenger_id = auth.uid())
        )
    )
  );

-- Indices que sustentam as verificacoes de participacao e limpeza futura.
create index if not exists bookings_active_participants_idx
  on public.bookings (passenger_id, route_id)
  where status in ('confirmed', 'pending');

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

-- =========================================================================
-- Fim da migracao
-- =========================================================================
