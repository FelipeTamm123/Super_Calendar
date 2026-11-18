/**
 * Calendario integrado. El diseño sigue el layout "Calendar Page" del tutorial de Tuts+
 * (barra superior azul, navegación de año y mes, fila de días, grilla de días grises con
 * números grandes, panel del día elegido con el número gigante y fila "Crear nueva entrada"),
 * recreado para web y con lo que el tutorial dejaba sin hacer: cuentas de mes reales,
 * día seleccionado, día de hoy y eventos.
 */
import { useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { JoinLink, ModalityBadge } from '../../components/modality'
import { QueryError, SubjectBadge } from '../../components/study'
import { Alert, Spinner } from '../../components/ui'
import { errorMessage } from '../../lib/api'
import { formatTime, MONTHS, monthGrid, parseISODate, toISODate, todayISO, WEEKDAYS, WEEKDAYS_SHORT } from '../../lib/dates'
import { useCalendarEvents, useCalendarSettings, useGoogleEvents, useUpdateQuestion, useUpdateTask } from '../../lib/queries'
import type { SyncResult } from '../../lib/types'
import { dotColor, groupByDay, KIND_LABEL, type DayItem } from './day-items'
import { CalendarIcon, ChevronLeft, ChevronRight, SyncIcon } from './icons'
import { NewEntryDialog } from './NewEntryDialog'
import { SyncPanel } from './SyncPanel'

// Color del encabezado y del día elegido: el azul de la marca (cambia con el tema claro/oscuro)
const BLUE = 'var(--brand-600)'

export function CalendarPage() {
  const location = useLocation()
  const justConnected = (location.state as { googleConnected?: SyncResult } | null)?.googleConnected
  const today = todayISO()
  const [selected, setSelected] = useState(today)
  const [view, setView] = useState(() => {
    const d = parseISODate(today)
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [creating, setCreating] = useState(false)
  const syncRef = useRef<HTMLDivElement>(null)

  const weeks = useMemo(() => monthGrid(view.year, view.month), [view])
  const from = toISODate(weeks[0][0])
  const to = toISODate(weeks.at(-1)!.at(-1)!)

  const events = useCalendarEvents(from, to)
  const settings = useCalendarSettings()
  const googleConnected = !!settings.data?.google.connected
  const google = useGoogleEvents(from, to, googleConnected)

  const byDay = useMemo(() => groupByDay(events.data ?? [], google.data ?? []), [events.data, google.data])
  const selectedItems = byDay.get(selected) ?? []
  const selectedDate = parseISODate(selected)

  const moveMonth = (delta: number) =>
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  const moveYear = (delta: number) => setView((v) => ({ ...v, year: v.year + delta }))
  const goToday = () => {
    const d = parseISODate(today)
    setView({ year: d.getFullYear(), month: d.getMonth() })
    setSelected(today)
  }
  const pick = (iso: string, d: Date) => {
    setSelected(iso)
    if (d.getMonth() !== view.month) setView({ year: d.getFullYear(), month: d.getMonth() })
  }

  return (
    <div className="flex flex-col gap-8">
      {justConnected && (
        <Alert tone="success">
          ¡Google Calendar conectado! Se crearon {justConnected.created} eventos en tu calendario «Super Calendar».
        </Alert>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {/* Barra superior (header del tutorial: ‹ Menu | Calendar | Today) */}
        <div className="grid grid-cols-3 items-center bg-navy-900 p-5 text-white dark:bg-navy-800">
          <button
            type="button"
            onClick={() => syncRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-1 justify-self-start text-base hover:opacity-80 sm:text-xl"
          >
            <SyncIcon size={20} />
            <span className="hidden sm:inline">Sincronizar</span>
          </button>
          <h1 className="text-center text-lg font-bold sm:text-xl">Calendario</h1>
          <button type="button" onClick={goToday} className="justify-self-end text-base hover:opacity-80 sm:text-xl">
            Hoy
          </button>
        </div>

        {/* Navegación de año y mes */}
        <div className="flex flex-col sm:flex-row">
          {[
            { label: String(view.year), prev: () => moveYear(-1), next: () => moveYear(1), name: 'año' },
            { label: MONTHS[view.month], prev: () => moveMonth(-1), next: () => moveMonth(1), name: 'mes' },
          ].map((nav) => (
            <div key={nav.name} className="flex flex-1 items-center justify-between px-10 pt-5 text-zinc-800 dark:text-zinc-200">
              <button type="button" onClick={nav.prev} className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label={`${nav.name} anterior`}>
                <ChevronLeft />
              </button>
              <span className="text-xl font-bold" aria-live="polite">
                {nav.label}
              </span>
              <button type="button" onClick={nav.next} className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label={`${nav.name} siguiente`}>
                <ChevronRight />
              </button>
            </div>
          ))}
        </div>

        {/* Días de la semana + grilla */}
        <div className="relative px-1 pt-4 pb-1 sm:px-2" role="grid" aria-label={`${MONTHS[view.month]} ${view.year}`}>
          {events.isFetching && (
            <Spinner className="absolute top-1 right-3 size-4 text-zinc-400" />
          )}
          <div className="mb-1 grid grid-cols-7" role="row">
            {WEEKDAYS_SHORT.map((d) => (
              <span key={d} role="columnheader" className="text-center text-xs font-medium uppercase text-zinc-400 sm:text-sm">
                {d}
              </span>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={toISODate(week[0])} className="grid grid-cols-7" role="row">
              {week.map((d) => {
                const iso = toISODate(d)
                const items = byDay.get(iso) ?? []
                const isSelected = iso === selected
                const isToday = iso === today
                const otherMonth = d.getMonth() !== view.month
                return (
                  <button
                    key={iso}
                    type="button"
                    role="gridcell"
                    aria-selected={isSelected}
                    aria-label={`${d.getDate()} de ${MONTHS[d.getMonth()]}${isToday ? ', hoy' : ''}${items.length ? `, ${items.length} eventos` : ''}`}
                    onClick={() => pick(iso, d)}
                    className={`m-0.5 flex min-h-14 flex-col items-center justify-center gap-1 rounded-md py-2 transition-colors sm:min-h-20 sm:py-4 ${
                      isSelected
                        ? 'text-white'
                        : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700'
                    } ${otherMonth && !isSelected ? 'opacity-40' : ''}`}
                    style={isSelected ? { backgroundColor: BLUE } : undefined}
                  >
                    <span
                      className={`text-lg leading-none sm:text-[25px] ${
                        isSelected ? 'font-bold' : isToday ? 'font-bold' : 'text-zinc-500 dark:text-zinc-400'
                      }`}
                      style={isToday && !isSelected ? { color: BLUE } : undefined}
                    >
                      {d.getDate()}
                    </span>
                    <span className="flex h-1.5 gap-0.5" aria-hidden="true">
                      {items.slice(0, 4).map((item, i) => (
                        <span
                          key={i}
                          className="size-1.5 rounded-full"
                          style={{ backgroundColor: isSelected ? '#fff' : dotColor(item) }}
                        />
                      ))}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Panel del día elegido (notes del tutorial) */}
        <div className="mt-2.5 flex gap-4 border-y border-zinc-100 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="min-w-0 flex-[3]">
            {events.isError ? (
              <QueryError error={events.error} onRetry={() => events.refetch()} />
            ) : selectedItems.length === 0 ? (
              <p className="text-lg text-zinc-500">Nada para este día.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {selectedItems.map((item) => (
                  <DayRow key={item.source + (item.source === 'app' ? item.event.key : item.event.id)} item={item} />
                ))}
              </ul>
            )}
            {google.isError && googleConnected && (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">No se pudieron leer tus eventos de Google: {errorMessage(google.error)}</p>
            )}
          </div>
          <div className="flex flex-1 flex-col items-end text-right">
            <span className="text-[15px] text-zinc-500">
              {selectedItems.length === 0 ? 'Sin eventos' : `${selectedItems.length} ${selectedItems.length === 1 ? 'evento' : 'eventos'}`}
            </span>
            <span className="text-[50px] leading-tight font-bold">{selectedDate.getDate()}</span>
            <span className="flex items-center gap-1 text-[15px] uppercase text-zinc-500">
              <CalendarIcon size={16} className="text-zinc-300 dark:text-zinc-600" />
              {WEEKDAYS[(selectedDate.getDay() + 6) % 7]}
            </span>
          </div>
        </div>

        {/* Crear nueva entrada (logs del tutorial) */}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex w-full items-center justify-between gap-3 p-5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        >
          <span>
            <span className="block text-xl sm:text-[25px]">Crear nueva entrada</span>
            <span className="block text-base text-zinc-500 sm:text-lg">
              El {WEEKDAYS[(selectedDate.getDay() + 6) % 7].toLowerCase()} {selectedDate.getDate()} de {MONTHS[selectedDate.getMonth()].toLowerCase()}
            </span>
          </span>
          <ChevronRight size={30} className="shrink-0 text-zinc-300 dark:text-zinc-600" />
        </button>
      </div>

      <div ref={syncRef} className="scroll-mt-24">
        <SyncPanel />
      </div>

      <NewEntryDialog open={creating} date={selected} onClose={() => setCreating(false)} />
    </div>
  )
}

function DayRow({ item }: { item: DayItem }) {
  const updateTask = useUpdateTask()
  const updateQuestion = useUpdateQuestion()

  if (item.source === 'google') {
    const g = item.event
    return (
      <li className="flex items-start gap-3">
        <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: dotColor(item) }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-lg">
            {g.html_link ? (
              <a href={g.html_link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {g.title}
              </a>
            ) : (
              g.title
            )}
          </p>
          <p className="text-sm text-zinc-500">
            Google Calendar · {g.all_day ? 'Todo el día' : `${formatTime(g.start_time!)}–${formatTime(g.end_time!)}`}
            {g.location && ` · ${g.location}`}
          </p>
        </div>
      </li>
    )
  }

  const e = item.event
  const checkable = (e.kind === 'task' || e.kind === 'question') && e.ref_id != null
  const toggle = () => {
    if (e.kind === 'task') updateTask.mutate({ id: e.ref_id!, done: !e.done })
    else updateQuestion.mutate({ id: e.ref_id!, resolved: !e.done })
  }

  return (
    <li className="flex items-start gap-3">
      {checkable ? (
        <input
          type="checkbox"
          checked={e.done}
          onChange={toggle}
          disabled={updateTask.isPending || updateQuestion.isPending}
          className="mt-1.5 size-4 shrink-0 cursor-pointer accent-brand-600"
          aria-label={`Marcar "${e.title}" como ${e.done ? 'pendiente' : 'hecho'}`}
        />
      ) : (
        <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: dotColor(item) }} aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className={`text-lg break-words ${e.done ? 'text-zinc-400 line-through' : ''}`}>{e.title}</p>
          {e.kind === 'class' && e.modality && <ModalityBadge modality={e.modality} />}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
          <span>{KIND_LABEL[e.kind]}</span>
          {e.start_time && (
            <span>
              {formatTime(e.start_time)}
              {e.end_time && `–${formatTime(e.end_time)}`}
            </span>
          )}
          {e.kind !== 'class' && e.subject_name && <SubjectBadge name={e.subject_name} color={e.subject_color} />}
          {e.kind === 'class' && e.modality !== 'virtual' && e.location && <span>{e.location}</span>}
          {e.kind === 'class' && <JoinLink url={e.meeting_url} subject={e.title} compact />}
        </div>
        {(updateTask.isError || updateQuestion.isError) && (
          <p role="alert" className="text-sm text-red-600">
            {errorMessage(updateTask.error ?? updateQuestion.error)}
          </p>
        )}
      </div>
    </li>
  )
}
