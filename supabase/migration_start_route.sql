-- =========================================================================
-- MIGRAÇÃO — Adiciona o fluxo "Iniciar rota"
-- Rode isso se seu banco JÁ TEM o schema.sql antigo aplicado.
-- Se você ainda não rodou nenhum schema, ignore este arquivo e rode
-- só o supabase/schema.sql (versão nova) do zero.
-- =========================================================================

-- 1) Permite o novo status 'scheduled' e adiciona a coluna started_at
alter table public.routes drop constraint if exists routes_status_check;
alter table public.routes add constraint routes_status_check
  check (status in ('scheduled', 'open', 'full', 'cancelled'));
alter table public.routes add column if not exists started_at timestamptz;

-- 2) Novas rotas passam a nascer como 'scheduled' por padrão
alter table public.routes alter column status set default 'scheduled';

-- 3) reserve_seat passa a bloquear rotas ainda não iniciadas
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

-- 4) Nova função: start_route
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

grant execute on function public.start_route to authenticated;

-- 5) (Opcional) Se você já tinha rotas 'open' criadas antes desta migração
-- e quer que elas passem a exigir início manual, rode a linha abaixo.
-- Caso prefira que rotas já existentes continuem visíveis, não rode.
-- update public.routes set status = 'scheduled', started_at = null where status = 'open';

-- =========================================================================
-- Fim da migração
-- =========================================================================
