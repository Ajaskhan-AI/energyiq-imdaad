import { addMinutes, subDays } from 'date-fns'
import { SITES } from '../data/sites'
import { SMDBS } from '../data/smdbs'
import { createRng, hashString } from '../sim/rng'
import type { Alert, LoadType } from '../types'
import { atTime, toISODate } from './dates'

/**
 * Supply reliability, from the meters.
 *
 * The meters see every interruption: a board is "out" when all three phase
 * currents drop to zero (breaker trip), and the whole site is out when every
 * board loses voltage at the same moment (utility supply interruption).
 * That gives each client an availability figure per board and per site.
 *
 * History is generated (seeded, so stable). Trips raised live in the demo
 * (alerts with code "trip") are added on top, so "Simulate trip" shows up here.
 */

export type OutageKind = 'breaker_trip' | 'supply_interruption'

export interface OutageEvent {
  id: string
  kind: OutageKind
  siteId: string
  buildingId: string
  /** Boards that lost supply. */
  smdbIds: string[]
  start: string // ISO
  durationMin: number
  cause: string
  ongoing: boolean
}

const TRIP_CAUSES: Record<LoadType, string[]> = {
  hvac: ['Compressor start-up overcurrent', 'Chiller staging fault'],
  lighting_power: ['Faulty socket circuit', 'Equipment short circuit'],
  tenant: ['Tenant overload', 'Tenant equipment fault'],
  common: ['Lift drive fault', 'Earth leakage (RCD) trip'],
  carpark: ['Ventilation fan motor fault', 'Water ingress, earth leakage'],
  kitchen: ['Kitchen overload at lunch peak', 'Fryer element earth fault'],
  critical: ['UPS bypass event', 'Compressor overload'],
}

/** Boards with a recurring problem, so the demo has a story. */
const REPEAT_TRIPS: Record<string, { count: number; cause: string }> = {
  'SMDB-DLH-B1-02': { count: 3, cause: 'MHE battery charger rectifier fault' },
  'SMDB-HBT-B2-03': { count: 2, cause: 'Kitchen overload at lunch peak' },
  'SMDB-ANM-B1-03': { count: 2, cause: 'Food court earth leakage (RCD) trip' },
}

const cache = new Map<string, OutageEvent[]>()

/** Seeded interruption history for the last `days` days. */
export function generatedOutages(now: Date, days = 90): OutageEvent[] {
  const key = `${toISODate(now)}:${days}`
  const hit = cache.get(key)
  if (hit) return hit
  const events: OutageEvent[] = []
  let n = 1

  // Utility supply interruptions: every board on the site at once, usually short.
  for (const site of SITES) {
    const rng = createRng(hashString(`supply:${site.id}:${toISODate(now)}`))
    const count = rng.int(0, 2)
    for (let i = 0; i < count; i++) {
      const start = addMinutes(atTime(subDays(now, rng.int(3, days - 1)), rng.int(0, 23)), rng.int(0, 59))
      const boards = SMDBS.filter((b) => b.siteId === site.id)
      events.push({
        id: `EV-${String(n++).padStart(3, '0')}`,
        kind: 'supply_interruption',
        siteId: site.id,
        buildingId: boards[0]?.buildingId ?? '',
        smdbIds: boards.map((b) => b.id),
        start: start.toISOString(),
        durationMin: rng.int(2, 18),
        cause: 'Utility supply interruption (incoming supply lost on all boards)',
        ongoing: false,
      })
    }
  }

  // Breaker trips on individual boards.
  for (const smdb of SMDBS) {
    const rng = createRng(hashString(`trips:${smdb.id}:${toISODate(now)}`))
    const repeat = REPEAT_TRIPS[smdb.id]
    const count = repeat ? repeat.count : rng.chance(0.25) ? 1 : 0
    for (let i = 0; i < count; i++) {
      const hour = smdb.loadType === 'kitchen' ? rng.int(12, 14) : rng.int(6, 20)
      const start = addMinutes(atTime(subDays(now, rng.int(2, days - 1)), hour), rng.int(0, 59))
      events.push({
        id: `EV-${String(n++).padStart(3, '0')}`,
        kind: 'breaker_trip',
        siteId: smdb.siteId,
        buildingId: smdb.buildingId,
        smdbIds: [smdb.id],
        start: start.toISOString(),
        durationMin: rng.int(6, smdb.loadType === 'critical' ? 35 : 95),
        cause: repeat?.cause ?? rng.pick(TRIP_CAUSES[smdb.loadType]),
        ongoing: false,
      })
    }
  }
  cache.set(key, events)
  return events
}

/** Trips seen by the live demo (and the seeded trip alerts), as events. */
export function outagesFromAlerts(alerts: Alert[], now: Date): OutageEvent[] {
  return alerts
    .filter((a) => a.source === 'smdb' && a.code === 'trip' && a.smdbId)
    .map((a) => {
      const end = a.resolvedAt ? new Date(a.resolvedAt) : now
      return {
        id: a.id,
        kind: 'breaker_trip' as const,
        siteId: a.siteId,
        buildingId: a.buildingId,
        smdbIds: [a.smdbId as string],
        start: a.createdAt,
        durationMin: Math.max(1, Math.round((end.getTime() - new Date(a.createdAt).getTime()) / 60_000)),
        cause: a.notes[0]?.text ?? 'Breaker trip (zero current on all phases)',
        ongoing: !a.resolvedAt,
      }
    })
}

export interface Availability {
  events: number
  /** Breaker trips only (supply interruptions are not the board's fault). */
  trips: number
  downtimeMin: number
  /** 0–100 */
  availabilityPct: number
  longestMin: number
  lastEvent?: string
}

/** Availability over a window for one board: share of minutes it had supply. */
export function boardAvailability(smdbId: string, events: OutageEvent[], windowMin: number): Availability {
  const mine = events.filter((e) => e.smdbIds.includes(smdbId))
  const downtime = mine.reduce((s, e) => s + e.durationMin, 0)
  return {
    events: mine.length,
    trips: mine.filter((e) => e.kind === 'breaker_trip').length,
    downtimeMin: downtime,
    availabilityPct: Math.max(0, 100 - (downtime / windowMin) * 100),
    longestMin: Math.max(0, ...mine.map((e) => e.durationMin)),
    lastEvent: mine.map((e) => e.start).sort().pop(),
  }
}

/** Site availability = average of its boards (every board counts equally). */
export function siteAvailability(siteId: string, events: OutageEvent[], windowMin: number): Availability {
  const boards = SMDBS.filter((b) => b.siteId === siteId)
  const per = boards.map((b) => boardAvailability(b.id, events, windowMin))
  const mine = events.filter((e) => e.siteId === siteId)
  return {
    events: mine.length,
    trips: mine.filter((e) => e.kind === 'breaker_trip').length,
    downtimeMin: mine.reduce((s, e) => s + e.durationMin, 0),
    availabilityPct: per.length ? per.reduce((s, a) => s + a.availabilityPct, 0) / per.length : 100,
    longestMin: Math.max(0, ...mine.map((e) => e.durationMin)),
    lastEvent: mine.map((e) => e.start).sort().pop(),
  }
}

export const OUTAGE_KIND_LABELS: Record<OutageKind, string> = {
  breaker_trip: 'Breaker trip',
  supply_interruption: 'Supply interruption',
}
