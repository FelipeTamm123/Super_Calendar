-- 0002_estudio.sql — Funcionalidades de estudio de Super Calendar
-- Ejecutar en Supabase: Dashboard > SQL Editor > New query > pegar y Run (después de 0001).
--
-- Agrega: materias, horario de clases, fechas importantes, apuntes, preguntas,
-- temas pendientes y agenda de estudio. Todo con RLS (cada usuario ve solo lo suyo).
-- También crea el bucket privado "notes" en Storage para los archivos de apuntes.
--
-- OJO: borra la tabla de ejemplo "items" (la lista de tareas de prueba),
-- que fue reemplazada por la agenda de estudio.

begin;

drop table if exists public.items;

-- ---------------------------------------------------------------------------
-- Materias
-- ---------------------------------------------------------------------------
create table public.subjects (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 100),
  color       text not null default '#10b981' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index subjects_owner_name_uidx on public.subjects (owner_id, lower(name));
create trigger subjects_set_updated_at before update on public.subjects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Horario semanal de clases (weekday: 0 = lunes ... 6 = domingo)
-- ---------------------------------------------------------------------------
create table public.class_sessions (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id  bigint not null references public.subjects (id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),
  start_time  time not null,
  end_time    time not null,
  location    text check (char_length(location) <= 100),
  created_at  timestamptz not null default now(),
  check (end_time > start_time)
);
create index class_sessions_owner_idx on public.class_sessions (owner_id, weekday, start_time);

-- ---------------------------------------------------------------------------
-- Fechas importantes (exámenes, feriados, entregas)
-- ---------------------------------------------------------------------------
create table public.important_dates (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id  bigint references public.subjects (id) on delete cascade,
  date        date not null,
  kind        text not null check (kind in ('exam', 'holiday', 'deadline', 'other')),
  title       text not null check (char_length(title) between 1 and 200),
  created_at  timestamptz not null default now()
);
create index important_dates_owner_idx on public.important_dates (owner_id, date);

-- ---------------------------------------------------------------------------
-- Apuntes de clase
-- ---------------------------------------------------------------------------
create table public.notes (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id  bigint not null references public.subjects (id) on delete cascade,
  class_date  date not null,
  title       text not null check (char_length(title) between 1 and 200),
  content     text check (char_length(content) <= 100000),   -- texto escrito o transcripto por la IA
  summary     text check (char_length(summary) <= 5000),     -- resumen hecho por la IA
  file_path   text,                                          -- ruta en Storage (bucket "notes")
  file_type   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index notes_owner_subject_idx on public.notes (owner_id, subject_id, class_date desc);
create trigger notes_set_updated_at before update on public.notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Preguntas al aire
-- ---------------------------------------------------------------------------
create table public.questions (
  id             bigint generated always as identity primary key,
  owner_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id     bigint references public.subjects (id) on delete set null,
  text           text not null check (char_length(text) between 1 and 2000),
  scheduled_for  date,
  resolved       boolean not null default false,
  answer         text check (char_length(answer) <= 5000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index questions_owner_idx on public.questions (owner_id, resolved, scheduled_for);
create trigger questions_set_updated_at before update on public.questions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Temas que faltan aprender (detectados por la IA en los apuntes)
-- ---------------------------------------------------------------------------
create table public.pending_topics (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id  bigint not null references public.subjects (id) on delete cascade,
  note_id     bigint references public.notes (id) on delete cascade,
  topic       text not null check (char_length(topic) between 1 and 300),
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index pending_topics_owner_idx on public.pending_topics (owner_id, subject_id, resolved);

-- ---------------------------------------------------------------------------
-- Agenda de estudio ("qué estudiar hoy")
-- ---------------------------------------------------------------------------
create table public.study_tasks (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id  bigint not null references public.subjects (id) on delete cascade,
  note_id     bigint references public.notes (id) on delete cascade,
  due_date    date not null,
  title       text not null check (char_length(title) between 1 and 300),
  detail      text check (char_length(detail) <= 2000),
  done        boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index study_tasks_owner_due_idx on public.study_tasks (owner_id, due_date, done);
create trigger study_tasks_set_updated_at before update on public.study_tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: cada usuario solo accede a sus filas (mismas 4 políticas en cada tabla)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['subjects','class_sessions','important_dates','notes','questions','pending_topics','study_tasks']
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

-- Un usuario no puede colgar sus filas de una materia ajena
create or replace function public.check_subject_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.subject_id is not null and not exists (
    select 1 from public.subjects s where s.id = new.subject_id and s.owner_id = new.owner_id
  ) then
    raise exception 'La materia no existe' using errcode = '23503';
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['class_sessions','important_dates','notes','questions','pending_topics','study_tasks']
  loop
    execute format('create trigger %1$s_check_subject before insert or update of subject_id on public.%1$I for each row execute function public.check_subject_owner()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- apply_schedule: reemplaza horario + fechas importantes en UNA transacción.
-- Crea las materias que no existan (las existentes se conservan con sus apuntes).
-- security invoker: corre con los permisos del usuario, así aplica RLS.
-- ---------------------------------------------------------------------------
create or replace function public.apply_schedule(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid  uuid := auth.uid();
  s    jsonb;
  sess jsonb;
  d    jsonb;
  sid  bigint;
begin
  if uid is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  delete from public.class_sessions where owner_id = uid;
  delete from public.important_dates where owner_id = uid;

  for s in select * from jsonb_array_elements(coalesce(payload -> 'subjects', '[]'::jsonb)) loop
    select id into sid from public.subjects where owner_id = uid and lower(name) = lower(trim(s ->> 'name'));
    if sid is null then
      insert into public.subjects (owner_id, name, color)
      values (uid, trim(s ->> 'name'), coalesce(s ->> 'color', '#10b981'))
      returning id into sid;
    elsif s ->> 'color' is not null then
      update public.subjects set color = s ->> 'color' where id = sid;
    end if;

    for sess in select * from jsonb_array_elements(coalesce(s -> 'sessions', '[]'::jsonb)) loop
      insert into public.class_sessions (owner_id, subject_id, weekday, start_time, end_time, location)
      values (uid, sid, (sess ->> 'weekday')::smallint, (sess ->> 'start_time')::time,
              (sess ->> 'end_time')::time, nullif(trim(sess ->> 'location'), ''));
    end loop;
  end loop;

  for d in select * from jsonb_array_elements(coalesce(payload -> 'important_dates', '[]'::jsonb)) loop
    sid := null;
    if coalesce(trim(d ->> 'subject_name'), '') <> '' then
      select id into sid from public.subjects where owner_id = uid and lower(name) = lower(trim(d ->> 'subject_name'));
    end if;
    insert into public.important_dates (owner_id, subject_id, date, kind, title)
    values (uid, sid, (d ->> 'date')::date, d ->> 'kind', d ->> 'title');
  end loop;
end;
$$;

revoke all on function public.apply_schedule(jsonb) from public, anon;
grant execute on function public.apply_schedule(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: bucket privado para archivos de apuntes (máx. 10 MB)
-- Cada usuario solo puede tocar archivos dentro de su carpeta: <user_id>/...
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notes', 'notes', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain'])
on conflict (id) do nothing;

create policy "notes bucket: leer propios" on storage.objects for select to authenticated
  using (bucket_id = 'notes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "notes bucket: subir propios" on storage.objects for insert to authenticated
  with check (bucket_id = 'notes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "notes bucket: borrar propios" on storage.objects for delete to authenticated
  using (bucket_id = 'notes' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
