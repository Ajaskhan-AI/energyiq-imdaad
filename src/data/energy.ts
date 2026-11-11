import { subDays } from 'date-fns'
import { resolveDayType } from '../lib/calendar'
import { fromISODate, toISODate } from '../lib/dates'
import { isAfterHours, kwFor } from '../sim/loadModel'
import { createRng, hashString } from '../sim/rng'
import type { EnergyRecord, Smdb } from '../types'
import { SEED_CALENDAR } from './calendar'
import { BUILDINGS, getSite } from './sites'
import { SMDBS } from './smdbs'

/**
 * Generated meter history: 365 days per SMDB, ending yesterday, built from the
 * same load model as the live readings (src/sim/loadModel.ts).
 *
 * Not stored in localStorage (too big, and it never changes): it is rebuilt
 * from a seeded RNG, so it is identical on every load. It always uses the
 * ORIGINAL calendar: if a user edits the calendar later, the meter data stays
 * the same and only the analysis changes, just like real life.
 */

export interface SmdbDay {
  smdbId: string
  buildingId: string
  siteId: string
  date: string
  kWh: number
  afterHoursKwh: number
  peakKw: number
}

/** One board's 24 hourly kWh values for a day (seeded noise, so stable). */
export function smdbHourly(smdb: Smdb, date: string): number[] {
  const site = getSite(smdb.siteId)
  if (!site) return Array(24).fill(0)
  const day = fromISODate(date)
  const dayType = resolveDayType(day, site, SEED_CALENDAR)
  const rng = createRng(hashString(`${smdb.id}:${date}`))
  const dayFactor = rng.range(0.95, 1.05)
  return Array.from({ length: 24 }, (_, hour) => kwFor(smdb, site, dayType, hour + 0.5, day.getMonth()) * dayFactor * rng.range(0.97, 1.03))
}

/** Hourly kWh for a whole building (sum of its boards), for the hour × day heatmap. */
export function buildingHourly(buildingId: string, date: string): number[] {
  const totals = Array(24).fill(0) as number[]
  for (const smdb of SMDBS) {
    if (smdb.buildingId !== buildingId) continue
    smdbHourly(smdb, date).forEach((kwh, h) => (totals[h] += kwh))
  }
  return totals.map(Math.round)
}

const cache = new Map<string, { boards: SmdbDay[]; buildings: EnergyRecord[] }>()

/** Daily history per board and per building (cached per day). */
export function getEnergyHistory(now: Date, days = 365): { boards: SmdbDay[]; buildings: EnergyRecord[] } {
  const key = `${toISODate(now)}:${days}`
  const cached = cache.get(key)
  if (cached) return cached

  const boards: SmdbDay[] = []
  for (const smdb of SMDBS) {
    const site = getSite(smdb.siteId)
    if (!site) continue
    for (let offset = days; offset >= 1; offset--) {
      const date = toISODate(subDays(now, offset))
      const hourly = smdbHourly(smdb, date)
      const dayType = resolveDayType(fromISODate(date), site, SEED_CALENDAR)
      let afterHours = 0
      hourly.forEach((kwh, hour) => {
        if (isAfterHours(site, dayType, hour)) afterHours += kwh
      })
      boards.push({
        smdbId: smdb.id,
        buildingId: smdb.buildingId,
        siteId: smdb.siteId,
        date,
        kWh: Math.round(hourly.reduce((s, v) => s + v, 0)),
        afterHoursKwh: Math.round(afterHours),
        peakKw: Math.round(Math.max(...hourly) * 1.06), // 15-min peak sits a little above the hourly average
      })
    }
  }

  // Building totals per day.
  const byKey = new Map<string, EnergyRecord>()
  for (const b of boards) {
    const k = `${b.buildingId}:${b.date}`
    const rec = byKey.get(k)
    if (rec) {
      rec.kWh += b.kWh
      rec.afterHoursKwh += b.afterHoursKwh
      rec.peakKw += b.peakKw * 0.92 // board peaks don't all happen at the same moment
    } else {
      byKey.set(k, { buildingId: b.buildingId, siteId: b.siteId, date: b.date, kWh: b.kWh, afterHoursKwh: b.afterHoursKwh, peakKw: b.peakKw * 0.92 })
    }
  }
  const order = new Map(BUILDINGS.map((b, i) => [b.id, i]))
  const buildings = [...byKey.values()]
    .map((r) => ({ ...r, peakKw: Math.round(r.peakKw) }))
    .sort((a, b) => (order.get(a.buildingId) ?? 0) - (order.get(b.buildingId) ?? 0) || a.date.localeCompare(b.date))

  const result = { boards, buildings }
  cache.set(key, result)
  return result
}
