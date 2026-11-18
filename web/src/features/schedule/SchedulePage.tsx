import { useRef, useState } from 'react'
import { AIDisabledNotice, EmptyState, ListCard, Loading, PageHeader, QueryError, Section } from '../../components/study'
import { Alert, Button } from '../../components/ui'
import { errorMessage } from '../../lib/api'
import { DATE_KIND_LABEL, formatLongDate, formatRelativeDate, formatTime, parseISODate, todayISO, WEEKDAYS } from '../../lib/dates'
import { useImportSchedule, useSchedule, useStatus } from '../../lib/queries'
import type { Schedule, ScheduleInput } from '../../lib/types'
import { JoinLink, ModalityBadge } from '../../components/modality'
import { ScheduleEditor } from './ScheduleEditor'

type Mode = { kind: 'view' } | { kind: 'edit'; initial: ScheduleInput; warnings: string[]; fromAI: boolean }

/** Pasa el horario guardado al formato del editor (agrupado por materia). */
function toInput(schedule: Schedule): ScheduleInput {
  const bySubject = new Map<string, ScheduleInput['subjects'][number]>()
  for (const s of schedule.sessions) {
    const entry = bySubject.get(s.subject_name) ?? { name: s.subject_name, color: s.subject_color, sessions: [] }
    entry.sessions.push({
      weekday: s.weekday,
      start_time: formatTime(s.start_time),
      end_time: formatTime(s.end_time),
      location: s.location,
      modality: s.modality ?? 'unknown',
      meeting_url: s.meeting_url ?? null,
    })
    bySubject.set(s.subject_name, entry)
  }
  return {
    subjects: [...bySubject.values()],
    important_dates: schedule.important_dates.map((d) => ({ date: d.date, kind: d.kind, title: d.title, subject_name: d.subject_name })),
    starts_on: schedule.starts_on,
    ends_on: schedule.ends_on,
  }
}

export function SchedulePage() {
  const { data, isPending, isError, error, refetch } = useSchedule()
  const { data: status } = useStatus()
  const importer = useImportSchedule()
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<Mode>({ kind: 'view' })
  const [saved, setSaved] = useState(false)

  if (isPending) return <Loading />
  if (isError) return <QueryError error={error} onRetry={() => refetch()} />

  const startImport = (file: File | undefined) => {
    if (!file) return
    setSaved(false)
    importer.mutate(file, {
      onSuccess: (draft) => setMode({ kind: 'edit', initial: draft, warnings: draft.warnings, fromAI: true }),
    })
    if (fileRef.current) fileRef.current.value = ''
  }

  if (mode.kind === 'edit') {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title={mode.fromAI ? 'Revisá tu horario' : 'Editar horario'}
          subtitle={mode.fromAI ? 'Esto es lo que leyó la IA. Corregí lo que haga falta y guardalo.' : undefined}
        />
        <ScheduleEditor
          initial={mode.initial}
          warnings={mode.warnings}
          onCancel={() => {
            importer.reset()
            setMode({ kind: 'view' })
          }}
          onDone={() => {
            importer.reset()
            setSaved(true)
            setMode({ kind: 'view' })
          }}
        />
      </div>
    )
  }

  const today = todayISO()
  const days = WEEKDAYS.map((name, i) => ({ name, i, sessions: data.sessions.filter((s) => s.weekday === i) })).filter(
    (d) => d.sessions.length > 0 || d.i < 5,
  )
  const upcomingDates = data.important_dates.filter((d) => d.date >= today)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Horario"
        subtitle="Tu horario de clases se usa para saber cuándo es la próxima clase de cada materia."
        actions={
          <>
            <Button variant="secondary" onClick={() => setMode({ kind: 'edit', initial: toInput(data), warnings: [], fromAI: false })}>
              Editar a mano
            </Button>
            <Button onClick={() => fileRef.current?.click()} loading={importer.isPending} disabled={status && !status.ai_enabled}>
              Cargar foto del calendario
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              className="sr-only"
              tabIndex={-1}
              aria-label="Foto o PDF del calendario"
              onChange={(e) => startImport(e.target.files?.[0])}
            />
          </>
        }
      />

      <AIDisabledNotice>La IA no está configurada: podés cargar el horario a mano con «Editar a mano».</AIDisabledNotice>
      {importer.isPending && <Alert tone="info">La IA está leyendo tu calendario… puede tardar hasta un minuto.</Alert>}
      {importer.isError && <Alert>{errorMessage(importer.error)}</Alert>}
      {saved && <Alert tone="success">Horario guardado.</Alert>}

      {data.sessions.length > 0 && <PeriodBanner startsOn={data.starts_on} endsOn={data.ends_on} today={today} onEdit={() => setMode({ kind: 'edit', initial: toInput(data), warnings: [], fromAI: false })} />}

      <Section title="Clases de la semana">
        {data.sessions.length === 0 ? (
          <EmptyState>Todavía no cargaste tu horario. Subí una foto del calendario de tu institución o cargalo a mano.</EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {days.map((d) => (
              <div key={d.i} className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="mb-2 text-sm font-semibold">{d.name}</h3>
                {d.sessions.length === 0 ? (
                  <p className="text-xs text-zinc-400">Sin clases</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {d.sessions.map((s) => (
                      <li key={s.id} className="rounded-lg bg-zinc-50 px-2.5 py-1.5 dark:bg-zinc-800/60" style={{ borderLeft: `3px solid ${s.subject_color}` }}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-medium">{s.subject_name}</p>
                          <ModalityBadge modality={s.modality} />
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-zinc-500">
                            {formatTime(s.start_time)}–{formatTime(s.end_time)}
                            {s.modality !== 'virtual' && s.location && ` · ${s.location}`}
                          </p>
                          <JoinLink url={s.meeting_url} subject={s.subject_name} compact />
                        </div>
                        {s.modality === 'virtual' && !s.meeting_url && (
                          <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400">Falta el link de la videollamada</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Fechas importantes">
        {upcomingDates.length === 0 ? (
          <EmptyState>No hay fechas importantes próximas.</EmptyState>
        ) : (
          <ListCard>
            {upcomingDates.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{d.title}</p>
                  <p className="text-xs text-zinc-500">
                    {DATE_KIND_LABEL[d.kind]}
                    {d.subject_name && ` · ${d.subject_name}`}
                  </p>
                </div>
                <span className={`shrink-0 text-xs font-medium ${d.kind === 'exam' ? 'text-red-600 dark:text-red-400' : 'text-zinc-500'}`}>
                  {formatRelativeDate(d.date, today)}
                </span>
              </li>
            ))}
          </ListCard>
        )}
      </Section>
    </div>
  )
}

function PeriodBanner({
  startsOn,
  endsOn,
  today,
  onEdit,
}: {
  startsOn: string | null
  endsOn: string | null
  today: string
  onEdit: () => void
}) {
  const fmt = (iso: string) => formatLongDate(iso)
  let tone: 'info' | 'success' | 'error' = 'success'
  let text: string
  if (!endsOn) {
    tone = 'info'
    text = 'Este horario no tiene fecha de fin: las clases se repiten para siempre.'
  } else if (endsOn < today) {
    tone = 'error'
    text = `Este horario terminó el ${fmt(endsOn)}. Cargá el horario nuevo o extendé la vigencia.`
  } else if (startsOn && startsOn > today) {
    text = `Este horario empieza el ${fmt(startsOn)} y vale hasta el ${fmt(endsOn)}.`
  } else {
    const weeks = Math.ceil((parseISODate(endsOn).getTime() - parseISODate(today).getTime()) / (7 * 86_400_000))
    text = `Vigente hasta el ${fmt(endsOn)} (${weeks <= 1 ? 'última semana' : `quedan ${weeks} semanas`}).`
  }
  return (
    <Alert tone={tone}>
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span>{text}</span>
        <button type="button" onClick={onEdit} className="font-medium underline underline-offset-2">
          Cambiar vigencia
        </button>
      </span>
    </Alert>
  )
}
