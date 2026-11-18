-- 0005_vigencia_horario.sql — Período de vigencia del horario (ej: el cuatrimestre)
-- Ejecutar en Supabase: Dashboard > SQL Editor > New query > pegar y Run (después de 0004).
-- Sin fecha de fin las clases se repetían para siempre; ahora el horario vale entre starts_on y ends_on.

begin;

create table public.schedule_periods (
  owner_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  starts_on   date,
  ends_on     date,
  updated_at  timestamptz not null default now(),
  check (starts_on is null or ends_on is null or ends_on >= starts_on)
);
create trigger schedule_periods_set_updated_at before update on public.schedule_periods
  for each row execute function public.set_updated_at();

alter table public.schedule_periods enable row level security;
create policy "schedule_periods: leer propios" on public.schedule_periods for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "schedule_periods: crear propios" on public.schedule_periods for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "schedule_periods: editar propios" on public.schedule_periods for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "schedule_periods: borrar propios" on public.schedule_periods for delete to authenticated
  using ((select auth.uid()) = owner_id);
revoke all on public.schedule_periods from anon;
grant select, insert, update, delete on public.schedule_periods to authenticated;

-- apply_schedule ahora también guarda el período (en la misma transacción)
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

  insert into public.schedule_periods (owner_id, starts_on, ends_on)
  values (uid, nullif(payload ->> 'starts_on', '')::date, nullif(payload ->> 'ends_on', '')::date)
  on conflict (owner_id) do update set starts_on = excluded.starts_on, ends_on = excluded.ends_on;

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
      insert into public.class_sessions
        (owner_id, subject_id, weekday, start_time, end_time, location, modality, meeting_url)
      values (uid, sid, (sess ->> 'weekday')::smallint, (sess ->> 'start_time')::time,
              (sess ->> 'end_time')::time, nullif(trim(sess ->> 'location'), ''),
              coalesce(nullif(sess ->> 'modality', ''), 'unknown'),
              nullif(trim(sess ->> 'meeting_url'), ''));
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

commit;
