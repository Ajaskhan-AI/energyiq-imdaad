import { addHours, addMinutes, subDays } from 'date-fns'
import { atTime } from '../lib/dates'
import type { Alert, AlertSeverity, AlertSource, User } from '../types'

/** Historical, already-handled alerts from the last month (live ones come from the simulator). */
interface AlertRow {
  daysAgo: number
  hour: number
  source: AlertSource
  severity: AlertSeverity
  title: string
  message: string
  buildingId: string
  smdbId?: string
  assetId?: string
  nodeId?: string
  code?: string
  note?: string
  workOrderId?: string
  /** Minutes until the condition cleared (default: a few hours). */
  resolveMinutes?: number
}

const ROWS: AlertRow[] = [
  { daysAgo: 26, hour: 15, source: 'smdb', severity: 'warning', smdbId: 'SMDB-ANM-B1-01', buildingId: 'ANM-B1', title: 'High load — 87% of rating', message: 'Load on the mall HVAC plant board exceeded the 80% warning threshold in the afternoon peak.' },
  { daysAgo: 22, hour: 9, source: 'smdb', severity: 'warning', smdbId: 'SMDB-WMC-B1-03', buildingId: 'WMC-B1', title: 'Low power factor — 0.84', message: 'Power factor on General power & lighting dropped below the 0.90 limit. DEWA may apply low-PF charges.', note: 'Capacitor bank stage 2 found failed — replaced.', workOrderId: 'WO-1002' },
  { daysAgo: 18, hour: 14, source: 'smdb', severity: 'critical', smdbId: 'SMDB-HBT-B2-03', buildingId: 'HBT-B2', title: 'Overload — 97% of rating', message: 'Load on F&B kitchens exceeded the 95% critical threshold during lunch service.', note: 'New tenant kitchen equipment added without load approval — referred to leasing.', workOrderId: 'WO-1003' },
  { daysAgo: 15, hour: 3, source: 'device', severity: 'warning', nodeId: 'KAI-N-0003', buildingId: 'HBT-B2', title: 'IoT node offline', message: 'No data from node KAI-N-0003 (basement car park) for 30 minutes.', note: 'Antenna moved to the ramp ceiling — signal restored.' },
  { daysAgo: 12, hour: 11, source: 'smdb', severity: 'warning', smdbId: 'SMDB-PMR-B1-02', buildingId: 'PMR-B1', title: 'Phase imbalance 18%', message: 'Current imbalance between L1 and L3 above the 15% limit on Apartment risers.', workOrderId: 'WO-1004' },
  { daysAgo: 9, hour: 6, source: 'smdb', severity: 'critical', smdbId: 'SMDB-DLH-B1-02', buildingId: 'DLH-B1', title: 'SMDB tripped — zero current', message: 'All phase currents dropped to zero on Warehouse lighting & MHE charging.', note: 'Charger rectifier fault — isolated, breaker reset.', code: 'trip', resolveMinutes: 42 },
  { daysAgo: 6, hour: 10, source: 'predictive', severity: 'warning', assetId: 'HBT-AHU-01', buildingId: 'HBT-B2', title: 'Rising motor current — possible filter clogging', message: 'Fan motor current trending above its normal band for 5 days.', note: 'Filters replaced.', workOrderId: 'WO-1006' },
  { daysAgo: 3, hour: 16, source: 'smdb', severity: 'warning', smdbId: 'SMDB-PMR-B2-03', buildingId: 'PMR-B2', title: 'Low voltage — 204 V on L2', message: 'Phase L2 voltage below the −10% tolerance band.' },
]

export function generateAlerts(users: User[], now: Date): Alert[] {
  const engineer = users.find((u) => u.role === 'energy_engineer')
  const by = engineer ? { name: engineer.name, role: engineer.role, userId: engineer.id } : { name: 'FM team', role: 'system' as const }

  return ROWS.map((row, i): Alert => {
    const created = addMinutes(atTime(subDays(now, row.daysAgo), row.hour), 7 * i)
    const acknowledgedAt = addMinutes(created, 6 + i * 3)
    return {
      id: `ALT-${String(i + 1).padStart(4, '0')}`,
      source: row.source,
      severity: row.severity,
      title: row.title,
      message: row.message,
      siteId: row.buildingId.slice(0, 3),
      buildingId: row.buildingId,
      ...(row.smdbId ? { smdbId: row.smdbId } : {}),
      ...(row.assetId ? { assetId: row.assetId } : {}),
      ...(row.nodeId ? { nodeId: row.nodeId } : {}),
      ...(row.workOrderId ? { workOrderId: row.workOrderId } : {}),
      ...(row.code ? { code: row.code } : {}),
      createdAt: created.toISOString(),
      acknowledged: { by, at: acknowledgedAt.toISOString() },
      notes: row.note ? [{ by, at: addMinutes(acknowledgedAt, 20).toISOString(), text: row.note }] : [],
      resolvedAt: (row.resolveMinutes ? addMinutes(created, row.resolveMinutes) : addHours(created, 3 + i)).toISOString(),
    }
  })
}
