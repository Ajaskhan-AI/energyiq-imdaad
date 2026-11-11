import type { CalendarPeriod } from '../types'

/**
 * Indicative UAE operating calendar: public holidays, Ramadan and a few
 * site-specific periods. Islamic dates are approximate (moon sighting).
 * Weekends (Sat–Sun) are worked out automatically, so they are not listed.
 * The FM team can edit this in Energy Analytics → Calendar.
 */
export const SEED_CALENDAR: CalendarPeriod[] = [
  { id: 'cal-01', name: 'Commemoration Day & National Day', type: 'holiday', start: '2025-12-01', end: '2025-12-03' },
  { id: 'cal-02', name: 'Dubai Shopping Festival (late opening)', type: 'event', start: '2025-12-05', end: '2026-01-11', siteId: 'ANM' },
  { id: 'cal-03', name: 'New Year’s Day', type: 'holiday', start: '2026-01-01', end: '2026-01-01' },
  { id: 'cal-04', name: 'Ramadan 2026', type: 'ramadan', start: '2026-02-18', end: '2026-03-19' },
  { id: 'cal-05', name: 'Eid Al Fitr', type: 'holiday', start: '2026-03-20', end: '2026-03-22' },
  { id: 'cal-06', name: 'Warehouse A annual cold-store defrost & maintenance', type: 'shutdown', start: '2026-04-12', end: '2026-04-13', siteId: 'DLH' },
  { id: 'cal-07', name: 'Arafat Day & Eid Al Adha', type: 'holiday', start: '2026-05-26', end: '2026-05-29' },
  { id: 'cal-08', name: 'Islamic New Year', type: 'holiday', start: '2026-06-16', end: '2026-06-16' },
  { id: 'cal-09', name: 'Prophet’s Birthday', type: 'holiday', start: '2026-08-25', end: '2026-08-25' },
  { id: 'cal-10', name: 'Business Tower chiller plant overhaul (partial shutdown)', type: 'shutdown', start: '2026-09-19', end: '2026-09-20', siteId: 'HBT' },
  { id: 'cal-11', name: 'Commemoration Day & National Day', type: 'holiday', start: '2026-12-01', end: '2026-12-03' },
  { id: 'cal-12', name: 'Dubai Shopping Festival (late opening)', type: 'event', start: '2026-12-04', end: '2027-01-10', siteId: 'ANM' },
]
