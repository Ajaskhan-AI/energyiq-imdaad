import { can } from '../auth/permissions'
import type { Tone } from '../components/ui/Badge'
import { SMDBS } from '../data/smdbs'
import type { Alert, SiteFilter, Smdb, SmdbStatus, User } from '../types'
import { filterBySite } from './scope'

export const SMDB_STATUS_LABELS: Record<SmdbStatus, string> = {
  normal: 'Normal',
  warning: 'Warning',
  critical: 'Critical',
  tripped: 'Tripped',
  offline: 'No data',
}

export const SMDB_STATUS_TONE: Record<SmdbStatus, Tone> = {
  normal: 'ok',
  warning: 'warn',
  critical: 'alert',
  tripped: 'alert',
  offline: 'neutral',
}

const RANK: Record<SmdbStatus, number> = { normal: 0, offline: 1, warning: 2, critical: 3, tripped: 4 }

export function worstStatus(statuses: SmdbStatus[]): SmdbStatus {
  return statuses.reduce<SmdbStatus>((worst, s) => (RANK[s] > RANK[worst] ? s : worst), 'normal')
}

/** Boards the user may see under the current site switcher. */
export function visibleSmdbs(user: User | null, site: SiteFilter): Smdb[] {
  if (!can(user, 'smdb.view')) return []
  return filterBySite(SMDBS, user, site)
}

/** Can this user acknowledge / note / raise a work order from this alert? */
export function alertPermissions(user: User | null, alert: Alert) {
  const act = alert.source === 'predictive' ? can(user, 'assets.act') : can(user, 'smdb.ackAlerts')
  return { acknowledge: act, note: act, workOrder: can(user, 'smdb.createWorkOrder') }
}
