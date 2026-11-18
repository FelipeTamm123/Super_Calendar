-- 0001_init.sql — Esquema inicial de Super Calendar
-- Ejecutar en Supabase: Dashboard > SQL Editor > New query > pegar y Run.
-- Todo con RLS: cada usuario solo ve y modifica SUS filas.

begin;

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: 1 a 1 con auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text unique check (username ~ '^[a-zA-Z0-9_]{3,30}$'),
  full_name   text check (char_length(full_name) between 1 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles: leer el propio"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: editar el propio"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Crea el perfil automáticamente cuando alguien se registra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- items: recurso de ejemplo, cada fila pertenece a un usuario
-- ---------------------------------------------------------------------------
create table if not exists public.items (
  id           bigint generated always as identity primary key,
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 200),
  description  text check (char_length(description) <= 2000),
  done         boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists items_owner_created_idx on public.items (owner_id, created_at desc);

create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

alter table public.items enable row level security;

create policy "items: leer los propios"
  on public.items for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "items: crear propios"
  on public.items for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "items: editar los propios"
  on public.items for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "items: borrar los propios"
  on public.items for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- ---------------------------------------------------------------------------
-- Permisos mínimos: anon no accede a nada; authenticated solo lo necesario
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.items from anon;
grant select, update (username, full_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.items to authenticated;

commit;
