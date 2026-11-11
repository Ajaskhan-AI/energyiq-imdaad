import type { ActionStamp, Actor } from './user'

export type AlertSource = 'smdb' | 'predictive' | 'device'
export type AlertSeverity = 'warning' | 'critical'

export interface AlertNote {
  by: Actor
  at: string
  text: string
}

export interface Alert {
  id: string // e.g. ALT-0001
  source: AlertSource
  severity: AlertSeverity
  title: string
  message: string
  siteId: string
  buildingId: string
  smdbId?: string
  assetId?: string
  nodeId?: string
  createdAt: string
  acknowledged?: ActionStamp
  notes: AlertNote[]
  /** Work order created from this alert. */
  workOrderId?: string
  /** Condition that raised it (e.g. 'trip', 'high_load'), so the simulator can auto-resolve it. */
  code?: string
  resolvedAt?: string
}
