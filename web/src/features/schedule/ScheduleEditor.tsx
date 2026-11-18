import { useState } from 'react'
import { Alert, Button, Card } from '../../components/ui'
import { errorMessage } from '../../lib/api'
import { addDays, DATE_KIND_LABEL, parseISODate, toISODate, todayISO, WEEKDAYS } from '../../lib/dates'
import { useSaveSchedule } from '../../lib/queries'
import { isSafeMeetingUrl, MODALITY_LABEL } from '../../lib/modality'
import type { DateKind, ImportantDateInput, Modality, ScheduleInput, SubjectScheduleInput } from '../../lib/types'

const inputClass =
  'rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900'

const PALETTE = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

/** Valida en el cliente lo mismo que el backend, para avisar antes de mandar. */
function validate(data: ScheduleInput): string | null {
  const names = new Set<string>()
  for (const s of data.subjects) {
    const name = s.name.trim()
    if (!name) return 'Hay una materia sin nombre.'
    if (names.has(name.toLowerCase())) return `La materia «${name}» está repetida.`
    names.add(name.toLowerCase())
    for (const sess of s.sessions) {
      if (!sess.start_time || !sess.end_time) return `Falta un horario en ${name}.`
      if (sess.end_time <= sess.start_time) return `En ${name}, la hora de fin tiene que ser posterior a la de inicio.`
      if (sess.meeting_url && !isSafeMeetingUrl(sess.meeting_url)) {
        return `En ${name}, el link de la videollamada no es válido (tiene que empezar con https://).`
      }
    }
  }
  if (data.starts_on && data.ends_on && data.ends_on < data.starts_on) {
    return 'La fecha de fin del horario tiene que ser posterior a la de inicio.'
  }
  for (const d of data.important_dates) {
    if (!d.date || !d.title.trim()) return 'Hay una fecha importante incompleta (falta fecha o título).'
  }
  return null
}

export function ScheduleEditor({
  initial,
  warnings = [],
  onDone,
  onCancel,
}: {
  initial: ScheduleInput
  warnings?: string[]
  onDone: () => void
  onCancel: () => void
}) {
  const [subjects, setSubjects] = useState<SubjectScheduleInput[]>(initial.subjects)
  const [dates, setDates] = useState<ImportantDateInput[]>(initial.important_dates)
  const [startsOn, setStartsOn] = useState(initial.starts_on ?? '')
  const [endsOn, setEndsOn] = useState(initial.ends_on ?? '')
  const [localError, setLocalError] = useState<string | null>(null)
  const save = useSaveSchedule()

  const updateSubject = (i: number, patch: Partial<SubjectScheduleInput>) =>
    setSubjects((list) => list.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))

  const updateSession = (si: number, ti: number, patch: Partial<SubjectScheduleInput['sessions'][number]>) =>
    updateSubject(si, { sessions: subjects[si].sessions.map((t, idx) => (idx === ti ? { ...t, ...patch } : t)) })

  const updateDate = (i: number, patch: Partial<ImportantDateInput>) =>
    setDates((list) => list.map((d, idx) => (idx === i ? { ...d, ...patch } : d)))

  const handleSave = () => {
    const data: ScheduleInput = {
      subjects: subjects.map((s) => ({
        ...s,
        name: s.name.trim(),
        sessions: s.sessions.map((t) => ({
          ...t,
          location: t.location?.trim() || null,
          // el link solo tiene sentido en clases virtuales
          meeting_url: t.modality === 'virtual' ? t.meeting_url?.trim() || null : null,
        })),
      })),
      important_dates: dates.map((d) => ({ ...d, title: d.title.trim(), subject_name: d.subject_name || null })),
      starts_on: startsOn || null,
      ends_on: endsOn || null,
    }
    const err = validate(data)
    setLocalError(err)
    if (err) return
    save.mutate(data, { onSuccess: onDone })
  }

  return (
    <div className="flex flex-col gap-6">
      {warnings.length > 0 && (
        <Alert tone="info">
          <p className="font-medium">Revisá esto antes de guardar:</p>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Alert>
      )}

      <PeriodSection startsOn={startsOn} endsOn={endsOn} onStart={setStartsOn} onEnd={setEndsOn} />

      <section className="flex flex-col gap-3" aria-label="Materias y clases">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Materias y clases</h2>
        {subjects.length === 0 && <p className="text-sm text-zinc-500">No hay materias. Agregá una.</p>}
        {subjects.map((s, si) => (
          <Card key={si} className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="color"
                value={s.color ?? PALETTE[si % PALETTE.length]}
                onChange={(e) => updateSubject(si, { color: e.target.value })}
                className="size-9 cursor-pointer rounded-md border border-zinc-300 bg-transparent p-0.5 dark:border-zinc-700"
                aria-label={`Color de ${s.name || 'la materia'}`}
              />
              <input
                value={s.name}
                maxLength={100}
                onChange={(e) => updateSubject(si, { name: e.target.value })}
                placeholder="Nombre de la materia"
                aria-label="Nombre de la materia"
                className={`${inputClass} min-w-0 flex-1 font-medium`}
              />
              <Button variant="danger" className="px-2 py-1" onClick={() => setSubjects((l) => l.filter((_, i) => i !== si))}>
                Quitar
              </Button>
            </div>

            {s.sessions.map((t, ti) => (
              <div key={ti} className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-2.5 dark:border-zinc-800">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={t.weekday}
                  onChange={(e) => updateSession(si, ti, { weekday: Number(e.target.value) })}
                  className={inputClass}
                  aria-label="Día"
                >
                  {WEEKDAYS.map((d, i) => (
                    <option key={i} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={t.start_time.slice(0, 5)}
                  onChange={(e) => updateSession(si, ti, { start_time: e.target.value })}
                  className={inputClass}
                  aria-label="Hora de inicio"
                />
                <span className="text-zinc-400">a</span>
                <input
                  type="time"
                  value={t.end_time.slice(0, 5)}
                  onChange={(e) => updateSession(si, ti, { end_time: e.target.value })}
                  className={inputClass}
                  aria-label="Hora de fin"
                />
                <select
                  value={t.modality}
                  onChange={(e) => updateSession(si, ti, { modality: e.target.value as Modality })}
                  className={inputClass}
                  aria-label="Modalidad"
                >
                  {(Object.keys(MODALITY_LABEL) as Modality[]).map((m) => (
                    <option key={m} value={m}>
                      {MODALITY_LABEL[m]}
                    </option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  className="ml-auto px-2 py-1"
                  aria-label="Quitar clase"
                  onClick={() => updateSubject(si, { sessions: s.sessions.filter((_, i) => i !== ti) })}
                >
                  ✕
                </Button>
              </div>
              {t.modality === 'virtual' ? (
                <input
                  type="url"
                  inputMode="url"
                  value={t.meeting_url ?? ''}
                  maxLength={500}
                  placeholder="Link de la videollamada (https://meet.google.com/…, https://zoom.us/j/…)"
                  onChange={(e) => updateSession(si, ti, { meeting_url: e.target.value })}
                  className={`${inputClass} w-full`}
                  aria-label={`Link de la videollamada de ${s.name || 'la materia'}`}
                />
              ) : (
                <input
                  value={t.location ?? ''}
                  maxLength={100}
                  placeholder="Aula o lugar (opcional)"
                  onChange={(e) => updateSession(si, ti, { location: e.target.value })}
                  className={`${inputClass} w-full sm:w-64`}
                  aria-label="Aula"
                />
              )}
              </div>
            ))}
            <Button
              variant="ghost"
              className="self-start px-2 py-1 text-brand-600"
              onClick={() =>
                updateSubject(si, { sessions: [...s.sessions, { weekday: 0, start_time: '08:00', end_time: '10:00', location: null, modality: 'unknown', meeting_url: null }] })
              }
            >
              + Agregar clase
            </Button>
          </Card>
        ))}
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => setSubjects((l) => [...l, { name: '', color: PALETTE[l.length % PALETTE.length], sessions: [] }])}
        >
          + Agregar materia
        </Button>
      </section>

      <section className="flex flex-col gap-3" aria-label="Fechas importantes">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Fechas importantes</h2>
        {dates.length === 0 && <p className="text-sm text-zinc-500">Sin fechas importantes.</p>}
        {dates.map((d, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input type="date" value={d.date} onChange={(e) => updateDate(i, { date: e.target.value })} className={inputClass} aria-label="Fecha" />
            <select value={d.kind} onChange={(e) => updateDate(i, { kind: e.target.value as DateKind })} className={inputClass} aria-label="Tipo">
              {(Object.keys(DATE_KIND_LABEL) as DateKind[]).map((k) => (
                <option key={k} value={k}>
                  {DATE_KIND_LABEL[k]}
                </option>
              ))}
            </select>
            <input
              value={d.title}
              maxLength={200}
              placeholder="Título"
              onChange={(e) => updateDate(i, { title: e.target.value })}
              className={`${inputClass} min-w-0 flex-1`}
              aria-label="Título"
            />
            <select
              value={d.subject_name ?? ''}
              onChange={(e) => updateDate(i, { subject_name: e.target.value || null })}
              className={`${inputClass} max-w-40`}
              aria-label="Materia"
            >
              <option value="">General</option>
              {subjects
                .filter((s) => s.name.trim())
                .map((s, idx) => (
                  <option key={idx} value={s.name.trim()}>
                    {s.name.trim()}
                  </option>
                ))}
              {d.subject_name && !subjects.some((s) => s.name.trim() === d.subject_name) && (
                <option value={d.subject_name}>{d.subject_name}</option>
              )}
            </select>
            <Button variant="ghost" className="px-2 py-1" aria-label="Quitar fecha" onClick={() => setDates((l) => l.filter((_, idx) => idx !== i))}>
              ✕
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => setDates((l) => [...l, { date: '', kind: 'exam', title: '', subject_name: null }])}
        >
          + Agregar fecha
        </Button>
      </section>

      {(localError || save.isError) && <Alert>{localError ?? errorMessage(save.error)}</Alert>}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <p className="text-xs text-zinc-500">Guardar reemplaza tu horario y fechas actuales. Tus materias y apuntes se conservan.</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={save.isPending}>
            Guardar horario
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Vigencia del horario: sin fecha de fin, las clases se repetirían para siempre. */
function PeriodSection({
  startsOn,
  endsOn,
  onStart,
  onEnd,
}: {
  startsOn: string
  endsOn: string
  onStart: (v: string) => void
  onEnd: (v: string) => void
}) {
  const base = startsOn ? parseISODate(startsOn) : parseISODate(todayISO())
  const presets = [
    { label: '4 meses', days: 122 },
    { label: '6 meses', days: 183 },
    { label: '1 año', days: 365 },
  ]
  const endOfYear = `${base.getFullYear()}-12-31`
  return (
    <section className="flex flex-col gap-3" aria-label="Vigencia del horario">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Vigencia del horario</h2>
      <Card className="flex flex-col gap-3 p-4">
        <p className="text-sm text-zinc-500">
          Hasta cuándo valen estas clases (por ejemplo, el fin del cuatrimestre). Después de esa fecha dejan de aparecer en el
          calendario, en Hoy y en Google.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Desde</span>
            <input type="date" value={startsOn} max={endsOn || undefined} onChange={(e) => onStart(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Hasta</span>
            <input type="date" value={endsOn} min={startsOn || undefined} onChange={(e) => onEnd(e.target.value)} className={inputClass} />
          </label>
          {(startsOn || endsOn) && (
            <Button variant="ghost" className="px-2 py-1" onClick={() => { onStart(''); onEnd('') }}>
              Sin límite
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-500">Duración rápida:</span>
          {presets.map((p) => (
            <Button key={p.label} variant="secondary" className="px-2.5 py-1" onClick={() => onEnd(toISODate(addDays(base, p.days)))}>
              {p.label}
            </Button>
          ))}
          <Button variant="secondary" className="px-2.5 py-1" onClick={() => onEnd(endOfYear)}>
            Fin de año
          </Button>
        </div>
        {!endsOn && (
          <p className="text-xs text-amber-600 dark:text-amber-400">Sin fecha de fin: las clases se repiten para siempre.</p>
        )}
      </Card>
    </section>
  )
}
