import type { CalendarPeriod, DayType, PeriodType, Site } from '../types'
import { toISODate } from './dates'

/** When periods overlap, the higher number wins (a shutdown beats a holiday, etc.). */
const PRIORITY: Record<PeriodType, number> = {
  shutdown: 4,
  holiday: 3,
  event: 2,
  ramadan: 1,
}

/** The UAE working week is Mon–Fri; the weekend is Saturday + Sunday. */
export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

/**
 * Classify a day for one site. Shutdowns and public holidays beat weekends;
 * a weekend beats Ramadan / events for sites that close at weekends.
 */
export function resolveDayType(date: Date, site: Site, periods: CalendarPeriod[]): DayType {
  const iso = toISODate(date)
  let best: PeriodType | null = null
  for (const period of periods) {
    if (period.siteId && period.siteId !== site.id) continue
    if (iso < period.start || iso > period.end) continue
    if (best === null || PRIORITY[period.type] > PRIORITY[best]) best = period.type
  }
  if (best === 'shutdown' || best === 'holiday') return best
  if (isWeekend(date) && !site.openWeekends) return 'weekend'
  return best ?? 'workday'
}

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  workday: 'Normal operating day',
  weekend: 'Weekend (closed)',
  holiday: 'Public holiday',
  ramadan: 'Ramadan hours',
  shutdown: 'Planned shutdown',
  event: 'Special event / late opening',
}

export const PERIOD_TYPE_LABELS: Record<PeriodType, string> = {
  holiday: 'Public holiday',
  ramadan: 'Ramadan',
  shutdown: 'Planned shutdown',
  event: 'Special event',
}

/** Colours for calendar bands (charts) and badges. */
export const DAY_TYPE_COLORS: Record<DayType, string> = {
  workday: '#c3d1e8',
  weekend: '#e2e8f0',
  holiday: '#fecaca',
  ramadan: '#fde68a',
  shutdown: '#cbd5e1',
  event: '#99f6e4',
}
