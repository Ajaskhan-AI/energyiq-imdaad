import { getBuilding, getSite } from '../data/sites'
import { resolveDayType } from '../lib/calendar'
import type { CalendarPeriod, DayType, LoadType, Site, SiteType, Smdb } from '../types'

/**
 * The one load model behind every number in the demo: live SMDB readings,
 * the 24 h trend and the 12-month energy history all come from here.
 *
 *   board kW = board peak × (base + (1 − base) × activity) × climate
 *
 * - activity (0–1): how busy the site is at that hour, from the site type,
 *   its opening hours and the operating calendar (weekend, holiday, Ramadan…)
 * - base: the share of the load that never switches off (lifts, lighting,
 *   refrigeration…), depends on what the board feeds
 * - climate: Dubai cooling demand by month, much stronger on HVAC boards
 */

/** Cooling demand multiplier by month (Jan … Dec) for the Dubai climate. */
export const COOLING = [0.72, 0.76, 0.87, 1.0, 1.2, 1.36, 1.45, 1.48, 1.35, 1.15, 0.94, 0.78]

/** Share of a board's load that stays on when the site is empty. */
const BASE: Record<LoadType, number> = {
  hvac: 0.28,
  lighting_power: 0.12,
  tenant: 0.12,
  common: 0.45,
  carpark: 0.4,
  kitchen: 0.06,
  critical: 0.85,
}

/** Is `hour` inside opening hours (handles 24/7 and closing after midnight)? */
function isOpen(site: Site, hour: number, extraHours = 0): boolean {
  const close = site.closeHour + extraHours
  if (site.openHour === 0 && site.closeHour >= 24) return true
  if (close <= 24) return hour >= site.openHour && hour < close
  return hour >= site.openHour || hour < close - 24
}

/** Hourly activity for a site type on a given kind of day (0 = empty, 1 = full). */
export function siteActivity(site: Site, dayType: DayType, hour: number): number {
  const h = Math.floor(hour)
  const type: SiteType = site.type
  if (dayType === 'shutdown') return type === 'residential' || type === 'healthcare' ? 0.6 : 0.03

  switch (type) {
    case 'office': {
      if (dayType === 'weekend' || dayType === 'holiday') return 0.06
      const close = dayType === 'ramadan' ? 15 : site.closeHour
      if (h === site.openHour - 1) return 0.5 // pre-cooling / arrivals
      if (h >= site.openHour && h < close) return 1
      if (h >= close && h < close + 2) return 0.4 // late workers, cleaners
      return 0.04
    }
    case 'warehouse': {
      if (dayType === 'weekend') return 0.25 // a skeleton shift on Saturdays
      if (dayType === 'holiday') return 0.12
      return isOpen(site, h) ? 1 : 0.1
    }
    case 'mall': {
      const extra = dayType === 'event' || dayType === 'ramadan' ? 1 : 0 // late opening
      if (isOpen(site, h, extra)) return dayType === 'holiday' || dayType === 'event' ? 1 : 0.92
      if (h === site.openHour - 1) return 0.45 // staff & cleaning before opening
      return 0.05
    }
    case 'residential': {
      const busy = dayType === 'weekend' || dayType === 'holiday'
      if (h < 6) return 0.5
      if (h < 9) return 0.78
      if (h < 17) return busy ? 0.8 : 0.6
      if (h < 24) return dayType === 'ramadan' && h >= 18 ? 1 : 0.95
      return 0.5
    }
    case 'healthcare': {
      const day = isOpen(site, h)
      if (dayType === 'weekend' || dayType === 'holiday') return day ? 0.7 : 0.45
      return day ? 1 : 0.45
    }
  }
}

/**
 * Hidden waste patterns for Energy Analytics to find (the "story" of the demo):
 * boards that keep running when the site is empty. Returns a raised activity, or null.
 */
const WASTE: Array<{ smdbId: string; when: (dayType: DayType, hour: number, site: Site) => boolean; activity: number }> = [
  // Business Tower: HVAC plant left on schedule "occupied" at weekends and on holidays.
  { smdbId: 'SMDB-HBT-B1-01', when: (d, h) => (d === 'weekend' || d === 'holiday') && h >= 7 && h < 20, activity: 0.85 },
  // Community Mall: common-area lighting and car park left on all night after closing.
  { smdbId: 'SMDB-ANM-B1-04', when: (_d, h, site) => !isOpen(site, h) && h !== site.openHour - 1, activity: 0.9 },
  // Logistics Hub office block: HVAC never switched off (24/7, every day).
  { smdbId: 'SMDB-DLH-B2-01', when: (_d, h, site) => !isOpen(site, h) || _d === 'weekend' || _d === 'holiday', activity: 0.75 },
]

export function boardPeakKw(smdb: Smdb): number {
  return (getBuilding(smdb.buildingId)?.baseLoadKw ?? 150) * smdb.loadShare
}

/** Expected kW for a board at a moment in time (before random noise). */
export function expectedKw(smdb: Smdb, at: Date, calendar: CalendarPeriod[]): number {
  const site = getSite(smdb.siteId)
  if (!site) return 0
  const dayType = resolveDayType(at, site, calendar)
  const hour = at.getHours() + at.getMinutes() / 60
  return kwFor(smdb, site, dayType, hour, at.getMonth())
}

/**
 * Same model with the day type already known (used by the history generator, which is hot).
 * withWaste = false gives the "expected" behaviour used as the analytics baseline.
 */
export function kwFor(smdb: Smdb, site: Site, dayType: DayType, hour: number, month: number, withWaste = true): number {
  let activity = siteActivity(site, dayType, hour)
  if (withWaste) {
    const waste = WASTE.find((w) => w.smdbId === smdb.id && w.when(dayType, Math.floor(hour), site))
    if (waste) activity = Math.max(activity, waste.activity)
  }

  // Kitchens and tenant boards follow activity closely; HVAC lags a bit (thermal mass).
  const base = BASE[smdb.loadType]
  const cooling = COOLING[month] / 1.48
  const climate = smdb.loadType === 'hvac' ? 0.45 + 0.55 * cooling : 0.88 + 0.12 * cooling
  // Afternoon heat bump on HVAC boards.
  const afternoon = smdb.loadType === 'hvac' && hour >= 12 && hour < 17 ? 1.08 : 1
  return boardPeakKw(smdb) * (base + (1 - base) * activity) * climate * afternoon * (STRESS[smdb.id] ?? 1)
}

/** A couple of boards run close to their limits, so the demo always has something to show. */
const STRESS: Record<string, number> = {
  // Mall HVAC: ~83% of its breaker rating in the afternoon heat → "High load" warning.
  'SMDB-ANM-B1-01': 1.45,
}

/** Is this hour outside the site's normal opening hours (for after-hours analysis)? */
export function isAfterHours(site: Site, dayType: DayType, hour: number): boolean {
  if (site.openHour === 0 && site.closeHour >= 24) return false
  if (dayType === 'shutdown') return true
  // Offices and warehouses are closed all day at weekends and on holidays; malls etc. keep normal hours.
  if (!site.openWeekends && (dayType === 'weekend' || dayType === 'holiday')) return true
  return !isOpen(site, hour, dayType === 'event' || (site.type === 'mall' && dayType === 'ramadan') ? 1 : 0)
}
