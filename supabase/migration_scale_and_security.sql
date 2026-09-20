-- =========================================================================
-- PAPALEGUAS — hardening e indices para crescimento
-- Execute depois de supabase/schema.sql.
-- =========================================================================

-- Consultas principais:
-- 1. passageiro busca rotas abertas por origem/destino/data
-- 2. motorista lista as proprias rotas
-- 3. passageiro lista reservas
-- 4. chat carrega mensagens por reserva em ordem cronologica
create index if not exists routes_open_search_idx
  on public.routes (status, origin_region, destination_region, departure_time)
  where status = 'open';

create index if not exists routes_driver_departure_idx
  on public.routes (driver_id, departure_time desc);

create index if not exists bookings_passenger_created_idx
  on public.bookings (passenger_id, created_at desc);

create index if not exists bookings_route_status_idx
  on public.bookings (route_id, status);

create index if not exists seats_route_status_number_idx
  on public.seats (route_id, status, seat_number);

create index if not exists messages_route_created_idx
  on public.messages (route_id, created_at);

-- Idempotencia de reserva ativa: um passageiro nao pode manter duas reservas
-- confirmadas para a mesma rota.
create unique index if not exists bookings_one_active_per_passenger_route_idx
  on public.bookings (route_id, passenger_id)
  where status in ('confirmed', 'pending');

-- RLS para escrita de rotas fora das RPCs. Mantem o caminho direto usado pelo
-- cancelamento no frontend, mas sem abrir acesso transversal.
drop policy if exists "motorista pode criar suas proprias rotas" on public.routes;
create policy "motorista pode criar suas proprias rotas"
  on public.routes for insert
  to authenticated
  with check (auth.uid() = driver_id);

-- As RPCs usam security definer para preservar atomicidade, entao elas precisam
-- conferir auth.uid() internamente e nao confiar em ids enviados pelo cliente.
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
  if auth.uid() is null or auth.uid() <> p_driver_id then
    raise exception 'Usuario nao autorizado para criar esta rota';
  end if;

  if p_origin_region = p_destination_region then
    raise exception 'Origem e destino nao podem ser iguais';
  end if;

  if p_departure_time <= now() then
    raise exception 'A data de saida precisa ser no futuro';
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
  if auth.uid() is null or auth.uid() <> p_passenger_id then
    raise exception 'Usuario nao autorizado para reservar este assento';
  end if;

  select * into v_route from public.routes where id = p_route_id for update;

  if v_route is null then
    raise exception 'Rota nao encontrada';
  end if;
  if v_route.driver_id = p_passenger_id then
    raise exception 'Motorista nao pode reservar a propria rota';
  end if;
  if v_route.status = 'cancelled' then
    raise exception 'Esta rota foi cancelada';
  end if;
  if v_route.status = 'scheduled' then
    raise exception 'Esta rota ainda nao foi iniciada pelo motorista';
  end if;

  if exists (
    select 1 from public.bookings
    where route_id = p_route_id
      and passenger_id = p_passenger_id
      and status in ('confirmed', 'pending')
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
    for update;
  end if;

  if v_seat is null or v_seat.status <> 'available' then
    raise exception 'Assento nao disponivel';
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

create or replace function public.cancel_route(
  p_route_id uuid,
  p_driver_id uuid
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() <> p_driver_id then
    raise exception 'Usuario nao autorizado para cancelar esta rota';
  end if;

  update public.routes
  set status = 'cancelled'
  where id = p_route_id
    and driver_id = p_driver_id
    and status <> 'cancelled';
end;
$$;

grant execute on function public.cancel_route to authenticated;
