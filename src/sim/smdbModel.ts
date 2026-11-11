import { subMinutes } from 'date-fns'
import type { CalendarPeriod, LoadType, Reading, Smdb, SmdbStatus, SmdbThresholds } from '../types'
import { expectedKw } from './loadModel'
import { createRng, hashString } from './rng'

/**
 * Pure maths for the SMDB simulator (no React here, easy to test).
 * Expected load comes from loadModel.ts; this file turns kW into a full
 * meter reading (per-phase V / A / THD, PF, kVA, kVAr) and works out status.
 */

const LINE_VOLTAGE = 400 // V, 3-phase line-to-line
const SQRT3 = Math.sqrt(3)

/** Per-phase current split. Default is nearly balanced; one board is close to the 15% limit. */
const PHASE_SPLIT: Record<string, [number, number, number]> = {
  'SMDB-PMR-B1-02': [1.07, 0.99, 0.94], // ~13% imbalance (single-phase apartment loads): lower the limit to 10% to see an alert
}

/** Typical power factor and current THD by what the board feeds. */
const PF_RANGE: Record<LoadType, [number, number]> = {
  hvac: [0.91, 0.94], // VSD drives with capacitor banks
  lighting_power: [0.92, 0.95],
  tenant: [0.92, 0.96],
  common: [0.91, 0.94],
  carpark: [0.91, 0.93],
  kitchen: [0.95, 0.98],
  critical: [0.93, 0.96],
}
const THD_RANGE: Record<LoadType, [number, number]> = {
  hvac: [9, 14], // VSD drives
  lighting_power: [12, 18], // LED drivers, IT loads
  tenant: [8, 13],
  common: [6, 10],
  carpark: [7, 11],
  kitchen: [3, 6],
  critical: [14, 22], // UPS / imaging
}
/** A couple of boards with a power-quality story for the Power Quality page. */
const PF_OVERRIDE: Record<string, number> = { 'SMDB-HBT-B2-01': 0.84 } // car park fans: capacitor bank out of service
const THD_OVERRIDE: Record<string, number> = { 'SMDB-WMC-B1-02': 27 } // imaging / UPS: high harmonic distortion

/** Stable per-board numbers (phase split, PF, THD, starting kWh counter). */
export function boardConstants(smdb: Smdb) {
  const rng = createRng(hashString(`board:${smdb.id}`))
  const split = PHASE_SPLIT[smdb.id] ?? [1 + rng.range(-0.02, 0.02), 1 + rng.range(-0.02, 0.02), 1 + rng.range(-0.02, 0.02)]
  const mean = (split[0] + split[1] + split[2]) / 3
  const [pfLo, pfHi] = PF_RANGE[smdb.loadType]
  const [thLo, thHi] = THD_RANGE[smdb.loadType]
  return {
    split: split.map((s) => s / mean) as [number, number, number],
    pf: PF_OVERRIDE[smdb.id] ?? rng.range(pfLo, pfHi),
    thd: THD_OVERRIDE[smdb.id] ?? rng.range(thLo, thHi),
    startKwh: Math.round(400_000 + rng.range(0, 2_400_000)),
  }
}

/** Demo faults the admin can force on a board. */
export type FaultType = 'trip' | 'overload' | 'low_pf'

/** Build one meter reading from a kW value (adds per-phase detail). */
export function makeReading(smdb: Smdb, at: Date, kW: number, kWh: number, random: () => number, fault?: FaultType): Reading {
  const { split, pf: basePf, thd } = boardConstants(smdb)
  let pf = Math.min(0.99, basePf + (random() - 0.5) * 0.01)
  if (fault === 'low_pf') pf = 0.78 + random() * 0.02
  let power = kW
  if (fault === 'overload') {
    // Push the board to ~100–104% of its breaker rating.
    power = (smdb.ratedCurrentA * (1 + random() * 0.04) * SQRT3 * LINE_VOLTAGE * pf) / 1000 / Math.max(...split)
  }
  if (fault === 'trip') power = 0

  const avgCurrent = (power * 1000) / (SQRT3 * LINE_VOLTAGE * pf)
  // Voltage sags slightly with load.
  const loadRatio = avgCurrent / smdb.ratedCurrentA
  const phases = split.map((share) => ({
    voltageV: round(231 * (1 - 0.015 * loadRatio) + (random() - 0.5) * 3, 1),
    currentA: round(avgCurrent * share * (1 + (random() - 0.5) * 0.01), 1),
    thdPct: power > 0 ? round(thd * (1 + (random() - 0.5) * 0.08), 1) : 0,
  })) as Reading['phases']
  const kVA = power / pf

  return {
    smdbId: smdb.id,
    at: at.toISOString(),
    phases,
    kW: round(power, 1),
    kVA: round(kVA, 1),
    kVAr: round(Math.sqrt(Math.max(0, kVA * kVA - power * power)), 1),
    pf: round(pf, 2),
    kWh: Math.round(kWh),
    frequencyHz: round(50 + (random() - 0.5) * 0.06, 2),
  }
}

export type IssueCode = 'trip' | 'overload' | 'high_load' | 'imbalance' | 'voltage' | 'low_pf' | 'offline'

export interface SmdbIssue {
  code: IssueCode
  severity: 'warning' | 'critical'
  title: string
  message: string
}

export interface SmdbHealth {
  status: SmdbStatus
  loadPct: number
  imbalancePct: number
  minV: number
  maxV: number
  maxThd: number
  issues: SmdbIssue[]
}

/** Status from the configurable thresholds. `offline` = its IoT node stopped sending data. */
export function computeHealth(reading: Reading, smdb: Smdb, t: SmdbThresholds, offline = false): SmdbHealth {
  const currents = reading.phases.map((p) => p.currentA)
  const volts = reading.phases.map((p) => p.voltageV)
  const maxA = Math.max(...currents)
  const avgA = currents.reduce((s, c) => s + c, 0) / 3
  const loadPct = (maxA / smdb.ratedCurrentA) * 100
  // Imbalance = (highest − lowest phase current) ÷ average.
  const imbalancePct = avgA > 1 ? ((maxA - Math.min(...currents)) / avgA) * 100 : 0
  const minV = Math.min(...volts)
  const maxV = Math.max(...volts)
  const maxThd = Math.max(...reading.phases.map((p) => p.thdPct))
  const base = { loadPct, imbalancePct, minV, maxV, maxThd }

  if (offline) {
    return {
      ...base,
      status: 'offline',
      issues: [{ code: 'offline', severity: 'warning', title: 'No data — IoT node offline', message: `No readings from ${smdb.name} since its IoT node (${smdb.nodeId}) went offline. Values shown are the last received.` }],
    }
  }

  const issues: SmdbIssue[] = []
  if (maxA < 1) {
    issues.push({ code: 'trip', severity: 'critical', title: 'SMDB tripped — zero current', message: `All phase currents dropped to zero on ${smdb.name}.` })
  } else {
    if (loadPct > t.critLoadPct) {
      issues.push({ code: 'overload', severity: 'critical', title: `Overload — ${Math.round(loadPct)}% of rating`, message: `Load on ${smdb.name} exceeded the ${t.critLoadPct}% critical threshold (${smdb.ratedCurrentA} A breaker).` })
    } else if (loadPct > t.warnLoadPct) {
      issues.push({ code: 'high_load', severity: 'warning', title: `High load — ${Math.round(loadPct)}% of rating`, message: `Load on ${smdb.name} exceeded the ${t.warnLoadPct}% warning threshold.` })
    }
    if (imbalancePct > t.imbalancePct) {
      issues.push({ code: 'imbalance', severity: 'warning', title: `Phase imbalance ${Math.round(imbalancePct)}%`, message: `Current imbalance between phases on ${smdb.name} is above the ${t.imbalancePct}% limit.` })
    }
    if (reading.pf < t.minPf) {
      issues.push({ code: 'low_pf', severity: 'warning', title: `Low power factor — ${reading.pf.toFixed(2)}`, message: `Power factor on ${smdb.name} is below ${t.minPf.toFixed(2)}. Check the capacitor bank; low PF increases losses and may attract utility charges.` })
    }
  }
  const low = t.nominalVoltageV * (1 - t.voltageTolPct / 100)
  const high = t.nominalVoltageV * (1 + t.voltageTolPct / 100)
  if (minV < low || maxV > high) {
    const v = minV < low ? minV : maxV
    issues.push({ code: 'voltage', severity: 'warning', title: `Voltage ${minV < low ? 'low' : 'high'} — ${Math.round(v)} V`, message: `A phase voltage on ${smdb.name} is outside the ±${t.voltageTolPct}% band.` })
  }

  const status: SmdbStatus = issues.some((i) => i.code === 'trip')
    ? 'tripped'
    : issues.some((i) => i.severity === 'critical')
      ? 'critical'
      : issues.length
        ? 'warning'
        : 'normal'
  return { ...base, status, issues }
}

export interface HistoryPoint {
  t: number // epoch ms
  kW: number
  loadPct: number
}

/** Last 24 h at 15-minute steps, seeded so it is the same on every reload. */
export function buildHistory(smdb: Smdb, now: Date, calendar: CalendarPeriod[]): HistoryPoint[] {
  const { pf, split } = boardConstants(smdb)
  const points: HistoryPoint[] = []
  for (let i = 96; i >= 1; i--) {
    const at = subMinutes(now, i * 15)
    const rng = createRng(hashString(`${smdb.id}:${Math.floor(at.getTime() / 900_000)}`))
    const kW = expectedKw(smdb, at, calendar) * rng.range(0.94, 1.06)
    const maxA = ((kW * 1000) / (SQRT3 * LINE_VOLTAGE * pf)) * Math.max(...split)
    points.push({ t: at.getTime(), kW: round(kW, 1), loadPct: round((maxA / smdb.ratedCurrentA) * 100, 1) })
  }
  return points
}

/**
 * Energy used by a board between two moments (kWh), integrating the load
 * model in 15-minute steps. Used for "today's kWh so far".
 */
export function energyBetween(smdb: Smdb, from: Date, to: Date, calendar: CalendarPeriod[]): number {
  let kWh = 0
  for (let t = from.getTime(); t < to.getTime(); t += 900_000) {
    const stepHours = Math.min(900_000, to.getTime() - t) / 3_600_000
    kWh += expectedKw(smdb, new Date(t + 450_000), calendar) * stepHours
  }
  return kWh
}

function round(value: number, digits: number): number {
  const f = 10 ** digits
  return Math.round(value * f) / f
}
