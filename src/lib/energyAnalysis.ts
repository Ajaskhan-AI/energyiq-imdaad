import type { SmdbDay } from '../data/energy'
import { getSite } from '../data/sites'
import { getSmdb, LOAD_TYPE_LABELS } from '../data/smdbs'
import { isAfterHours, kwFor } from '../sim/loadModel'
import type { CalendarPeriod, DayType, Site } from '../types'
import { DAY_TYPE_LABELS, resolveDayType } from './calendar'
import { fromISODate } from './dates'
import { MARGINAL_AED_PER_KWH } from './tariff'

/**
 * Energy waste detection: "does each board's energy use match the site's
 * opening hours and calendar?"
 *
 * For every board and day we work out an EXPECTED consumption: the board's
 * normal behaviour for that site type, opening hours and day type (weekend,
 * public holiday, Ramadan hours, shutdown…), adjusted for the month's cooling
 * demand. The day type comes from the EDITABLE operating calendar, so editing
 * the calendar recalculates every flag.
 *
 * Two kinds of waste are flagged:
 * 1. low_occupancy_day: a closed / quiet day (weekend, holiday, shutdown) that
 *    uses much more than expected, e.g. HVAC left on all weekend
 * 2. after_hours: on an open day, consumption outside opening hours is much
 *    higher than the expected base load, e.g. lights left on all night
 *
 * Flags on the same board with the same cause are grouped into a recurring
 * "pattern", which is what the FM team acts on.
 */

export type WasteKind = 'low_occupancy_day' | 'after_hours'

export const WASTE_KIND_LABELS: Record<WasteKind, string> = {
  low_occupancy_day: 'High use on closed / quiet days',
  after_hours: 'High after-hours consumption',
}

/** Flag when actual is this much above expected. */
const DAY_RATIO = 1.25
const AFTER_HOURS_RATIO = 1.4
/** Ignore tiny excesses (kWh per board per day). */
const MIN_EXCESS_KWH = 40

export interface WasteFlag {
  id: string // `${smdbId}:${date}:${kind}`
  patternId: string // `${smdbId}:${kind}`
  kind: WasteKind
  smdbId: string
  buildingId: string
  siteId: string
  date: string
  dayType: DayType
  actualKwh: number
  expectedKwh: number
  excessKwh: number
  excessPct: number
  aed: number
  hint: string
}

export interface WastePattern {
  id: string // `${smdbId}:${kind}`
  kind: WasteKind
  smdbId: string
  buildingId: string
  siteId: string
  flags: WasteFlag[]
  days: number
  excessKwh: number
  aed: number
  avgExcessPct: number
  firstDate: string
  lastDate: string
  /** Excess per year if the pattern continues (from the flags in the analysed window). */
  annualAed: number
  annualKwh: number
  title: string
  hint: string
}

export interface EnergyAnalysis {
  /** Day type per `${siteId}:${date}` (from the editable calendar). */
  dayTypes: Map<string, DayType>
  /** Expected kWh per `${smdbId}:${date}`. */
  expected: Map<string, number>
  flags: WasteFlag[]
  patterns: WastePattern[]
}

/** Expected daily kWh and after-hours kWh for one board on one day (no waste in the model). */
function expectedDay(smdbId: string, site: Site, dayType: DayType, month: number): { kWh: number; afterHours: number } {
  const smdb = getSmdb(smdbId)
  if (!smdb) return { kWh: 0, afterHours: 0 }
  let kWh = 0
  let afterHours = 0
  for (let hour = 0; hour < 24; hour++) {
    const kw = kwFor(smdb, site, dayType, hour + 0.5, month, false)
    kWh += kw
    if (isAfterHours(site, dayType, hour)) afterHours += kw
  }
  return { kWh, afterHours }
}

const QUIET_DAYS: DayType[] = ['weekend', 'holiday', 'shutdown']
const CLOSED_DAY_WORDS: Partial<Record<DayType, string>> = { weekend: 'weekends', holiday: 'public holidays', shutdown: 'planned shutdown days' }

export function analyseEnergy(boardDays: SmdbDay[], calendar: CalendarPeriod[], days: number): EnergyAnalysis {
  const dayTypes = new Map<string, DayType>()
  const expected = new Map<string, number>()
  const flags: WasteFlag[] = []
  // Expected values only depend on (board, day type, month): cache them.
  const cache = new Map<string, { kWh: number; afterHours: number }>()

  for (const r of boardDays) {
    const site = getSite(r.siteId)
    if (!site) continue
    const dtKey = `${r.siteId}:${r.date}`
    let dayType = dayTypes.get(dtKey)
    const date = fromISODate(r.date)
    if (!dayType) {
      dayType = resolveDayType(date, site, calendar)
      dayTypes.set(dtKey, dayType)
    }
    const month = date.getMonth()
    const cKey = `${r.smdbId}:${dayType}:${month}`
    let exp = cache.get(cKey)
    if (!exp) {
      exp = expectedDay(r.smdbId, site, dayType, month)
      cache.set(cKey, exp)
    }
    expected.set(`${r.smdbId}:${r.date}`, exp.kWh)

    const base = { smdbId: r.smdbId, buildingId: r.buildingId, siteId: r.siteId, date: r.date, dayType }
    // Closed days: shutdowns everywhere; weekends and holidays only for sites that close then (offices, warehouses).
    const quiet = dayType === 'shutdown' || (!site.openWeekends && QUIET_DAYS.includes(dayType))
    if (quiet) {
      // 1. A quiet day using much more than a quiet day should.
      const excess = r.kWh - exp.kWh
      if (r.kWh > exp.kWh * DAY_RATIO && excess > MIN_EXCESS_KWH) {
        flags.push(makeFlag(base, 'low_occupancy_day', r.kWh, exp.kWh))
      }
    } else if (exp.afterHours > 0) {
      // 2. An open day with a high load outside opening hours.
      const excess = r.afterHoursKwh - exp.afterHours
      if (r.afterHoursKwh > exp.afterHours * AFTER_HOURS_RATIO && excess > MIN_EXCESS_KWH) {
        flags.push(makeFlag(base, 'after_hours', r.afterHoursKwh, exp.afterHours))
      }
    }
  }
  flags.sort((a, b) => b.date.localeCompare(a.date) || b.excessKwh - a.excessKwh)
  return { dayTypes, expected, flags, patterns: groupPatterns(flags, days) }
}

function makeFlag(
  base: Pick<WasteFlag, 'smdbId' | 'buildingId' | 'siteId' | 'date' | 'dayType'>,
  kind: WasteKind,
  actual: number,
  expected: number,
): WasteFlag {
  const excess = actual - expected
  const pct = Math.round((excess / expected) * 100)
  const smdb = getSmdb(base.smdbId)
  const what = smdb ? `${LOAD_TYPE_LABELS[smdb.loadType]} board` : 'This board'
  const hint =
    kind === 'low_occupancy_day'
      ? `${what}: on ${CLOSED_DAY_WORDS[base.dayType] ?? DAY_TYPE_LABELS[base.dayType].toLowerCase()} it used ${Math.round((actual / expected) * 100)}% of its expected energy.`
      : `${what}: outside opening hours it stayed at ${(actual / expected).toFixed(1)}× its expected base load.`
  return {
    ...base,
    id: `${base.smdbId}:${base.date}:${kind}`,
    patternId: `${base.smdbId}:${kind}`,
    kind,
    actualKwh: Math.round(actual),
    expectedKwh: Math.round(expected),
    excessKwh: Math.round(excess),
    excessPct: pct,
    aed: Math.round(excess * MARGINAL_AED_PER_KWH),
    hint,
  }
}

export interface DayTypeRow {
  dayType: DayType
  days: number
  avgKwhPerDay: number
  /** Compared with a normal day of the SAME sites (null for normal days). */
  vsWorkdayPct: number | null
}

/**
 * Average consumption per day for each day type. Sites differ (a weekend is a
 * normal day for a mall but a closed day for an office), so each day type is
 * compared with normal days of the same sites only.
 */
export function dayTypeAverages(records: Array<{ siteId: string; date: string; kWh: number }>, dayTypes: Map<string, DayType>): DayTypeRow[] {
  // kWh and dates per (day type, site)
  const agg = new Map<DayType, Map<string, { kWh: number; dates: Set<string> }>>()
  for (const r of records) {
    const type = dayTypes.get(`${r.siteId}:${r.date}`) ?? 'workday'
    const bySite = agg.get(type) ?? new Map<string, { kWh: number; dates: Set<string> }>()
    const a = bySite.get(r.siteId) ?? { kWh: 0, dates: new Set<string>() }
    a.kWh += r.kWh
    a.dates.add(r.date)
    bySite.set(r.siteId, a)
    agg.set(type, bySite)
  }
  const workday = agg.get('workday')
  const rows: DayTypeRow[] = []
  for (const [dayType, bySite] of agg) {
    const sites = [...bySite.keys()]
    const kWh = sites.reduce((s, id) => s + (bySite.get(id)?.kWh ?? 0), 0)
    const dates = new Set(sites.flatMap((id) => [...(bySite.get(id)?.dates ?? [])]))
    const avg = kWh / Math.max(1, dates.size)
    let vs: number | null = null
    if (dayType !== 'workday' && workday) {
      // The same sites' normal-day average, summed per site.
      const base = sites.reduce((s, id) => {
        const w = workday.get(id)
        return s + (w ? w.kWh / w.dates.size : 0)
      }, 0)
      // Average of this day type per site, summed, for a like-for-like ratio.
      const mine = sites.reduce((s, id) => {
        const m = bySite.get(id)
        return s + (m && workday.has(id) ? m.kWh / m.dates.size : 0)
      }, 0)
      vs = base ? Math.round((mine / base) * 100) : null
    }
    rows.push({ dayType, days: dates.size, avgKwhPerDay: avg, vsWorkdayPct: vs })
  }
  return rows.sort((a, b) => b.avgKwhPerDay - a.avgKwhPerDay)
}

const PATTERN_TITLES: Record<string, (smdbName: string) => string> = {
  hvac_low_occupancy_day: (n) => `HVAC running on closed days — ${n}`,
  hvac_after_hours: (n) => `HVAC running outside opening hours — ${n}`,
  common_after_hours: (n) => `Common-area lighting / ventilation on overnight — ${n}`,
}

/** Group flags into recurring patterns per board + cause. */
export function groupPatterns(flags: WasteFlag[], windowDays: number): WastePattern[] {
  const groups = new Map<string, WasteFlag[]>()
  for (const f of flags) groups.set(f.patternId, [...(groups.get(f.patternId) ?? []), f])
  const patterns: WastePattern[] = []
  for (const [id, list] of groups) {
    const first = list[0]
    const smdb = getSmdb(first.smdbId)
    const excessKwh = list.reduce((s, f) => s + f.excessKwh, 0)
    const aed = list.reduce((s, f) => s + f.aed, 0)
    const dates = list.map((f) => f.date).sort()
    const span = Math.max(windowDays, 1)
    const name = smdb?.name ?? first.smdbId
    const titleFn = PATTERN_TITLES[`${smdb?.loadType}_${first.kind}`]
    patterns.push({
      id,
      kind: first.kind,
      smdbId: first.smdbId,
      buildingId: first.buildingId,
      siteId: first.siteId,
      flags: list,
      days: list.length,
      excessKwh,
      aed,
      avgExcessPct: Math.round(list.reduce((s, f) => s + f.excessPct, 0) / list.length),
      firstDate: dates[0],
      lastDate: dates[dates.length - 1],
      annualKwh: Math.round((excessKwh / span) * 365),
      annualAed: Math.round((aed / span) * 365),
      title: titleFn ? titleFn(name) : `${WASTE_KIND_LABELS[first.kind]} — ${name}`,
      hint: list[0].hint,
    })
  }
  return patterns.sort((a, b) => b.aed - a.aed)
}
