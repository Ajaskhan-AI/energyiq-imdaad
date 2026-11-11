import { subDays } from 'date-fns'
import { smdbHourly, type SmdbDay } from '../data/energy'
import type { Smdb, SmdbThresholds } from '../types'
import { toISODate } from './dates'

/**
 * Capacity & maximum demand, from the SMDB meters.
 *
 * Every board has a breaker rating (A). At 400 V three-phase and a typical
 * power factor that is a usable kW capacity. Comparing the metered maximum
 * demand with it shows how much spare capacity each board has: the question
 * FM teams get every time a tenant wants to add equipment.
 */

/** Usable kW for a breaker rating (3-phase 400 V, PF 0.92). */
export function ratedKw(smdb: Smdb): number {
  return (smdb.ratedCurrentA * Math.sqrt(3) * 400 * 0.92) / 1000
}

export interface BoardCapacity {
  smdb: Smdb
  ratedKw: number
  /** Planning limit = warning threshold (default 80 % of rating). */
  planningKw: number
  peak30Kw: number
  peak30Date: string
  peak12Kw: number
  peak12Date: string
  /** Peak demand as % of rating. */
  util30Pct: number
  util12Pct: number
  /** kW that can still be added before the planning limit, based on the 30-day peak. */
  headroomKw: number
  /** Hours in the last 30 days with load above the planning limit. */
  hoursAbovePlanning: number
  status: 'ok' | 'tight' | 'over'
}

/** Highest 15-min-style peak in a list of board-days. */
function peakOf(days: SmdbDay[]): { kw: number; date: string } {
  let best = { kw: 0, date: '' }
  for (const d of days) if (d.peakKw > best.kw) best = { kw: d.peakKw, date: d.date }
  return best
}

export function boardCapacity(smdb: Smdb, boardDays: SmdbDay[], t: SmdbThresholds, now: Date): BoardCapacity {
  const rated = ratedKw(smdb)
  const planning = (rated * t.warnLoadPct) / 100
  const from30 = toISODate(subDays(now, 30))
  const mine = boardDays.filter((d) => d.smdbId === smdb.id)
  const last30 = mine.filter((d) => d.date >= from30)
  const p30 = peakOf(last30)
  const p12 = peakOf(mine)

  let hoursAbove = 0
  for (const d of last30) for (const kwh of smdbHourly(smdb, d.date)) if (kwh > planning) hoursAbove++

  const util30 = (p30.kw / rated) * 100
  return {
    smdb,
    ratedKw: rated,
    planningKw: planning,
    peak30Kw: p30.kw,
    peak30Date: p30.date,
    peak12Kw: p12.kw,
    peak12Date: p12.date,
    util30Pct: util30,
    util12Pct: (p12.kw / rated) * 100,
    headroomKw: Math.max(0, planning - p30.kw),
    hoursAbovePlanning: hoursAbove,
    status: util30 > t.critLoadPct ? 'over' : util30 > t.warnLoadPct ? 'tight' : 'ok',
  }
}

/** Hourly kW for the last `days` days, sorted high → low (load duration curve). */
export function loadDurationCurve(smdb: Smdb, now: Date, days = 30): Array<{ pctOfTime: number; kw: number }> {
  const values: number[] = []
  for (let i = days; i >= 1; i--) values.push(...smdbHourly(smdb, toISODate(subDays(now, i))))
  values.sort((a, b) => b - a)
  // Thin the curve to ~120 points so the chart stays light.
  const step = Math.max(1, Math.floor(values.length / 120))
  const out: Array<{ pctOfTime: number; kw: number }> = []
  for (let i = 0; i < values.length; i += step) out.push({ pctOfTime: Math.round((i / values.length) * 1000) / 10, kw: Math.round(values[i]) })
  out.push({ pctOfTime: 100, kw: Math.round(values[values.length - 1] ?? 0) })
  return out
}

export type AddLoadVerdict = 'ok' | 'tight' | 'no'

/**
 * "Can this board take another X kW?" If the new load runs at peak times it
 * adds to the peak; otherwise only a share of it does (diversity).
 */
export function checkAddLoad(cap: BoardCapacity, addKw: number, atPeak: boolean, t: SmdbThresholds) {
  const added = atPeak ? addKw : addKw * 0.4
  const newPeak = cap.peak30Kw + added
  const pct = (newPeak / cap.ratedKw) * 100
  const verdict: AddLoadVerdict = pct > t.critLoadPct ? 'no' : pct > t.warnLoadPct ? 'tight' : 'ok'
  return { newPeak, pct, verdict }
}
