-- =========================================================================
-- MIGRAÇÃO — Rastreamento em tempo real, paradas, perfil e "buscar por
-- outra pessoa". Rode isso se seu banco JÁ TEM o schema.sql anterior
-- (incluindo a migração migration_start_route.sql) aplicado.
-- =========================================================================

-- 1) Perfil: telefone (já existe) + endereço
alter table public.profiles add column if not exists address text;

-- Atualiza o trigger de cadastro para também gravar o telefone informado
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

-- 2) Rotas: colunas de localização em tempo real do motorista
alter table public.routes add column if not exists driver_lat double precision;
alter table public.routes add column if not exists driver_lng double precision;
alter table public.routes add column if not exists location_updated_at timestamptz;

-- 3) Reservas: campos para "buscar por outra pessoa"
alter table public.bookings add column if not exists is_for_someone_else boolean not null default false;
alter table public.bookings add column if not exists recipient_name text;
alter table public.bookings add column if not exists recipient_phone text;

-- 4) Nova função: update_driver_location
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

-- 5) Habilita Realtime na tabela routes (necessário para o mapa ao vivo)
alter publication supabase_realtime add table public.routes;

-- 6) Storage — bucket de avatares
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatares são publicamente visíveis" on storage.objects;
create policy "avatares são publicamente visíveis"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

drop policy if exists "usuário pode enviar seu próprio avatar" on storage.objects;
create policy "usuário pode enviar seu próprio avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "usuário pode atualizar seu próprio avatar" on storage.objects;
create policy "usuário pode atualizar seu próprio avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "usuário pode apagar seu próprio avatar" on storage.objects;
create policy "usuário pode apagar seu próprio avatar"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- =========================================================================
-- Fim da migração
-- =========================================================================
