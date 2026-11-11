import { addHours, subDays } from 'date-fns'
import { atTime } from '../lib/dates'
import type { Actor, User, WorkOrder, WorkOrderPriority, WorkOrderSource, WorkOrderStatus } from '../types'

/** Work orders raised from insights over the last month (some already closed). */
interface Row {
  id: string
  daysAgo: number
  hour: number
  title: string
  description: string
  buildingId: string
  smdbId?: string
  assetId?: string
  alertId?: string
  wasteFlagId?: string
  source: WorkOrderSource
  priority: WorkOrderPriority
  status: WorkOrderStatus
  closeAfterHours?: number
  closeRemark?: string
}

const ROWS: Row[] = [
  { id: 'WO-1001', daysAgo: 27, hour: 10, source: 'energy_waste', priority: 'medium', status: 'closed', closeAfterHours: 50, buildingId: 'PMR-B2', smdbId: 'SMDB-PMR-B2-03', title: 'Pool & gym ventilation running 24/7 — Tower B', description: 'Energy Analytics: common-area board stayed at daytime load overnight. Check ventilation fan time schedules.', closeRemark: 'Fan schedule reset to 06:00–23:00 in the BMS. Overnight load back to normal.' },
  { id: 'WO-1002', daysAgo: 22, hour: 9, source: 'smdb_alert', priority: 'medium', status: 'closed', closeAfterHours: 26, buildingId: 'WMC-B1', smdbId: 'SMDB-WMC-B1-03', alertId: 'ALT-0002', title: 'Low power factor — Medical Centre general power', description: 'Power factor 0.84 on SMDB-03. Inspect capacitor bank and controller.', closeRemark: 'Stage 2 capacitor failed — replaced. PF back to 0.95.' },
  { id: 'WO-1003', daysAgo: 18, hour: 14, source: 'smdb_alert', priority: 'high', status: 'closed', closeAfterHours: 8, buildingId: 'HBT-B2', smdbId: 'SMDB-HBT-B2-03', alertId: 'ALT-0003', title: 'Overload on F&B kitchens board', description: 'SMDB-03 reached 97% of its 400 A rating during lunch. Survey connected kitchen loads.', closeRemark: 'Unapproved fryer bank removed; tenant asked to submit a load change request.' },
  { id: 'WO-1004', daysAgo: 12, hour: 11, source: 'smdb_alert', priority: 'medium', status: 'in_progress', buildingId: 'PMR-B1', smdbId: 'SMDB-PMR-B1-02', alertId: 'ALT-0005', title: 'Rebalance apartment risers — Tower A', description: 'Phase imbalance 18% on Apartment risers. Plan redistribution of single-phase circuits between L1 and L3.' },
  { id: 'WO-1005', daysAgo: 8, hour: 9, source: 'energy_waste', priority: 'medium', status: 'open', buildingId: 'ANM-B1', smdbId: 'SMDB-ANM-B1-04', wasteFlagId: 'SMDB-ANM-B1-04:after_hours', title: 'Mall common areas lit all night', description: 'Energy Analytics: common areas & car park board stays at ~90% of its daytime load between closing (23:00) and 09:00. Check lighting contactors / timers.' },
  { id: 'WO-1006', daysAgo: 6, hour: 10, source: 'predictive', priority: 'medium', status: 'closed', closeAfterHours: 30, buildingId: 'HBT-B2', assetId: 'HBT-AHU-01', alertId: 'ALT-0007', title: 'AHU-01 filter replacement', description: 'Predictive: fan current rising above normal band — likely clogged filters.', closeRemark: 'Pre- and bag filters replaced. Current back in the normal band.' },
]

export function generateWorkOrders(users: User[], now: Date): WorkOrder[] {
  const engineer = users.find((u) => u.role === 'energy_engineer')
  const supervisor = users.find((u) => u.role === 'site_supervisor')
  const actor = (u: User | undefined): Actor => (u ? { name: u.name, role: u.role, userId: u.id } : { name: 'FM team', role: 'system' })

  return ROWS.map((row): WorkOrder => {
    const created = atTime(subDays(now, row.daysAgo), row.hour, 15)
    const history = [{ at: created.toISOString(), by: actor(engineer), text: 'Work order created' }]
    const sent = addHours(created, 1)
    history.push({ at: sent.toISOString(), by: actor(engineer), text: `Sent to CAFM as CAFM-${row.id.slice(3)}7` })
    if (row.status !== 'open') history.push({ at: addHours(created, 4).toISOString(), by: actor(supervisor), text: 'Work started on site' })
    const closedAt = row.status === 'closed' && row.closeAfterHours ? addHours(created, row.closeAfterHours) : undefined
    if (closedAt) history.push({ at: closedAt.toISOString(), by: actor(supervisor), text: `Closed: ${row.closeRemark ?? ''}` })
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      siteId: row.buildingId.slice(0, 3),
      buildingId: row.buildingId,
      ...(row.smdbId ? { smdbId: row.smdbId } : {}),
      ...(row.assetId ? { assetId: row.assetId } : {}),
      ...(row.alertId ? { alertId: row.alertId } : {}),
      ...(row.wasteFlagId ? { wasteFlagId: row.wasteFlagId } : {}),
      priority: row.priority,
      source: row.source,
      status: row.status,
      createdAt: created.toISOString(),
      createdBy: actor(engineer),
      cafmRef: `CAFM-${row.id.slice(3)}7`,
      ...(closedAt ? { closedAt: closedAt.toISOString(), closeRemark: row.closeRemark ?? '' } : {}),
      history,
    }
  })
}
