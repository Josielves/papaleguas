-- =========================================================================
-- PAPALEGUAS - dispositivos moveis, push e canais privados de Realtime
-- Execute depois de migration_scalable_backend.sql.
-- =========================================================================

create table if not exists public.push_tokens (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  expo_push_token   text not null,
  platform          text not null check (platform in ('android', 'ios', 'web')),
  device_name       text,
  app_version       text,
  last_seen_at      timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

alter table public.push_tokens enable row level security;

drop policy if exists "usuario gerencia seus dispositivos" on public.push_tokens;
create policy "usuario gerencia seus dispositivos"
  on public.push_tokens for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists push_tokens_user_last_seen_idx
  on public.push_tokens (user_id, last_seen_at desc);

-- Broadcast evita o custo de autorizar cada linha de Postgres Changes para
-- cada assinante. Os canais continuam privados e protegidos por RLS.
create or replace function public.broadcast_route_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'route:' || coalesce(new.route_id, old.route_id)::text,
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists route_locations_broadcast_trigger on public.route_locations;
create trigger route_locations_broadcast_trigger
  after insert or update or delete on public.route_locations
  for each row execute function public.broadcast_route_location();

create or replace function public.broadcast_user_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'user:' || coalesce(new.user_id, old.user_id)::text || ':notifications',
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists notifications_broadcast_trigger on public.notifications;
create trigger notifications_broadcast_trigger
  after insert or update or delete on public.notifications
  for each row execute function public.broadcast_user_notification();

create or replace function public.can_access_route_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_route_id uuid;
begin
  if p_topic !~ '^route:[0-9a-fA-F-]{36}$' then return false; end if;
  v_route_id := split_part(p_topic, ':', 2)::uuid;
  return exists (
    select 1
    from public.routes r
    where r.id = v_route_id
      and (
        r.driver_id = auth.uid()
        or r.status in ('open', 'full', 'in_progress')
        or exists (
          select 1 from public.bookings b
          where b.route_id = r.id
            and b.passenger_id = auth.uid()
            and b.status in ('confirmed', 'pending')
        )
      )
  );
exception when others then
  return false;
end;
$$;

revoke all on function public.can_access_route_topic(text) from public, anon;
grant execute on function public.can_access_route_topic(text) to authenticated;

drop policy if exists "usuario recebe seus broadcasts" on realtime.messages;
create policy "usuario recebe seus broadcasts"
  on realtime.messages for select
  to authenticated
  using (
    realtime.topic() = 'user:' || auth.uid()::text || ':notifications'
    or public.can_access_route_topic(realtime.topic())
  );

-- Limpeza recomendada por tarefa agendada: tokens sem uso por 120 dias.
create or replace function public.delete_stale_push_tokens()
returns bigint
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.push_tokens
    where last_seen_at < now() - interval '120 days'
    returning 1
  )
  select count(*) from deleted;
$$;

revoke all on function public.delete_stale_push_tokens() from public, anon, authenticated;
grant execute on function public.delete_stale_push_tokens() to service_role;

-- =========================================================================
-- Fim da migracao
-- =========================================================================
