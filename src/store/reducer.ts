import { allowedSiteIds } from '../lib/scope'
import type { Alert, WorkOrder, WorkOrderEvent } from '../types'
import type { Action } from './actions'
import { STATE_VERSION, type AppState } from './state'

/** Apply `update` to each alert (null = unchanged); returns the same state if nothing changed. */
function updateAlerts(state: AppState, update: (alert: Alert) => Alert | null): AppState {
  let changed = false
  const alerts = state.alerts.map((alert) => {
    const next = update(alert)
    if (!next) return alert
    changed = true
    return next
  })
  return changed ? { ...state, alerts } : state
}

/** Replace one work order by id using `update`; returns the same state if nothing changed. */
function updateWorkOrder(state: AppState, id: string, update: (wo: WorkOrder) => WorkOrder | null): AppState {
  let changed = false
  const workOrders = state.workOrders.map((wo) => {
    if (wo.id !== id) return wo
    const next = update(wo)
    if (!next) return wo
    changed = true
    return next
  })
  return changed ? { ...state, workOrders } : state
}

const withEvent = (wo: WorkOrder, event: WorkOrderEvent): WorkOrderEvent[] => [...wo.history, event]

/**
 * A reducer takes the current state + an action and returns the NEW state.
 * It must not mutate the old state (always return new objects), so React can
 * see that something changed and re-render.
 */
export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'RESET_DEMO':
      // Fresh data, logged out ("Reset demo data" logs out too).
      return { version: STATE_VERSION, seededAt: action.at, currentUserId: null, site: 'ALL', ...action.data }

    case 'SET_SITE': {
      // Site scoping: a user can only switch between the sites they may see.
      const user = state.users.find((u) => u.id === state.currentUserId)
      if (action.site !== 'ALL' && !allowedSiteIds(user).includes(action.site)) return state
      return { ...state, site: action.site }
    }

    case 'LOGIN': {
      const user = state.users.find((u) => u.id === action.userId)
      if (!user) return state
      return { ...state, currentUserId: user.id, site: 'ALL' }
    }

    case 'SAVE_USER': {
      const exists = state.users.some((u) => u.id === action.user.id)
      const users = exists ? state.users.map((u) => (u.id === action.user.id ? action.user : u)) : [...state.users, action.user]
      // Editing the logged-in user's sites re-applies scoping straight away.
      const site = action.user.id === state.currentUserId ? 'ALL' : state.site
      return { ...state, users, site }
    }

    case 'LOGOUT':
      return { ...state, currentUserId: null, site: 'ALL' }

    // ---------- Alerts & thresholds ----------

    case 'RAISE_ALERTS': {
      if (action.alerts.length === 0) return state
      // The reducer hands out the ALT-xxxx numbers, so they never clash.
      const created = action.alerts.map((alert, i) => ({ id: `ALT-${String(state.counters.alert + i).padStart(4, '0')}`, ...alert }))
      return {
        ...state,
        alerts: [...state.alerts, ...created],
        counters: { ...state.counters, alert: state.counters.alert + created.length },
      }
    }

    case 'RESOLVE_ALERTS':
      return updateAlerts(state, (alert) => (action.alertIds.includes(alert.id) && !alert.resolvedAt ? { ...alert, resolvedAt: action.at } : null))

    case 'ACK_ALERT':
      return updateAlerts(state, (alert) =>
        alert.id === action.alertId && !alert.acknowledged ? { ...alert, acknowledged: { by: action.by, at: action.at } } : null,
      )

    case 'ADD_ALERT_NOTE':
      return updateAlerts(state, (alert) =>
        alert.id === action.alertId && action.text ? { ...alert, notes: [...alert.notes, { by: action.by, at: action.at, text: action.text }] } : null,
      )

    case 'SET_THRESHOLDS':
      return { ...state, thresholds: { ...state.thresholds, [action.smdbId]: action.thresholds } }

    // ---------- Work orders ----------

    case 'CREATE_WORK_ORDER': {
      const wo = action.workOrder
      if (state.workOrders.some((w) => w.id === wo.id)) return state
      const number = Number(wo.id.replace(/\D/g, ''))
      // Link the alert back to its work order.
      const withLink = wo.alertId
        ? updateAlerts(state, (a) => (a.id === wo.alertId && !a.workOrderId ? { ...a, workOrderId: wo.id } : null))
        : state
      return {
        ...withLink,
        workOrders: [...state.workOrders, wo],
        counters: { ...state.counters, workOrder: Math.max(state.counters.workOrder, number + 1) },
      }
    }

    case 'SEND_WORK_ORDER_TO_CAFM':
      return updateWorkOrder(state, action.workOrderId, (wo) =>
        wo.cafmRef ? null : { ...wo, cafmRef: action.cafmRef, history: withEvent(wo, { at: action.at, by: action.by, text: `Sent to CAFM as ${action.cafmRef}` }) },
      )

    case 'START_WORK_ORDER':
      return updateWorkOrder(state, action.workOrderId, (wo) =>
        wo.status !== 'open' ? null : { ...wo, status: 'in_progress', history: withEvent(wo, { at: action.at, by: action.by, text: 'Work started on site' }) },
      )

    case 'CLOSE_WORK_ORDER':
      return updateWorkOrder(state, action.workOrderId, (wo) =>
        wo.status === 'closed' || !action.remark
          ? null
          : {
              ...wo,
              status: 'closed',
              closedAt: action.at,
              closeRemark: action.remark,
              history: withEvent(wo, { at: action.at, by: action.by, text: `Closed: ${action.remark}` }),
            },
      )

    case 'ADD_WORK_ORDER_NOTE':
      return updateWorkOrder(state, action.workOrderId, (wo) =>
        !action.text ? null : { ...wo, history: withEvent(wo, { at: action.at, by: action.by, text: action.text }) },
      )

    // ---------- Predictive ----------

    case 'RESOLVE_PREDICTIVE':
      return { ...state, predictiveResets: { ...state.predictiveResets, [action.assetId]: { by: action.by, at: action.at } } }

    // ---------- Energy: calendar & waste review ----------

    case 'SAVE_PERIOD': {
      const exists = state.calendar.some((p) => p.id === action.period.id)
      const calendar = exists ? state.calendar.map((p) => (p.id === action.period.id ? action.period : p)) : [...state.calendar, action.period]
      return { ...state, calendar: calendar.sort((a, b) => a.start.localeCompare(b.start)) }
    }

    case 'DELETE_PERIOD':
      return { ...state, calendar: state.calendar.filter((p) => p.id !== action.periodId) }

    case 'SET_WASTE_REVIEWED': {
      const has = state.reviewedWasteIds.includes(action.flagId)
      if (has === action.reviewed) return state
      return {
        ...state,
        reviewedWasteIds: action.reviewed ? [...state.reviewedWasteIds, action.flagId] : state.reviewedWasteIds.filter((id) => id !== action.flagId),
      }
    }

    default: {
      // If a new action type is added but not handled, TypeScript errors here.
      const unhandled: never = action
      return unhandled
    }
  }
}
