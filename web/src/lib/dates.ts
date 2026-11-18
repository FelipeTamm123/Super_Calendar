import type { DateKind } from './types'

/** Días como los usa el backend: 0 = lunes ... 6 = domingo */
export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export const DATE_KIND_LABEL: Record<DateKind, string> = {
  exam: 'Examen',
  holiday: 'Feriado',
  deadline: 'Entrega',
  other: 'Otro',
}

/** Fecha local en formato YYYY-MM-DD (sin pasar por UTC, que puede correr el día). */
export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

/** "2026-11-18" -> Date local (no UTC). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const longFormat = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
const shortFormat = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })

/** "miércoles, 18 de noviembre" -> "Miércoles, 18 de noviembre" (solo la primera letra en mayúscula). */
export function formatLongDate(iso: string): string {
  const text = longFormat.format(parseISODate(iso))
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** "hoy", "mañana", "ayer" o "mié 18 nov". */
export function formatRelativeDate(iso: string, today = todayISO()): string {
  const diff = Math.round((parseISODate(iso).getTime() - parseISODate(today).getTime()) / 86_400_000)
  if (diff === 0) return 'hoy'
  if (diff === 1) return 'mañana'
  if (diff === -1) return 'ayer'
  return shortFormat.format(parseISODate(iso))
}

/** "08:30:00" -> "08:30" */
export function formatTime(t: string): string {
  return t.slice(0, 5)
}

export function isOverdue(iso: string, today = todayISO()): boolean {
  return iso < today
}

export const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + days)
  return out
}

/** Semanas (lunes a domingo) que cubren el mes. Incluye días del mes anterior/siguiente para completar. */
export function monthGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1)
  const start = addDays(first, -((first.getDay() + 6) % 7)) // lunes de la primera semana
  const last = new Date(year, month + 1, 0)
  const weeks: Date[][] = []
  for (let day = start; day <= last || weeks.length === 0; ) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(day)
      day = addDays(day, 1)
    }
    weeks.push(week)
    if (day > last) break
  }
  return weeks
}

/** Día de la semana con lunes = 0 (como el backend). */
export function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}
