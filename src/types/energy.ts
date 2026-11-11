/** One building's consumption for one day (sum of its SMDB meters). */
export interface EnergyRecord {
  buildingId: string
  siteId: string
  date: string // ISO date
  kWh: number
  peakKw: number
  /** kWh used outside the site's opening hours that day. */
  afterHoursKwh: number
}

/** Kinds of special period on the operating calendar. */
export type PeriodType = 'holiday' | 'ramadan' | 'shutdown' | 'event'

/**
 * A period that changes how a site should use energy: UAE public holidays,
 * Ramadan (shorter hours), a planned shutdown or a special event.
 * siteId undefined = applies to every site.
 */
export interface CalendarPeriod {
  id: string
  name: string
  type: PeriodType
  start: string // ISO date, inclusive
  end: string // ISO date, inclusive
  siteId?: string
}

/** What a single day counts as for one site, after resolving periods and weekends. */
export type DayType = 'workday' | 'weekend' | 'holiday' | 'ramadan' | 'shutdown' | 'event'
