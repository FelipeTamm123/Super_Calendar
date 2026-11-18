import { addDays, parseISODate, toISODate } from '../../lib/dates'
import type { CalendarEvent, CalendarEventKind, GoogleEvent } from '../../lib/types'

/** Un ítem del día: un evento de la app o un evento leído de Google. */
export type DayItem =
  | { source: 'app'; event: CalendarEvent }
  | { source: 'google'; event: GoogleEvent }

export const KIND_LABEL: Record<CalendarEventKind, string> = {
  class: 'Clase',
  exam: 'Examen',
  holiday: 'Feriado',
  deadline: 'Entrega',
  other: 'Fecha',
  task: 'Repaso',
  question: 'Pregunta',
}

/** Color del puntito de cada tipo en la grilla. */
export function dotColor(item: DayItem): string {
  if (item.source === 'google') return '#9ca3af'
  const e = item.event
  switch (e.kind) {
    case 'exam':
      return '#ef4444'
    case 'holiday':
      return '#a855f7'
    case 'deadline':
      return '#f97316'
    case 'task':
      return '#10b981'
    case 'question':
      return '#f59e0b'
    default:
      return e.subject_color ?? '#329BCB'
  }
}

/** Agrupa todo por día (YYYY-MM-DD). Los eventos de Google de varios días aparecen en cada día. */
export function groupByDay(events: CalendarEvent[], google: GoogleEvent[]): Map<string, DayItem[]> {
  const map = new Map<string, DayItem[]>()
  const push = (day: string, item: DayItem) => map.set(day, [...(map.get(day) ?? []), item])
  for (const e of events) push(e.date, { source: 'app', event: e })
  for (const g of google) {
    let d = parseISODate(g.date)
    const end = parseISODate(g.end_date)
    for (let i = 0; d <= end && i < 62; i++, d = addDays(d, 1)) push(toISODate(d), { source: 'google', event: g })
  }
  for (const [day, items] of map) {
    map.set(day, items.sort((a, b) => (a.event.start_time ?? '').localeCompare(b.event.start_time ?? '')))
  }
  return map
}
