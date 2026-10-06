import { describe, expect, it } from 'vitest'

import { agendaFor, cycleWindows, isScheduledOn, phaseOn, reviewDates, weekdayOf, type ScheduleInput } from '@/lib/schedule'

// Rhodiola · Cultivo: doce semanas de uso y cuatro de pausa/revisión.
const cultivo: ScheduleInput = { startDate: '2026-10-06', useWeeks: 12, pauseWeeks: 4, scheduleType: 'daily', status: 'active' }

describe('ciclos', () => {
  it('calcula ventanas de uso y pausa con días incluidos', () => {
    expect(cycleWindows(cultivo)).toEqual({
      useStart: '2026-10-06',
      useLastDay: '2026-12-28',
      pauseStart: '2026-12-29',
      pauseLastDay: '2027-01-25',
      pauseIsMinimum: false,
    })
  })

  it('distingue las fases', () => {
    expect(phaseOn(cultivo, '2026-10-05')).toBe('before-start')
    expect(phaseOn(cultivo, '2026-10-06')).toBe('use')
    expect(phaseOn(cultivo, '2026-12-28')).toBe('use')
    expect(phaseOn(cultivo, '2026-12-29')).toBe('pause')
    expect(phaseOn(cultivo, '2027-01-25')).toBe('pause')
    expect(phaseOn(cultivo, '2027-01-26')).toBe('after-cycle')
  })

  it('no renueva automáticamente al terminar la pausa', () => {
    expect(isScheduledOn(cultivo, '2027-01-26')).toBe(false)
    expect(isScheduledOn(cultivo, '2027-06-01')).toBe(false)
  })

  it('revisa al terminar el uso y al terminar la pausa', () => {
    expect(reviewDates(cultivo)).toEqual([
      { date: '2026-12-29', kind: 'end-of-use' },
      { date: '2027-01-26', kind: 'end-of-pause' },
    ])
  })

  it('Río: uso continuo con revisión cada doce semanas', () => {
    const rio: ScheduleInput = { startDate: '2026-10-06', continuous: true, reviewEveryWeeks: 12, scheduleType: 'daily' }
    expect(phaseOn(rio, '2030-01-01')).toBe('use')
    expect(reviewDates(rio, '2027-06-30')).toEqual([
      { date: '2026-12-29', kind: 'periodic' },
      { date: '2027-03-23', kind: 'periodic' },
      { date: '2027-06-15', kind: 'periodic' },
    ])
  })

  it('Cosecha: la pausa mínima se marca como tal', () => {
    const cosecha = cycleWindows({ startDate: '2026-10-06', useWeeks: 12, pauseWeeks: 12, pauseIsMinimum: true })
    expect(cosecha.pauseIsMinimum).toBe(true)
    expect(cosecha.pauseLastDay).toBe('2027-03-22')
  })
})

describe('tomas programadas', () => {
  it('una pausa temporal no alarga el ciclo', () => {
    const paused: ScheduleInput = { ...cultivo, pauses: [{ from: '2026-11-01', to: '2026-11-07' }] }
    expect(isScheduledOn(paused, '2026-11-03')).toBe(false)
    expect(isScheduledOn(paused, '2026-11-08')).toBe(true)
    expect(cycleWindows(paused).useLastDay).toBe('2026-12-28')
    expect(isScheduledOn(paused, '2026-12-29')).toBe(false)
  })

  it('una interrupción detiene las tomas desde esa fecha y conserva el historial anterior', () => {
    const interrupted: ScheduleInput = { ...cultivo, status: 'interrupted', endedOn: '2026-11-15' }
    expect(isScheduledOn(interrupted, '2026-11-14')).toBe(true)
    expect(isScheduledOn(interrupted, '2026-11-15')).toBe(false)
  })

  it('días de la semana', () => {
    const mwf: ScheduleInput = { ...cultivo, scheduleType: 'weekdays', weekdays: ['mon', 'wed', 'fri'] }
    expect(weekdayOf('2026-10-06')).toBe('tue')
    expect(isScheduledOn(mwf, '2026-10-06')).toBe(false)
    expect(isScheduledOn(mwf, '2026-10-07')).toBe(true)
  })

  it('el uso selectivo no programa tomas, pero está disponible durante el uso', () => {
    const selective = { ...cultivo, scheduleType: 'selective' as const }
    expect(isScheduledOn(selective, '2026-10-10')).toBe(false)
    expect(agendaFor([selective], '2026-10-10')).toEqual([{ item: selective, scheduled: false, selectiveAvailable: true }])
    expect(agendaFor([selective], '2027-01-01')).toEqual([])
  })
})
