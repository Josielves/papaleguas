-- =========================================================================
-- PAPALEGUAS - perfil operacional, notificacoes e fila de espera automatica
-- Execute depois de schema.sql e migration_scale_and_security.sql.
-- =========================================================================

-- Perfil operacional do motorista.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists vehicle_model text;
alter table public.profiles add column if not exists vehicle_plate text;
alter table public.profiles add column if not exists vehicle_color text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id, name, email, account_type, phone, vehicle_model, vehicle_plate, vehicle_color
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'account_type', 'passenger'),
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'vehicle_model',
    upper(new.raw_user_meta_data->>'vehicle_plate'),
    new.raw_user_meta_data->>'vehicle_color'
  )
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$;

-- Caixa de notificacoes do usuario.
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null,
  title       text not null,
  message     text not null,
  data        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists "usuario ve suas notificacoes" on public.notifications;
create policy "usuario ve suas notificacoes"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "usuario atualiza suas notificacoes" on public.notifications;
create policy "usuario atualiza suas notificacoes"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

-- Fila para rotas lotadas. Uma pessoa pode aguardar uma vez por rota.
create table if not exists public.route_waitlist (
  id                    uuid primary key default gen_random_uuid(),
  route_id              uuid not null references public.routes(id) on delete cascade,
  passenger_id          uuid not null references public.profiles(id) on delete cascade,
  pickup_address        text,
  pickup_lat            double precision,
  pickup_lng            double precision,
  is_for_someone_else   boolean not null default false,
  recipient_name        text,
  recipient_phone       text,
  status                text not null default 'waiting'
                        check (status in ('waiting', 'promoted', 'cancelled', 'expired')),
  promoted_booking_id   uuid references public.bookings(id) on delete set null,
  created_at            timestamptz not null default now(),
  promoted_at           timestamptz
);

alter table public.route_waitlist enable row level security;

drop policy if exists "fila visivel para passageiro e motorista" on public.route_waitlist;
create policy "fila visivel para passageiro e motorista"
  on public.route_waitlist for select
  to authenticated
  using (
    auth.uid() = passenger_id
    or auth.uid() in (select driver_id from public.routes where id = route_id)
  );

create unique index if not exists route_waitlist_one_active_idx
  on public.route_waitlist (route_id, passenger_id)
  where status = 'waiting';

create index if not exists route_waitlist_promotion_idx
  on public.route_waitlist (route_id, status, created_at)
  where status = 'waiting';

create or replace function public.join_route_waitlist(
  p_route_id        uuid,
  p_passenger_id    uuid,
  p_pickup_address  text default null,
  p_pickup_lat      double precision default null,
  p_pickup_lng      double precision default null
)
returns public.route_waitlist
language plpgsql
security definer set search_path = public
as $$
declare
  v_route public.routes;
  v_entry public.route_waitlist;
begin
  if auth.uid() is null or auth.uid() <> p_passenger_id then
    raise exception 'Usuario nao autorizado para entrar na fila';
  end if;

  select * into v_route from public.routes where id = p_route_id for update;
  if v_route is null or v_route.status = 'cancelled' or v_route.departure_time <= now() then
    raise exception 'Rota indisponivel';
  end if;
  if v_route.driver_id = p_passenger_id then
    raise exception 'Motorista nao pode entrar na fila da propria rota';
  end if;
  if v_route.available_seats > 0 and v_route.status <> 'full' then
    raise exception 'Ha assento disponivel para reserva';
  end if;
  if exists (
    select 1 from public.bookings
    where route_id = p_route_id and passenger_id = p_passenger_id
      and status in ('confirmed', 'pending')
  ) then
    raise exception 'Voce ja tem reserva nesta rota';
  end if;

  insert into public.route_waitlist (
    route_id, passenger_id, pickup_address, pickup_lat, pickup_lng
  ) values (
    p_route_id, p_passenger_id, p_pickup_address, p_pickup_lat, p_pickup_lng
  )
  returning * into v_entry;

  return v_entry;
end;
$$;

create or replace function public.leave_route_waitlist(
  p_waitlist_id uuid,
  p_passenger_id uuid
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() <> p_passenger_id then
    raise exception 'Usuario nao autorizado para sair da fila';
  end if;

  update public.route_waitlist
  set status = 'cancelled'
  where id = p_waitlist_id
    and passenger_id = p_passenger_id
    and status = 'waiting';
end;
$$;

-- Ao cancelar, a mesma vaga vai para o primeiro passageiro da fila. A troca
-- ocorre na mesma transacao, impedindo dupla reserva ou perda da vaga.
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
  v_route public.routes;
  v_next public.route_waitlist;
  v_promoted public.bookings;
begin
  if auth.uid() is null or auth.uid() <> p_passenger_id then
    raise exception 'Usuario nao autorizado para cancelar esta reserva';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id and passenger_id = p_passenger_id
  for update;

  if v_booking is null then
    raise exception 'Reserva nao encontrada';
  end if;
  if v_booking.status = 'cancelled' then
    return;
  end if;

  select * into v_route from public.routes where id = v_booking.route_id for update;
  update public.bookings set status = 'cancelled' where id = p_booking_id;

  select * into v_next
  from public.route_waitlist
  where route_id = v_booking.route_id and status = 'waiting'
  order by created_at, id
  limit 1
  for update skip locked;

  if v_next is not null and v_route.status <> 'cancelled' and v_route.departure_time > now() then
    update public.seats
    set status = 'reserved', passenger_id = v_next.passenger_id, reserved_at = now()
    where id = v_booking.seat_id;

    insert into public.bookings (
      route_id, seat_id, passenger_id, seat_number,
      pickup_address, pickup_lat, pickup_lng, status,
      is_for_someone_else, recipient_name, recipient_phone
    ) values (
      v_booking.route_id, v_booking.seat_id, v_next.passenger_id, v_booking.seat_number,
      v_next.pickup_address, v_next.pickup_lat, v_next.pickup_lng, 'confirmed',
      v_next.is_for_someone_else, v_next.recipient_name, v_next.recipient_phone
    ) returning * into v_promoted;

    update public.route_waitlist
    set status = 'promoted', promoted_booking_id = v_promoted.id, promoted_at = now()
    where id = v_next.id;

    update public.routes
    set status = case when available_seats = 0 then 'full' else status end
    where id = v_booking.route_id;

    insert into public.notifications (user_id, type, title, message, data)
    values (
      v_next.passenger_id,
      'waitlist_promoted',
      'Seu assento foi liberado',
      'Uma vaga abriu e sua reserva foi confirmada automaticamente.',
      jsonb_build_object('route_id', v_booking.route_id, 'booking_id', v_promoted.id)
    );

    insert into public.notifications (user_id, type, title, message, data)
    values (
      v_route.driver_id,
      'seat_refilled',
      'Vaga preenchida automaticamente',
      'Uma reserva cancelada foi repassada para a primeira pessoa da fila.',
      jsonb_build_object('route_id', v_booking.route_id, 'booking_id', v_promoted.id)
    );
  else
    update public.seats
    set status = 'available', passenger_id = null, reserved_at = null
    where id = v_booking.seat_id;

    update public.routes
    set available_seats = least(available_seats + 1, total_seats),
        status = case when status = 'full' then 'open' else status end
    where id = v_booking.route_id;
  end if;
end;
$$;

grant execute on function public.join_route_waitlist to authenticated;
grant execute on function public.leave_route_waitlist to authenticated;
grant execute on function public.cancel_booking to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.route_waitlist;
exception when duplicate_object then null;
end $$;

-- =========================================================================
-- Fim da migracao
-- =========================================================================
