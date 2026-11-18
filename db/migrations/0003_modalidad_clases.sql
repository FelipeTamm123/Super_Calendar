-- 0003_modalidad_clases.sql — Clases virtuales o presenciales, con link de videollamada
-- Ejecutar en Supabase: Dashboard > SQL Editor > New query > pegar y Run (después de 0002).

begin;

alter table public.class_sessions
  add column modality text not null default 'unknown'
    check (modality in ('in_person', 'virtual', 'unknown')),
  add column meeting_url text
    check (meeting_url is null or (meeting_url ~ '^https?://' and char_length(meeting_url) <= 500));

-- apply_schedule ahora también guarda modalidad y link
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
