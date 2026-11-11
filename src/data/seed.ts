import type { AppData } from '../store/state'
import { generateAlerts } from './alerts'
import { SEED_CALENDAR } from './calendar'
import { DEFAULT_THRESHOLDS, SMDBS } from './smdbs'
import { SEED_USERS } from './users'
import { generateWorkOrders } from './workOrders'

/**
 * Builds the full editable demo dataset, relative to `now` so dates always look
 * current in the meeting. "Reset demo data" calls this again.
 */
export function buildSeed(now: Date): AppData {
  // structuredClone: give the store its own copies, so edits never touch the constants.
  const users = structuredClone(SEED_USERS)
  const alerts = generateAlerts(users, now)
  const workOrders = generateWorkOrders(users, now)

  return {
    users,
    alerts,
    workOrders,
    thresholds: Object.fromEntries(SMDBS.map((s) => [s.id, { ...DEFAULT_THRESHOLDS }])),
    calendar: structuredClone(SEED_CALENDAR),
    predictiveResets: {},
    reviewedWasteIds: [],
    counters: {
      workOrder: 1001 + workOrders.length,
      alert: alerts.length + 1,
    },
  }
}
