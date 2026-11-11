import type { Tone } from '../components/ui/Badge'
import { getAsset } from '../data/assets'
import { getSmdb } from '../data/smdbs'
import type { Assessment } from '../sim/predictiveModel'
import type { NewWorkOrderInput } from '../store/actions'
import type { Actor, Alert, Asset, WorkOrder, WorkOrderPriority, WorkOrderSource, WorkOrderStatus } from '../types'
import type { WastePattern } from './energyAnalysis'
import { formatNumber } from './format'

export const WO_STATUS_LABELS: Record<WorkOrderStatus, string> = { open: 'Open', in_progress: 'In progress', closed: 'Closed' }
export const WO_STATUS_TONE: Record<WorkOrderStatus, Tone> = { open: 'warn', in_progress: 'info', closed: 'ok' }
export const WO_PRIORITY_LABELS: Record<WorkOrderPriority, string> = { low: 'Low', medium: 'Medium', high: 'High' }
export const WO_PRIORITY_TONE: Record<WorkOrderPriority, Tone> = { low: 'neutral', medium: 'warn', high: 'alert' }
export const WO_SOURCE_LABELS: Record<WorkOrderSource, string> = {
  smdb_alert: 'SMDB alert',
  predictive: 'Asset health',
  energy_waste: 'Energy waste',
  device: 'IoT device',
  manual: 'Manual',
}

/** Turns an alert into a work order. */
export function workOrderFromAlert(alert: Alert, id: string, by: Actor): NewWorkOrderInput {
  const where = alert.smdbId ? getSmdb(alert.smdbId)?.name : alert.assetId ? getAsset(alert.assetId)?.name : alert.nodeId
  return {
    id,
    title: `${alert.title}${where ? ` — ${where}` : ''}`,
    description: `${alert.message} (raised from alert ${alert.id})`,
    siteId: alert.siteId,
    buildingId: alert.buildingId,
    ...(alert.smdbId ? { smdbId: alert.smdbId } : {}),
    ...(alert.assetId ? { assetId: alert.assetId } : {}),
    alertId: alert.id,
    priority: alert.severity === 'critical' ? 'high' : 'medium',
    source: alert.source === 'smdb' ? 'smdb_alert' : alert.source === 'predictive' ? 'predictive' : 'device',
    by,
  }
}

/** "Create work order" from an asset-health finding. */
export function predictiveWorkOrder(asset: Asset, a: Assessment, id: string, by: Actor, alertId?: string): NewWorkOrderInput {
  const issue = a.issue
  return {
    id,
    title: issue ? `${issue.shortAction} — ${asset.name}` : `Condition check — ${asset.name}`,
    description: issue
      ? `${issue.title} on ${asset.name} (${asset.id}), health ${a.health}/100. Recommended: ${issue.action}`
      : `Condition check on ${asset.name} (health ${a.health}/100).`,
    siteId: asset.siteId,
    buildingId: asset.buildingId,
    assetId: asset.id,
    ...(asset.smdbId ? { smdbId: asset.smdbId } : {}),
    ...(alertId ? { alertId } : {}),
    priority: a.status === 'alert' ? 'high' : 'medium',
    source: 'predictive',
    by,
  }
}

/** "Create work order" from a recurring energy-waste pattern. */
export function wasteWorkOrder(pattern: WastePattern, id: string, by: Actor): NewWorkOrderInput {
  return {
    id,
    title: pattern.title,
    description:
      `Energy Analytics: ${pattern.hint} Flagged on ${pattern.days} days between ${pattern.firstDate} and ${pattern.lastDate}, ` +
      `${formatNumber(pattern.excessKwh)} kWh above expected (≈ AED ${formatNumber(pattern.aed)}; ≈ AED ${formatNumber(pattern.annualAed)} per year if not fixed). ` +
      `Check BMS time schedules and overrides, lighting contactors / timers and any manual hand-mode switches.`,
    siteId: pattern.siteId,
    buildingId: pattern.buildingId,
    smdbId: pattern.smdbId,
    wasteFlagId: pattern.id,
    priority: pattern.annualAed > 50_000 ? 'high' : 'medium',
    source: 'energy_waste',
    by,
  }
}

/** Hours from creation to close (or to now for open work orders). */
export function workOrderAgeHours(wo: WorkOrder, now = Date.now()): number {
  const end = wo.closedAt ? new Date(wo.closedAt).getTime() : now
  return (end - new Date(wo.createdAt).getTime()) / 3_600_000
}
