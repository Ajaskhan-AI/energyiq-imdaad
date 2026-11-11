import { format, startOfMonth, subMonths } from 'date-fns'
import type { SmdbDay } from '../data/energy'
import { SITES } from '../data/sites'
import { getSmdb } from '../data/smdbs'
import type { Site } from '../types'
import { fromISODate, toISODate } from './dates'
import { monthlyBillAed } from './tariff'

/**
 * Sub-metering / recharge: each site's DEWA bill is estimated from the sum of
 * its SMDB meters, then shared between cost centres (tenants, landlord areas)
 * in proportion to their metered kWh, at the site's average rate.
 */

export interface CostCentreLine {
  name: string
  smdbIds: string[]
  kWh: number
  aed: number
  sharePct: number
  peakKw: number
}

export interface SiteBill {
  site: Site
  kWh: number
  energyAed: number
  fuelAed: number
  totalAed: number
  avgFilsPerKwh: number
  days: number
  costCentres: CostCentreLine[]
}

export interface MonthlyBilling {
  month: string // yyyy-MM
  label: string // "October 2026"
  partial: boolean
  sites: SiteBill[]
  totalKwh: number
  totalAed: number
}

/** The last 12 months (newest first), the current month first as "month to date". */
export function billingMonths(now: Date): Array<{ id: string; label: string }> {
  return Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(startOfMonth(now), i)
    return { id: format(d, 'yyyy-MM'), label: `${format(d, 'MMMM yyyy')}${i === 0 ? ' (month to date)' : ''}` }
  })
}

export function billingForMonth(month: string, boardDays: SmdbDay[], siteIds: Set<string>, now: Date): MonthlyBilling {
  const rows = boardDays.filter((r) => r.date.startsWith(month) && siteIds.has(r.siteId))
  const sites: SiteBill[] = []
  for (const site of SITES) {
    if (!siteIds.has(site.id)) continue
    const siteRows = rows.filter((r) => r.siteId === site.id)
    if (!siteRows.length) continue
    const kWh = siteRows.reduce((s, r) => s + r.kWh, 0)
    const bill = monthlyBillAed(kWh)
    const rate = kWh ? bill.totalAed / kWh : 0

    const byCentre = new Map<string, CostCentreLine>()
    for (const r of siteRows) {
      const smdb = getSmdb(r.smdbId)
      if (!smdb) continue
      const line = byCentre.get(smdb.costCentre) ?? { name: smdb.costCentre, smdbIds: [], kWh: 0, aed: 0, sharePct: 0, peakKw: 0 }
      if (!line.smdbIds.includes(smdb.id)) line.smdbIds.push(smdb.id)
      line.kWh += r.kWh
      line.peakKw = Math.max(line.peakKw, r.peakKw)
      byCentre.set(smdb.costCentre, line)
    }
    const costCentres = [...byCentre.values()]
      .map((c) => ({ ...c, aed: c.kWh * rate, sharePct: kWh ? (c.kWh / kWh) * 100 : 0 }))
      .sort((a, b) => b.kWh - a.kWh)

    sites.push({
      site,
      kWh,
      ...bill,
      avgFilsPerKwh: rate * 100,
      days: new Set(siteRows.map((r) => r.date)).size,
      costCentres,
    })
  }
  const first = fromISODate(`${month}-01`)
  return {
    month,
    label: format(first, 'MMMM yyyy'),
    partial: month === format(now, 'yyyy-MM'),
    sites,
    totalKwh: sites.reduce((s, b) => s + b.kWh, 0),
    totalAed: sites.reduce((s, b) => s + b.totalAed, 0),
  }
}

/** Same month one year earlier, for year-on-year comparison (null if outside the history). */
export function previousYearMonth(month: string): string {
  const d = fromISODate(`${month}-01`)
  return toISODate(subMonths(d, 12)).slice(0, 7)
}
