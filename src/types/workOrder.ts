import type { Actor } from './user'

export type WorkOrderStatus = 'open' | 'in_progress' | 'closed'
export type WorkOrderPriority = 'low' | 'medium' | 'high'
/** What raised it. */
export type WorkOrderSource = 'smdb_alert' | 'predictive' | 'energy_waste' | 'device' | 'manual'

export interface WorkOrderEvent {
  at: string
  by: Actor
  text: string
}

/**
 * A work order raised from an insight. In a real roll-out it is handed over to
 * Imdaad's own CAFM / helpdesk system ("Send to CAFM"); in the demo it is kept locally.
 */
export interface WorkOrder {
  id: string // e.g. WO-1001
  title: string
  description: string
  siteId: string
  buildingId: string
  smdbId?: string
  assetId?: string
  alertId?: string
  /** Id of the energy-waste flag it was raised from. */
  wasteFlagId?: string
  priority: WorkOrderPriority
  source: WorkOrderSource
  status: WorkOrderStatus
  createdAt: string
  createdBy: Actor
  /** Reference returned when sent to the CAFM system (simulated). */
  cafmRef?: string
  closedAt?: string
  closeRemark?: string
  history: WorkOrderEvent[]
}
