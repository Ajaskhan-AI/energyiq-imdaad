import { differenceInCalendarDays, startOfDay, subDays } from 'date-fns'
import { toISODate } from '../lib/dates'
import type { Asset, AssetCategory } from '../types'
import { createRng, hashString } from './rng'

/**
 * Module 2 — simulated motor current signature analysis (MCSA).
 *
 * CT clamps on the motor supply give the running current. From it the
 * platform tracks (1) the average current against the asset's normal band,
 * (2) "ripple" (how unsteady the current is) and (3) the strength of fault
 * frequencies in the current spectrum. These combine into a health score.
 *
 * Three assets are degrading in the seeded history so the demo has a story;
 * "Mark as resolved" resets an asset to healthy from that moment.
 */

export type HealthStatus = 'ok' | 'watch' | 'alert'
export type IssueKind = 'bearing' | 'filter' | 'condenser'

interface Degradation {
  kind: IssueKind
  /** Fault started this many days ago… */
  startDaysAgo: number
  /** …and grows by this much per day (1 = fully developed). */
  ratePerDay: number
}

const DEGRADING: Record<string, Degradation> = {
  'HBT-CHWP-01': { kind: 'bearing', startDaysAgo: 40, ratePerDay: 0.0145 }, // → Alert
  'WMC-AHU-01': { kind: 'filter', startDaysAgo: 30, ratePerDay: 0.011 }, // → Watch
  'ANM-CH-02': { kind: 'condenser', startDaysAgo: 25, ratePerDay: 0.014 }, // → Watch
}

/** Typical running current per category (A). */
const NORMAL_CURRENT: Record<AssetCategory, number> = { chiller: 420, ahu: 22, pump: 48, cooling_tower: 34 }
const BAND = 0.08 // normal band = ±8 % around the typical current

export const ISSUES: Record<IssueKind, { title: string; detail: string; action: string; shortAction: string }> = {
  bearing: {
    title: 'Possible bearing wear',
    detail: 'Current ripple is rising and bearing-frequency side-bands are growing in the motor current signature.',
    action: 'Inspect and grease the motor bearings; plan bearing replacement at the next shutdown.',
    shortAction: 'Bearing inspection',
  },
  filter: {
    title: 'Filter clogging — rising current',
    detail: 'Fan motor current has been rising steadily above its normal band as airflow resistance increases.',
    action: 'Replace or clean the AHU filters and check belt tension. For theatre AHUs, schedule outside surgery hours and re-validate air changes.',
    shortAction: 'Filter replacement',
  },
  condenser: {
    title: 'Compressor current above normal — possible condenser fouling',
    detail: 'Compressor current is drifting up at the same cooling load, a typical sign of fouled condenser tubes.',
    action: 'Clean the condenser tubes and check the refrigerant charge.',
    shortAction: 'Condenser cleaning',
  },
}

export const HEALTH_LABELS: Record<HealthStatus, string> = { ok: 'OK', watch: 'Watch', alert: 'Alert' }

export function healthStatus(score: number): HealthStatus {
  return score >= 80 ? 'ok' : score >= 60 ? 'watch' : 'alert'
}

export interface DayPoint {
  t: number
  date: string
  health: number
  currentA: number
  ripplePct: number
}

export interface SpectrumBin {
  label: string
  /** Amplitude as % of the 50 Hz fundamental. */
  value: number
  normal: number
  fault: boolean
}

export interface Assessment {
  assetId: string
  status: HealthStatus
  health: number
  normalA: number
  band: [number, number]
  currentA: number
  deviationPct: number
  ripplePct: number
  /** Detected issue (only when the asset is not OK). */
  issue?: (typeof ISSUES)[IssueKind] & { kind: IssueKind }
  /** Days until it should be acted on (Watch → before it reaches Alert; Alert → before likely failure). */
  daysToAction: number | null
  history: DayPoint[]
  spectrum: SpectrumBin[]
  resetAt?: string
}

const HEALTH_AT_ZERO = 97
const HEALTH_PER_PROGRESS = 70

/** How far the fault has developed on a given day (0 = healthy, 1 = fully developed). */
function progressOn(asset: Asset, day: Date, now: Date, resetAt?: string): number {
  const d = DEGRADING[asset.id]
  if (!d) return 0
  if (resetAt && day >= startOfDay(new Date(resetAt))) return 0
  const daysAgo = differenceInCalendarDays(now, day)
  if (daysAgo > d.startDaysAgo) return 0
  return Math.min(1, (d.startDaysAgo - daysAgo) * d.ratePerDay)
}

function pointFor(asset: Asset, day: Date, now: Date, resetAt?: string): DayPoint {
  const p = progressOn(asset, day, now, resetAt)
  const kind = DEGRADING[asset.id]?.kind
  const date = toISODate(day)
  const rng = createRng(hashString(`${asset.id}:${date}:mcsa`))
  const normal = NORMAL_CURRENT[asset.category]
  const rise = kind === 'filter' ? 0.25 : kind === 'condenser' ? 0.18 : 0.07
  return {
    t: day.getTime(),
    date,
    health: Math.max(12, Math.min(99, Math.round(HEALTH_AT_ZERO - HEALTH_PER_PROGRESS * p + rng.range(-3, 2)))),
    currentA: Math.round(normal * (1 + rise * p) * rng.range(0.98, 1.02) * 10) / 10,
    ripplePct: Math.round((1.5 + (kind === 'bearing' ? 9 : 1) * p + rng.range(-0.3, 0.3)) * 10) / 10,
  }
}

/** Full health assessment for one monitored asset (60 days of daily history). */
export function assessAsset(asset: Asset, now: Date, resetAt?: string): Assessment {
  const history: DayPoint[] = []
  for (let i = 59; i >= 0; i--) history.push(pointFor(asset, startOfDay(subDays(now, i)), now, resetAt))
  const today = history[history.length - 1]
  const status = healthStatus(today.health)
  const normalA = NORMAL_CURRENT[asset.category]
  const d = DEGRADING[asset.id]
  const p = progressOn(asset, startOfDay(now), now, resetAt)

  // Days until the next threshold: Watch → reaches 60 (Alert); Alert → reaches 40 (likely failure).
  let daysToAction: number | null = null
  if (d && p > 0 && status !== 'ok') {
    const target = status === 'watch' ? 60 : 40
    const pTarget = (HEALTH_AT_ZERO - target) / HEALTH_PER_PROGRESS
    daysToAction = Math.max(1, Math.ceil((pTarget - p) / d.ratePerDay))
  }

  const bearing = d?.kind === 'bearing' ? p : 0
  const spectrum: SpectrumBin[] = [
    { label: '0.5×', value: 1.8 + p * 0.6, normal: 2, fault: false },
    { label: 'Bearing band', value: 1.2 + bearing * 22, normal: 1.5, fault: bearing > 0.2 },
    { label: '2×', value: 2.5 + (d?.kind === 'condenser' ? p * 4 : 0), normal: 3, fault: d?.kind === 'condenser' && p > 0.2 },
    { label: '3×', value: 3.6 + p * 1.2, normal: 4, fault: false },
    { label: 'Pole-pass', value: 0.9 + (d?.kind === 'filter' ? p * 3 : 0), normal: 1.2, fault: false },
    { label: '5×', value: 2.2, normal: 2.5, fault: false },
  ].map((b) => ({ ...b, value: Math.round(b.value * 10) / 10 }))

  return {
    assetId: asset.id,
    status,
    health: today.health,
    normalA,
    band: [Math.round(normalA * (1 - BAND) * 10) / 10, Math.round(normalA * (1 + BAND) * 10) / 10],
    currentA: today.currentA,
    deviationPct: Math.round(((today.currentA - normalA) / normalA) * 1000) / 10,
    ripplePct: today.ripplePct,
    ...(d && status !== 'ok' ? { issue: { kind: d.kind, ...ISSUES[d.kind] } } : {}),
    daysToAction,
    history,
    spectrum,
    ...(resetAt ? { resetAt } : {}),
  }
}

/** Assess every monitored asset. */
export function assessAll(assets: Asset[], now: Date, resets: Record<string, { at: string }>): Assessment[] {
  return assets.map((a) => assessAsset(a, now, resets[a.id]?.at))
}
