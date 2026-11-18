import { describe, expect, it } from 'vitest'
import { formatRelativeDate, formatTime, isOverdue, mondayIndex, monthGrid, parseISODate, toISODate } from './dates'

describe('fechas', () => {
  it('parsea y formatea YYYY-MM-DD en hora local (sin correr el día por UTC)', () => {
    const d = parseISODate('2026-11-18')
    expect(d.getDate()).toBe(18)
    expect(toISODate(d)).toBe('2026-11-18')
  })

  it('fechas relativas', () => {
    expect(formatRelativeDate('2026-11-17', '2026-11-17')).toBe('hoy')
    expect(formatRelativeDate('2026-11-18', '2026-11-17')).toBe('mañana')
    expect(formatRelativeDate('2026-11-16', '2026-11-17')).toBe('ayer')
    expect(formatRelativeDate('2026-11-25', '2026-11-17')).toMatch(/25/)
  })

  it('atrasado y horas', () => {
    expect(isOverdue('2026-11-16', '2026-11-17')).toBe(true)
    expect(isOverdue('2026-11-17', '2026-11-17')).toBe(false)
    expect(formatTime('08:30:00')).toBe('08:30')
  })
})


describe('grilla del mes', () => {
  it('noviembre 2026 empieza el lunes 26 de octubre y tiene 6 semanas', () => {
    const weeks = monthGrid(2026, 10)
    expect(toISODate(weeks[0][0])).toBe('2026-10-26')
    expect(weeks).toHaveLength(6)
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    expect(toISODate(weeks.at(-1)!.at(-1)!)).toBe('2026-12-06')
  })

  it('febrero 2027 (empieza lunes) entra en 4 semanas', () => {
    const weeks = monthGrid(2027, 1)
    expect(toISODate(weeks[0][0])).toBe('2027-02-01')
    expect(weeks).toHaveLength(4)
  })

  it('lunes = 0', () => {
    expect(mondayIndex(parseISODate('2026-11-16'))).toBe(0)
    expect(mondayIndex(parseISODate('2026-11-22'))).toBe(6)
  })
})
