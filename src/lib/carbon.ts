import { endOfMonth, format, startOfMonth, subDays, subMonths } from 'date-fns'
import type { SmdbDay } from '../data/energy'
import { BUILDINGS, getClient, SITES } from '../data/sites'
import { getSmdb, LOAD_TYPE_LABELS } from '../data/smdbs'
import type { LoadType, Site } from '../types'
import { kwhToTonnesCo2 } from './co2'
import { fromISODate, toISODate } from './dates'
import type { WastePattern } from './energyAnalysis'

/**
 * Scope 2 carbon emissions from the SMDB meters (location-based method):
 * t CO2e = metered kWh × DEWA grid emission factor ÷ 1000 (see co2.ts).
 *
 * Everything here is worked out from the same meter history as the energy
 * analytics, so the carbon figures always agree with the kWh figures.
 */

/** A reporting period: one calendar month ("2026-10") or the last 12 months ("12m"). */
export type CarbonPeriod = string

export const LAST_12_MONTHS = '12m'

export function carbonPeriods(now: Date): Array<{ value: CarbonPeriod; label: string }> {
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(startOfMonth(now), i)
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') + (i === 0 ? ' (to date)' : '') }
  })
  return [{ value: LAST_12_MONTHS, label: 'Last 12 months' }, ...months]
}

/** First and last day (ISO) of a period, capped at yesterday (the meter history ends yesterday). */
export function periodRange(period: CarbonPeriod, now: Date): { from: string; to: string; label: string; days: number; isPartial: boolean } {
  const yesterday = toISODate(subDays(now, 1))
  let from: string
  let to: string
  let label: string
  if (period === LAST_12_MONTHS) {
    from = toISODate(subDays(now, 365))
    to = yesterday
    label = `${format(fromISODate(from), 'd MMM yyyy')} - ${format(fromISODate(to), 'd MMM yyyy')}`
  } else {
    const start = fromISODate(`${period}-01`)
    from = toISODate(start)
    const monthEnd = toISODate(endOfMonth(start))
    to = monthEnd < yesterday ? monthEnd : yesterday
    label = format(start, 'MMMM yyyy')
  }
  const days = to >= from ? Math.round((fromISODate(to).getTime() - fromISODate(from).getTime()) / 86_400_000) + 1 : 0
  return { from, to, label, days, isPartial: period !== LAST_12_MONTHS && to < toISODate(endOfMonth(fromISODate(from))) }
}

export interface SiteCarbon {
  site: Site
  clientName: string
  kwh: number
  tonnes: number
  sharePct: number
  areaM2: number
  /** kg CO2e per m² per year (period scaled to a full year). */
  intensityKgM2Yr: number
  /** Emissions from electricity used outside opening hours. */
  afterHoursTonnes: number
}

export interface CarbonSummary {
  from: string
  to: string
  days: number
  kwh: number
  tonnes: number
  /** Same length of time just before this period (null if no data). */
  previousTonnes: number | null
  changePct: number | null
  intensityKgM2Yr: number
  afterHoursTonnes: number
  bySite: SiteCarbon[]
  byLoadType: Array<{ loadType: LoadType; label: string; tonnes: number; sharePct: number }>
}

const yearScale = (days: number) => (days ? 365 / days : 0)

export function carbonSummary(boards: SmdbDay[], siteIds: Set<string>, period: CarbonPeriod, now: Date): CarbonSummary {
  const { from, to, days } = periodRange(period, now)
  const rows = boards.filter((b) => siteIds.has(b.siteId) && b.date >= from && b.date <= to)

  // Previous period of the same length (for the change %).
  const prevTo = toISODate(subDays(fromISODate(from), 1))
  const prevFrom = toISODate(subDays(fromISODate(from), days))
  const prevRows = boards.filter((b) => siteIds.has(b.siteId) && b.date >= prevFrom && b.date <= prevTo)
  const prevDays = new Set(prevRows.map((r) => r.date)).size
  const prevKwhScaled = prevDays ? (prevRows.reduce((s, r) => s + r.kWh, 0) / prevDays) * days : 0

  const kwh = rows.reduce((s, r) => s + r.kWh, 0)
  const afterHoursKwh = rows.reduce((s, r) => s + r.afterHoursKwh, 0)
  const tonnes = kwhToTonnesCo2(kwh)
  const previousTonnes = prevDays >= days * 0.9 ? kwhToTonnesCo2(prevKwhScaled) : null

  const sites = SITES.filter((s) => siteIds.has(s.id))
  const totalArea = BUILDINGS.filter((b) => siteIds.has(b.siteId)).reduce((s, b) => s + b.areaM2, 0)

  const bySite: SiteCarbon[] = sites
    .map((site) => {
      const siteRows = rows.filter((r) => r.siteId === site.id)
      const siteKwh = siteRows.reduce((s, r) => s + r.kWh, 0)
      const area = BUILDINGS.filter((b) => b.siteId === site.id).reduce((s, b) => s + b.areaM2, 0)
      const siteTonnes = kwhToTonnesCo2(siteKwh)
      return {
        site,
        clientName: getClient(site.clientId)?.name ?? '',
        kwh: siteKwh,
        tonnes: siteTonnes,
        sharePct: kwh ? (siteKwh / kwh) * 100 : 0,
        areaM2: area,
        intensityKgM2Yr: area ? (siteTonnes * 1000 * yearScale(days)) / area : 0,
        afterHoursTonnes: kwhToTonnesCo2(siteRows.reduce((s, r) => s + r.afterHoursKwh, 0)),
      }
    })
    .sort((a, b) => b.tonnes - a.tonnes)

  const loadKwh = new Map<LoadType, number>()
  for (const r of rows) {
    const type = getSmdb(r.smdbId)?.loadType
    if (type) loadKwh.set(type, (loadKwh.get(type) ?? 0) + r.kWh)
  }
  const byLoadType = [...loadKwh.entries()]
    .map(([loadType, v]) => ({ loadType, label: LOAD_TYPE_LABELS[loadType], tonnes: kwhToTonnesCo2(v), sharePct: kwh ? (v / kwh) * 100 : 0 }))
    .sort((a, b) => b.tonnes - a.tonnes)

  return {
    from,
    to,
    days,
    kwh,
    tonnes,
    previousTonnes,
    changePct: previousTonnes ? Math.round(((tonnes - previousTonnes) / previousTonnes) * 1000) / 10 : null,
    intensityKgM2Yr: totalArea ? (tonnes * 1000 * yearScale(days)) / totalArea : 0,
    afterHoursTonnes: kwhToTonnesCo2(afterHoursKwh),
    bySite,
    byLoadType,
  }
}

export interface MonthPoint {
  month: string // yyyy-MM
  label: string // "Nov 25"
  /** t CO2e per site id, plus `total`. */
  [siteId: string]: number | string
}

/** Monthly t CO2e per site for the last 12 calendar months (the current month to date). */
export function monthlyCarbon(boards: SmdbDay[], siteIds: Set<string>, now: Date): MonthPoint[] {
  const points = new Map<string, MonthPoint>()
  for (let i = 11; i >= 0; i--) {
    const d = subMonths(startOfMonth(now), i)
    const key = format(d, 'yyyy-MM')
    const point: MonthPoint = { month: key, label: format(d, 'MMM yy'), total: 0 }
    for (const id of siteIds) point[id] = 0
    points.set(key, point)
  }
  for (const r of boards) {
    if (!siteIds.has(r.siteId)) continue
    const point = points.get(r.date.slice(0, 7))
    if (!point) continue
    const t = kwhToTonnesCo2(r.kWh)
    point[r.siteId] = (point[r.siteId] as number) + t
    point.total = (point.total as number) + t
  }
  return [...points.values()]
}

export interface CarbonOpportunity {
  id: string
  title: string
  siteName: string
  /** t CO2e per year if the waste pattern continues. */
  tonnesPerYear: number
  aedPerYear: number
}

/** Emissions that could be avoided by fixing the open waste patterns (per year, indicative). */
export function carbonOpportunities(patterns: WastePattern[], siteIds: Set<string>): CarbonOpportunity[] {
  return patterns
    .filter((p) => siteIds.has(p.siteId))
    .map((p) => ({
      id: p.id,
      title: p.title,
      siteName: SITES.find((s) => s.id === p.siteId)?.shortName ?? p.siteId,
      tonnesPerYear: kwhToTonnesCo2(p.annualKwh),
      aedPerYear: p.annualAed,
    }))
    .sort((a, b) => b.tonnesPerYear - a.tonnesPerYear)
}

/** e.g. EnergyIQ-Carbon-2026-10-AllSites.pdf */
export function carbonFileName(period: CarbonPeriod, scope: string): string {
  return `EnergyIQ-Carbon-${period === LAST_12_MONTHS ? 'Last12Months' : period}-${scope.replace(/[^A-Za-z0-9]+/g, '')}.pdf`
}
