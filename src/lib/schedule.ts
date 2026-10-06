/**
 * Motor de calendario y ciclos. Funciones puras sobre fechas ISO (AAAA-MM-DD)
 * en UTC para evitar desfases por zona horaria.
 *
 * Reglas (Libro 2, n.º 22–25):
 * - el ciclo tiene fechas fijas desde el inicio; una pausa temporal o una
 *   omisión no lo alargan ni lo reinician;
 * - al terminar la pausa no se programa nada más: no hay renovación automática;
 * - el uso selectivo no genera tomas programadas, solo disponibilidad.
 */

export type ISODate = string

export type Weekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export interface CycleInput {
  startDate: ISODate
  continuous?: boolean | null
  useWeeks?: number | null
  pauseWeeks?: number | null
  reviewEveryWeeks?: number | null
  pauseIsMinimum?: boolean | null
}

export interface ScheduleInput extends CycleInput {
  scheduleType: 'daily' | 'weekdays' | 'selective'
  weekdays?: Weekday[] | null
  status?: 'active' | 'paused' | 'interrupted' | 'ended' | null
  pauses?: Array<{ from: ISODate; to?: ISODate | null }> | null
  endedOn?: ISODate | null
}

export type ReviewKind = 'periodic' | 'end-of-use' | 'end-of-pause'

export interface CycleWindows {
  useStart: ISODate
  /** Último día de uso (incluido). `null` en uso continuo. */
  useLastDay: ISODate | null
  pauseStart: ISODate | null
  /** Último día de pausa (incluido). */
  pauseLastDay: ISODate | null
  /** En Cosecha la pausa es un mínimo: esta fecha es «a partir de cuándo reconsiderar». */
  pauseIsMinimum: boolean
}

export type Phase = 'before-start' | 'use' | 'pause' | 'after-cycle'

// ---------------------------------------------------------------- fechas

const toDate = (iso: ISODate) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const toISO = (date: Date): ISODate => date.toISOString().slice(0, 10)

export const addDays = (iso: ISODate, days: number): ISODate => {
  const date = toDate(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return toISO(date)
}

export const weekdayOf = (iso: ISODate): Weekday => WEEKDAYS[toDate(iso).getUTCDay()]

/** Comparación de fechas ISO: el orden lexicográfico coincide con el cronológico. */
const inRange = (date: ISODate, from: ISODate, to: ISODate | null | undefined) => date >= from && (to == null || date <= to)

// ---------------------------------------------------------------- ciclo

export function cycleWindows(input: CycleInput): CycleWindows {
  const { startDate } = input
  if (input.continuous) {
    return { useStart: startDate, useLastDay: null, pauseStart: null, pauseLastDay: null, pauseIsMinimum: false }
  }
  if (input.useWeeks == null || input.pauseWeeks == null) {
    throw new Error('Un ciclo no continuo necesita semanas de uso y de pausa.')
  }
  const useLastDay = addDays(startDate, input.useWeeks * 7 - 1)
  const pauseStart = addDays(useLastDay, 1)
  const pauseLastDay = input.pauseWeeks > 0 ? addDays(pauseStart, input.pauseWeeks * 7 - 1) : null
  return {
    useStart: startDate,
    useLastDay,
    pauseStart: input.pauseWeeks > 0 ? pauseStart : null,
    pauseLastDay,
    pauseIsMinimum: !!input.pauseIsMinimum,
  }
}

export function phaseOn(input: CycleInput, date: ISODate): Phase {
  const w = cycleWindows(input)
  if (date < w.useStart) return 'before-start'
  if (w.useLastDay == null || date <= w.useLastDay) return 'use'
  if (w.pauseStart && w.pauseLastDay && inRange(date, w.pauseStart, w.pauseLastDay)) return 'pause'
  return 'after-cycle'
}

/**
 * Fechas de revisión del ciclo. En uso continuo, una revisión cada N semanas
 * hasta `horizon` (incluido). En ciclos con pausa: al terminar el uso y al
 * terminar la pausa (o, si la pausa es mínima, el primer día para reconsiderar).
 */
export function reviewDates(input: CycleInput, horizon?: ISODate): Array<{ date: ISODate; kind: ReviewKind }> {
  const w = cycleWindows(input)
  if (input.continuous) {
    if (!input.reviewEveryWeeks) throw new Error('El uso continuo necesita un intervalo de revisión.')
    if (!horizon) throw new Error('El uso continuo necesita un horizonte para listar revisiones.')
    const out: Array<{ date: ISODate; kind: ReviewKind }> = []
    for (let k = 1; ; k++) {
      const date = addDays(w.useStart, k * input.reviewEveryWeeks * 7)
      if (date > horizon) break
      out.push({ date, kind: 'periodic' })
    }
    return out
  }
  const out: Array<{ date: ISODate; kind: ReviewKind }> = [{ date: addDays(w.useLastDay!, 1), kind: 'end-of-use' }]
  if (w.pauseLastDay) out.push({ date: addDays(w.pauseLastDay, 1), kind: 'end-of-pause' })
  return out
}

// ---------------------------------------------------------------- tomas

/** ¿Está la línea dentro de su periodo de uso y no detenida en esa fecha? */
export function isInUse(item: ScheduleInput, date: ISODate): boolean {
  if (phaseOn(item, date) !== 'use') return false
  if ((item.status === 'interrupted' || item.status === 'ended') && (!item.endedOn || date >= item.endedOn)) return false
  if (item.pauses?.some((p) => inRange(date, p.from, p.to))) return false
  if (item.status === 'paused' && !item.pauses?.length) return false
  return true
}

/** ¿Hay una toma programada ese día? El uso selectivo nunca genera una toma programada. */
export function isScheduledOn(item: ScheduleInput, date: ISODate): boolean {
  if (!isInUse(item, date)) return false
  switch (item.scheduleType) {
    case 'daily':
      return true
    case 'weekdays':
      return !!item.weekdays?.includes(weekdayOf(date))
    case 'selective':
      return false
  }
}

export interface AgendaEntry<T> {
  item: T
  /** Toma programada para ese día. */
  scheduled: boolean
  /** Uso selectivo disponible ese día (si se da la circunstancia definida). */
  selectiveAvailable: boolean
}

/** Agenda de un día: líneas programadas y líneas de uso selectivo disponibles. */
export function agendaFor<T extends ScheduleInput>(items: T[], date: ISODate): AgendaEntry<T>[] {
  return items
    .map((item) => ({
      item,
      scheduled: isScheduledOn(item, date),
      selectiveAvailable: item.scheduleType === 'selective' && isInUse(item, date),
    }))
    .filter((e) => e.scheduled || e.selectiveAvailable)
}
