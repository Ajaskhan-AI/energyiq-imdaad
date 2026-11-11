import { addDays, endOfMonth, format, getDaysInMonth, startOfDay, startOfMonth } from 'date-fns'
import type { SmdbDay } from '../data/energy'
import { SMDBS } from '../data/smdbs'
import { kwFor } from '../sim/loadModel'
import { energyBetween } from '../sim/smdbModel'
import type { CalendarPeriod, Site } from '../types'
import { resolveDayType } from './calendar'
import { monthlyBillAed } from './tariff'

/**
 * Electricity budget & month-end forecast per site.
 *
 * - Actual = metered kWh so far this month (meter history to yesterday + today so far).
 * - Forecast = actual + the expected use for the rest of the month, from the
 *   same load model as the live data and the operating calendar, assuming
 *   current behaviour continues (so an unfixed waste pattern keeps costing money).
 * - Budget = the client's monthly budget (editable). By default it is set from
 *   the site's normal, waste-free consumption for the month, plus a 3 % margin.
 * Costs use the indicative DEWA slab tariff on the site's monthly total.
 */

/** kWh a site uses between two days (inclusive) according to the load model. */
function modelKwh(site: Site, from: Date, to: Date, calendar: CalendarPeriod[], withWaste: boolean): number {
  const boards = SMDBS.filter((b) => b.siteId === site.id)
  let kwh = 0
  for (let day = startOfDay(from); day <= to; day = addDays(day, 1)) {
    const dayType = resolveDayType(day, site, calendar)
    for (const b of boards) for (let h = 0; h < 24; h++) kwh += kwFor(b, site, dayType, h + 0.5, day.getMonth(), withWaste)
  }
  return kwh
}

const cache = new Map<string, number>()

/** Default monthly budget (AED): waste-free consumption for the month + 3 %, rounded to AED 1,000. */
export function defaultBudgetAed(site: Site, now: Date, calendar: CalendarPeriod[]): number {
  const key = `${site.id}:${format(now, 'yyyy-MM')}:${calendar.length}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const kwh = modelKwh(site, startOfMonth(now), endOfMonth(now), calendar, false)
  const aed = Math.round((monthlyBillAed(kwh).totalAed * 1.03) / 1000) * 1000
  cache.set(key, aed)
  return aed
}

export interface BudgetPoint {
  day: number
  /** Cumulative actual cost (AED), past days only. */
  actual?: number
  /** Cumulative forecast cost (AED), today onwards. */
  forecast?: number
  /** Budget spread evenly over the month. */
  budget: number
}

export interface SiteBudget {
  site: Site
  budgetAed: number
  isDefaultBudget: boolean
  actualKwh: number
  actualAed: number
  forecastKwh: number
  forecastAed: number
  /** Forecast minus budget (positive = over budget). */
  varianceAed: number
  variancePct: number
  /** Share of the month elapsed (0–1). */
  elapsed: number
  status: 'on_track' | 'at_risk' | 'over'
  series: BudgetPoint[]
}

export function siteBudget(site: Site, boardDays: SmdbDay[], calendar: CalendarPeriod[], now: Date, override?: number): SiteBudget {
  const monthStart = startOfMonth(now)
  const month = format(now, 'yyyy-MM')
  const daysInMonth = getDaysInMonth(now)
  const today = now.getDate()
  const budgetAed = override ?? defaultBudgetAed(site, now, calendar)

  // Actual per day: meter history up to yesterday, today so far from the live model.
  const perDay = new Array<number>(daysInMonth + 1).fill(0)
  for (const r of boardDays) if (r.siteId === site.id && r.date.startsWith(month)) perDay[Number(r.date.slice(8, 10))] += r.kWh
  const boards = SMDBS.filter((b) => b.siteId === site.id)
  perDay[today] = boards.reduce((s, b) => s + energyBetween(b, startOfDay(now), now, calendar), 0)

  // Forecast: rest of today + the remaining days, current behaviour continuing.
  const restOfToday = boards.reduce((s, b) => s + energyBetween(b, now, addDays(startOfDay(now), 1), calendar), 0)
  const futurePerDay = new Array<number>(daysInMonth + 1).fill(0)
  futurePerDay[today] = restOfToday
  for (let d = today + 1; d <= daysInMonth; d++) {
    const day = addDays(monthStart, d - 1)
    futurePerDay[d] = modelKwh(site, day, day, calendar, true)
  }

  const actualKwh = perDay.reduce((s, v) => s + v, 0)
  const forecastKwh = actualKwh + futurePerDay.reduce((s, v) => s + v, 0)
  const cost = (kwh: number) => monthlyBillAed(kwh).totalAed

  const series: BudgetPoint[] = []
  let cumActual = 0
  let cumForecast = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const point: BudgetPoint = { day: d, budget: Math.round((budgetAed * d) / daysInMonth) }
    if (d <= today) {
      cumActual += perDay[d]
      point.actual = Math.round(cost(cumActual))
    }
    if (d >= today) {
      cumForecast = (d === today ? cumActual : cumForecast) + futurePerDay[d]
      point.forecast = Math.round(cost(cumForecast))
    }
    series.push(point)
  }

  const forecastAed = cost(forecastKwh)
  const varianceAed = forecastAed - budgetAed
  const variancePct = budgetAed ? (varianceAed / budgetAed) * 100 : 0
  return {
    site,
    budgetAed,
    isDefaultBudget: override === undefined,
    actualKwh,
    actualAed: cost(actualKwh),
    forecastKwh,
    forecastAed,
    varianceAed,
    variancePct,
    elapsed: (today - 1 + now.getHours() / 24) / daysInMonth,
    status: variancePct > 2 ? 'over' : variancePct > -1.5 ? 'at_risk' : 'on_track',
    series,
  }
}

export function monthLabel(now: Date): string {
  return format(now, 'MMMM yyyy')
}

