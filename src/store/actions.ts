import { buildSeed } from '../data/seed'
import type { Actor, Alert, CalendarPeriod, SiteFilter, SmdbThresholds, User, WorkOrder, WorkOrderPriority, WorkOrderSource } from '../types'
import type { AppData } from './state'

/**
 * Every change to the store is described by one of these "actions".
 * Components call dispatch(action); the reducer decides the new state.
 */
export type Action =
  | { type: 'RESET_DEMO'; data: AppData; at: string }
  | { type: 'SET_SITE'; site: SiteFilter }
  | { type: 'LOGIN'; userId: string }
  | { type: 'LOGOUT' }
  | { type: 'SAVE_USER'; user: User }
  // Alerts & thresholds
  | { type: 'RAISE_ALERTS'; alerts: Array<Omit<Alert, 'id'>> }
  | { type: 'RESOLVE_ALERTS'; alertIds: string[]; at: string }
  | { type: 'ACK_ALERT'; alertId: string; by: Actor; at: string }
  | { type: 'ADD_ALERT_NOTE'; alertId: string; text: string; by: Actor; at: string }
  | { type: 'SET_THRESHOLDS'; smdbId: string; thresholds: SmdbThresholds }
  // Work orders
  | { type: 'CREATE_WORK_ORDER'; workOrder: WorkOrder }
  | { type: 'SEND_WORK_ORDER_TO_CAFM'; workOrderId: string; cafmRef: string; by: Actor; at: string }
  | { type: 'START_WORK_ORDER'; workOrderId: string; by: Actor; at: string }
  | { type: 'CLOSE_WORK_ORDER'; workOrderId: string; remark: string; by: Actor; at: string }
  | { type: 'ADD_WORK_ORDER_NOTE'; workOrderId: string; text: string; by: Actor; at: string }
  // Predictive maintenance
  | { type: 'RESOLVE_PREDICTIVE'; assetId: string; by: Actor; at: string }
  // Energy analytics: calendar & waste flags
  | { type: 'SAVE_PERIOD'; period: CalendarPeriod }
  | { type: 'DELETE_PERIOD'; periodId: string }
  | { type: 'SET_WASTE_REVIEWED'; flagId: string; reviewed: boolean }
  // Budgets
  | { type: 'SET_BUDGET'; siteId: string; aed: number | null }

export interface NewWorkOrderInput {
  /** Number to use, e.g. `WO-${state.counters.workOrder}` (so the UI can show it straight away). */
  id: string
  title: string
  description: string
  siteId: string
  buildingId: string
  smdbId?: string
  assetId?: string
  alertId?: string
  wasteFlagId?: string
  priority: WorkOrderPriority
  source: WorkOrderSource
  by: Actor
}

const now = () => new Date().toISOString()

/** Copies only the optional fields that have a value (keeps saved data tidy). */
function defined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>
}

/** Action creators: small helpers so components don't build action objects by hand. */
export const actions = {
  /** Builds fresh seed data here (not in the reducer) so the reducer stays pure. */
  resetDemo(): Action {
    const at = new Date()
    return { type: 'RESET_DEMO', data: buildSeed(at), at: at.toISOString() }
  },
  setSite(site: SiteFilter): Action {
    return { type: 'SET_SITE', site }
  },
  /** Demo login: no password, just pick a user (also used by "Switch role"). */
  login(userId: string): Action {
    return { type: 'LOGIN', userId }
  },
  logout(): Action {
    return { type: 'LOGOUT' }
  },
  /** Users & Roles: add a demo user or update one (matched by id). */
  saveUser(user: User): Action {
    return { type: 'SAVE_USER', user }
  },

  raiseAlerts(alerts: Array<Omit<Alert, 'id'>>): Action {
    return { type: 'RAISE_ALERTS', alerts }
  },
  resolveAlerts(alertIds: string[]): Action {
    return { type: 'RESOLVE_ALERTS', alertIds, at: now() }
  },
  acknowledgeAlert(alertId: string, by: Actor): Action {
    return { type: 'ACK_ALERT', alertId, by, at: now() }
  },
  addAlertNote(alertId: string, text: string, by: Actor): Action {
    return { type: 'ADD_ALERT_NOTE', alertId, text: text.trim(), by, at: now() }
  },
  setThresholds(smdbId: string, thresholds: SmdbThresholds): Action {
    return { type: 'SET_THRESHOLDS', smdbId, thresholds }
  },

  createWorkOrder(input: NewWorkOrderInput): Action {
    const at = now()
    const { id, by, ...rest } = input
    const workOrder: WorkOrder = {
      id,
      ...defined({ smdbId: rest.smdbId, assetId: rest.assetId, alertId: rest.alertId, wasteFlagId: rest.wasteFlagId }),
      title: rest.title.trim(),
      description: rest.description.trim(),
      siteId: rest.siteId,
      buildingId: rest.buildingId,
      priority: rest.priority,
      source: rest.source,
      status: 'open',
      createdAt: at,
      createdBy: by,
      history: [{ at, by, text: 'Work order created' }],
    }
    return { type: 'CREATE_WORK_ORDER', workOrder }
  },
  /** Simulated hand-over to Imdaad's CAFM system: we just record a reference number. */
  sendToCafm(workOrderId: string, by: Actor): Action {
    const cafmRef = `CAFM-${Math.floor(100000 + Math.random() * 900000)}`
    return { type: 'SEND_WORK_ORDER_TO_CAFM', workOrderId, cafmRef, by, at: now() }
  },
  startWorkOrder(workOrderId: string, by: Actor): Action {
    return { type: 'START_WORK_ORDER', workOrderId, by, at: now() }
  },
  closeWorkOrder(workOrderId: string, remark: string, by: Actor): Action {
    return { type: 'CLOSE_WORK_ORDER', workOrderId, remark: remark.trim(), by, at: now() }
  },
  addWorkOrderNote(workOrderId: string, text: string, by: Actor): Action {
    return { type: 'ADD_WORK_ORDER_NOTE', workOrderId, text: text.trim(), by, at: now() }
  },

  /** "Mark as resolved": the asset's health resets from now. */
  resolvePredictive(assetId: string, by: Actor): Action {
    return { type: 'RESOLVE_PREDICTIVE', assetId, by, at: now() }
  },
  /** Add a new period or update an existing one (matched by id). */
  savePeriod(period: CalendarPeriod): Action {
    return { type: 'SAVE_PERIOD', period }
  },
  deletePeriod(periodId: string): Action {
    return { type: 'DELETE_PERIOD', periodId }
  },
  /** Set a site's monthly budget (AED); null goes back to the default budget. */
  setBudget(siteId: string, aed: number | null): Action {
    return { type: 'SET_BUDGET', siteId, aed }
  },
  setWasteReviewed(flagId: string, reviewed: boolean): Action {
    return { type: 'SET_WASTE_REVIEWED', flagId, reviewed }
  },
}
