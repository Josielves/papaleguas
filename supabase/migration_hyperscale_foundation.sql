-- =========================================================================
-- PAPALEGUAS - fundacao para alto volume
-- Execute depois de migration_mobile_push_and_realtime.sql e
-- migration_vehicle_lookup_and_vans.sql.
-- =========================================================================

-- Busca por cursor: evita OFFSET, limita o payload e preserva uma ordenacao
-- deterministica mesmo quando varias rotas partem no mesmo instante.
create index if not exists routes_search_cursor_idx
  on public.routes (origin_region, destination_region, departure_time, id)
  include (
    driver_id, status, available_seats, total_seats, vehicle_type,
    vehicle_capacity
  )
  where status in ('open', 'full');

create index if not exists routes_browse_cursor_idx
  on public.routes (departure_time, id)
  include (driver_id, status, available_seats, total_seats)
  where status in ('open', 'full');

-- migration_start_route.sql trouxe o fluxo de inicio manual, mas sua ultima
-- versao nao vinculava p_driver_id/p_passenger_id ao JWT. Reaplicamos as duas
-- RPCs com autorizacao e os mesmos locks usados contra reserva dupla.
create or replace function public.start_route(
  p_route_id uuid,
  p_driver_id uuid
)
returns public.routes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_route public.routes;
begin
  if auth.uid() is null or auth.uid() <> p_driver_id then
    raise exception 'Usuario nao autorizado para iniciar esta rota' using errcode = '42501';
  end if;

  select * into v_route
  from public.routes
  where id = p_route_id and driver_id = p_driver_id
  for update;

  if v_route is null then
    raise exception 'Rota nao encontrada';
  end if;
  if v_route.status = 'cancelled' then
    raise exception 'Nao e possivel iniciar uma rota cancelada';
  end if;
  if v_route.status <> 'scheduled' then
    return v_route;
  end if;

  update public.routes
  set status = case when available_seats <= 0 then 'full' else 'open' end,
      started_at = now()
  where id = p_route_id
  returning * into v_route;

  return v_route;
end;
$$;

revoke all on function public.start_route(uuid, uuid) from public, anon;
grant execute on function public.start_route(uuid, uuid) to authenticated;

create or replace function public.reserve_seat(
  p_route_id uuid,
  p_seat_number integer,
  p_passenger_id uuid,
  p_pickup_address text default null,
  p_pickup_lat double precision default null,
  p_pickup_lng double precision default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seat public.seats;
  v_booking public.bookings;
  v_route public.routes;
begin
  if auth.uid() is null or auth.uid() <> p_passenger_id then
    raise exception 'Usuario nao autorizado para reservar este assento' using errcode = '42501';
  end if;

  select * into v_route
  from public.routes
  where id = p_route_id
  for update;

  if v_route is null then
    raise exception 'Rota nao encontrada';
  end if;
  if v_route.driver_id = p_passenger_id then
    raise exception 'Motorista nao pode reservar a propria rota';
  end if;
  if v_route.status not in ('open', 'full') or v_route.departure_time <= now() then
    raise exception 'Rota indisponivel para reserva';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.route_id = p_route_id
      and b.passenger_id = p_passenger_id
      and b.status in ('confirmed', 'pending')
  ) then
    raise exception 'Voce ja tem uma reserva ativa nesta rota';
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
    for update skip locked;
  end if;

  if v_seat is null or v_seat.status <> 'available' then
    raise exception 'Assento nao disponivel';
  end if;

  update public.seats
  set status = 'reserved', passenger_id = p_passenger_id, reserved_at = now()
  where id = v_seat.id;

  insert into public.bookings (
    route_id, seat_id, passenger_id, seat_number,
    pickup_address, pickup_lat, pickup_lng, status
  ) values (
    p_route_id, v_seat.id, p_passenger_id, v_seat.seat_number,
    p_pickup_address, p_pickup_lat, p_pickup_lng, 'confirmed'
  )
  returning * into v_booking;

  update public.routes
  set available_seats = greatest(available_seats - 1, 0),
      status = case when available_seats - 1 <= 0 then 'full' else 'open' end
  where id = p_route_id;

  return v_booking;
end;
$$;

revoke all on function public.reserve_seat(uuid, integer, uuid, text, double precision, double precision)
  from public, anon;
grant execute on function public.reserve_seat(uuid, integer, uuid, text, double precision, double precision)
  to authenticated;

create or replace function public.search_routes_page(
  p_origin_region text default null,
  p_destination_region text default null,
  p_departure_after timestamptz default now(),
  p_cursor_departure timestamptz default null,
  p_cursor_id uuid default null,
  p_page_size integer default 20
)
returns table (
  id uuid,
  driver_id uuid,
  origin_region text,
  destination_region text,
  origin_address text,
  destination_address text,
  origin_lat double precision,
  origin_lng double precision,
  destination_lat double precision,
  destination_lng double precision,
  departure_time timestamptz,
  total_seats integer,
  available_seats integer,
  vehicle_brand text,
  vehicle_model text,
  vehicle_plate text,
  vehicle_color text,
  vehicle_year integer,
  vehicle_model_year integer,
  vehicle_type text,
  vehicle_capacity integer,
  notes text,
  status text,
  driver jsonb,
  seats jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return query
  select
    r.id,
    r.driver_id,
    r.origin_region,
    r.destination_region,
    r.origin_address,
    r.destination_address,
    r.origin_lat,
    r.origin_lng,
    r.destination_lat,
    r.destination_lng,
    r.departure_time,
    r.total_seats,
    r.available_seats,
    r.vehicle_brand,
    r.vehicle_model,
    r.vehicle_plate,
    r.vehicle_color,
    r.vehicle_year,
    r.vehicle_model_year,
    r.vehicle_type,
    r.vehicle_capacity,
    r.notes,
    r.status,
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'avatar_url', p.avatar_url
    ) as driver,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'seat_number', s.seat_number,
          'status', s.status
        )
        order by s.seat_number
      )
      from public.seats s
      where s.route_id = r.id
    ), '[]'::jsonb) as seats
  from public.routes r
  join public.profiles p on p.id = r.driver_id
  where r.status in ('open', 'full')
    and r.departure_time >= coalesce(p_departure_after, now())
    and (p_origin_region is null or r.origin_region = p_origin_region)
    and (p_destination_region is null or r.destination_region = p_destination_region)
    and (
      p_cursor_departure is null
      or (r.departure_time, r.id) > (
        p_cursor_departure,
        coalesce(p_cursor_id, '00000000-0000-0000-0000-000000000000'::uuid)
      )
    )
  order by r.departure_time, r.id
  limit least(greatest(coalesce(p_page_size, 20), 1), 50);
end;
$$;

revoke all on function public.search_routes_page(text, text, timestamptz, timestamptz, uuid, integer)
  from public, anon;
grant execute on function public.search_routes_page(text, text, timestamptz, timestamptz, uuid, integer)
  to authenticated;

-- Outbox transacional: a notificacao e o trabalho de push entram na mesma
-- transacao. O envio externo acontece depois, com retry e sem segurar reserva.
create table if not exists public.notification_outbox (
  id bigint generated always as identity primary key,
  notification_id uuid not null unique
    references public.notifications(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'retry', 'delivered', 'dead')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  last_error text,
  provider_response jsonb,
  created_at timestamptz not null default now()
);

alter table public.notification_outbox enable row level security;
revoke all on table public.notification_outbox from anon, authenticated;
grant select, insert, update, delete on table public.notification_outbox to service_role;
grant usage, select on sequence public.notification_outbox_id_seq to service_role;

create index if not exists notification_outbox_claim_idx
  on public.notification_outbox (available_at, id)
  where status in ('queued', 'retry');

create index if not exists notification_outbox_stale_processing_idx
  on public.notification_outbox (locked_at, id)
  where status = 'processing';

create or replace function public.enqueue_notification_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_outbox (notification_id)
  values (new.id)
  on conflict (notification_id) do nothing;
  return new;
end;
$$;

drop trigger if exists notification_push_outbox_trigger on public.notifications;
create trigger notification_push_outbox_trigger
  after insert on public.notifications
  for each row execute function public.enqueue_notification_push();

create or replace function public.claim_notification_outbox(
  p_batch_size integer default 50
)
returns table (
  outbox_id bigint,
  notification_id uuid,
  user_id uuid,
  title text,
  message text,
  data jsonb,
  attempts integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select o.id
    from public.notification_outbox o
    where (
      o.status in ('queued', 'retry') and o.available_at <= now()
    ) or (
      o.status = 'processing' and o.locked_at < now() - interval '5 minutes'
    )
    order by o.available_at, o.id
    for update skip locked
    limit least(greatest(coalesce(p_batch_size, 50), 1), 100)
  ), claimed as (
    update public.notification_outbox o
    set status = 'processing',
        attempts = o.attempts + 1,
        locked_at = now(),
        last_error = null
    from candidates c
    where o.id = c.id
    returning o.*
  )
  select
    c.id,
    n.id,
    n.user_id,
    n.title,
    n.message,
    n.data,
    c.attempts
  from claimed c
  join public.notifications n on n.id = c.notification_id
  order by c.id;
end;
$$;

revoke all on function public.claim_notification_outbox(integer)
  from public, anon, authenticated;
grant execute on function public.claim_notification_outbox(integer)
  to service_role;

create or replace function public.complete_notification_outbox(
  p_outbox_id bigint,
  p_success boolean,
  p_error text default null,
  p_provider_response jsonb default null,
  p_retry_after_seconds integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts integer;
begin
  select o.attempts into v_attempts
  from public.notification_outbox o
  where o.id = p_outbox_id
  for update;

  if not found then
    raise exception 'outbox item not found';
  end if;

  if p_success then
    update public.notification_outbox
    set status = 'delivered',
        completed_at = now(),
        locked_at = null,
        last_error = null,
        provider_response = p_provider_response
    where id = p_outbox_id;
  elsif v_attempts >= 8 then
    update public.notification_outbox
    set status = 'dead',
        completed_at = now(),
        locked_at = null,
        last_error = left(coalesce(p_error, 'unknown provider error'), 2000),
        provider_response = p_provider_response
    where id = p_outbox_id;
  else
    update public.notification_outbox
    set status = 'retry',
        available_at = now() + make_interval(
          secs => greatest(
            coalesce(p_retry_after_seconds, 0),
            least(900, power(2, v_attempts)::integer)
          )
        ),
        locked_at = null,
        last_error = left(coalesce(p_error, 'unknown provider error'), 2000),
        provider_response = p_provider_response
    where id = p_outbox_id;
  end if;
end;
$$;

revoke all on function public.complete_notification_outbox(bigint, boolean, text, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.complete_notification_outbox(bigint, boolean, text, jsonb, integer)
  to service_role;

-- Uma unica rotina para a tarefa diaria de retencao. Os prazos podem ser
-- alterados por politica sem tocar no fluxo de reservas.
create or replace function public.run_data_retention()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_read_notifications bigint;
  v_old_notifications bigint;
  v_outbox bigint;
  v_geocoding bigint;
  v_vehicle bigint;
  v_tokens bigint;
begin
  with deleted as (
    delete from public.notifications
    where read_at is not null and read_at < now() - interval '90 days'
    returning 1
  ) select count(*) into v_read_notifications from deleted;

  with deleted as (
    delete from public.notifications
    where created_at < now() - interval '365 days'
    returning 1
  ) select count(*) into v_old_notifications from deleted;

  with deleted as (
    delete from public.notification_outbox
    where status in ('delivered', 'dead')
      and completed_at < now() - interval '30 days'
    returning 1
  ) select count(*) into v_outbox from deleted;

  with deleted as (
    delete from public.geocoding_cache where expires_at < now()
    returning 1
  ) select count(*) into v_geocoding from deleted;

  with deleted as (
    delete from public.vehicle_lookup_cache where expires_at < now()
    returning 1
  ) select count(*) into v_vehicle from deleted;

  with deleted as (
    delete from public.push_tokens
    where last_seen_at < now() - interval '120 days'
    returning 1
  ) select count(*) into v_tokens from deleted;

  return jsonb_build_object(
    'read_notifications', v_read_notifications,
    'old_notifications', v_old_notifications,
    'outbox', v_outbox,
    'geocoding_cache', v_geocoding,
    'vehicle_cache', v_vehicle,
    'push_tokens', v_tokens
  );
end;
$$;

revoke all on function public.run_data_retention()
  from public, anon, authenticated;
grant execute on function public.run_data_retention() to service_role;

-- =========================================================================
-- Fim da migracao
-- =========================================================================
