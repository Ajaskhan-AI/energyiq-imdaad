import { buildSeed } from '../data/seed'
import type { ActionStamp, Alert, CalendarPeriod, SiteFilter, SmdbThresholds, User, WorkOrder } from '../types'

/**
 * Everything users can change during the demo. Saved to localStorage and
 * restored by "Reset demo data". Fixed reference data (sites, SMDB list, assets)
 * and generated history (energy) live in src/data and are not stored here.
 */
export interface AppData {
  users: User[]
  alerts: Alert[]
  workOrders: WorkOrder[]
  /** Per-SMDB alarm thresholds, keyed by SMDB id. */
  thresholds: Record<string, SmdbThresholds>
  /** Operating calendar (holidays, Ramadan, shutdowns, events). */
  calendar: CalendarPeriod[]
  /** Predictive maintenance: assets marked resolved (health resets from this moment). */
  predictiveResets: Record<string, ActionStamp>
  /** Energy waste flags marked "reviewed". */
  reviewedWasteIds: string[]
  /** Next number for new IDs (WO-xxxx, ALT-xxxx). */
  counters: { workOrder: number; alert: number }
}

export interface AppState extends AppData {
  /** Bump when the shape changes: old saved data is then ignored and re-seeded. */
  version: number
  seededAt: string
  currentUserId: string | null
  /** Site switcher: a site id, or 'ALL' = every site the user may see. */
  site: SiteFilter
}

// v10: Imdaad EnergyIQ data model (sites instead of campuses). Older saved data is re-seeded.
export const STATE_VERSION = 10

export function createInitialState(now: Date): AppState {
  return {
    version: STATE_VERSION,
    seededAt: now.toISOString(),
    currentUserId: null,
    site: 'ALL',
    ...buildSeed(now),
  }
}
