-- 0004_sincronizar_calendario.sql — Sincronización con Google Calendar y otros calendarios
-- Ejecutar en Supabase: Dashboard > SQL Editor > New query > pegar y Run (después de 0003).

begin;

-- Preferencias de sincronización, link .ics y conexión con Google (una fila por usuario)
create table public.calendar_settings (
  owner_id                  uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- Link .ics: solo se guarda el HASH del token secreto, nunca el token
  feed_token_hash           text unique,
  feed_created_at           timestamptz,
  -- Qué mandar al calendario externo (los exámenes y fechas importantes van siempre)
  include_classes           boolean not null default true,
  include_tasks             boolean not null default false,
  include_questions         boolean not null default false,
  -- Conexión con Google: el refresh token se guarda CIFRADO por el backend
  google_refresh_token_enc  text,
  google_calendar_id        text,
  google_email              text,
  google_connected_at       timestamptz,
  google_last_sync_at       timestamptz,
  google_last_error         text check (char_length(google_last_error) <= 500),
  updated_at                timestamptz not null default now()
);
create trigger calendar_settings_set_updated_at before update on public.calendar_settings
  for each row execute function public.set_updated_at();

-- Qué evento de Google corresponde a cada cosa de la app (para editar/borrar el mismo evento)
create table public.google_event_links (
  owner_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key              text not null check (char_length(key) <= 300),
  google_event_id  text not null,
  payload_hash     text not null,
  primary key (owner_id, key)
);

do $$
declare t text;
begin
  foreach t in array array['calendar_settings', 'google_event_links']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%1$s: leer propios" on public.%1$I for select to authenticated using ((select auth.uid()) = owner_id)', t);
    execute format('create policy "%1$s: crear propios" on public.%1$I for insert to authenticated with check ((select auth.uid()) = owner_id)', t);
    execute format('create policy "%1$s: editar propios" on public.%1$I for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', t);
    execute format('create policy "%1$s: borrar propios" on public.%1$I for delete to authenticated using ((select auth.uid()) = owner_id)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

commit;
