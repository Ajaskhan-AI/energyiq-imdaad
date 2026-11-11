import type { Role, User } from '../types'

/**
 * Every permission in the app. Components must check permissions with can(),
 * never compare role strings directly, so changing who can do what only
 * ever means editing the matrix below.
 *
 * Naming: "<area>.<action>".
 */
export const PERMISSIONS = [
  'overview.view',
  // SMDB live monitoring + alerts
  'smdb.view',
  'smdb.ackAlerts',
  'smdb.createWorkOrder',
  'smdb.editThresholds',
  'smdb.simulateFault',
  // Power quality
  'pq.view',
  // Asset health (predictive maintenance)
  'assets.view',
  'assets.act',
  // Energy analytics
  'energy.view',
  'energy.edit',
  'energy.export',
  // Billing & sub-metering
  'billing.view',
  'billing.export',
  // IoT device health
  'devices.view',
  'devices.manage',
  // Work orders
  'workorders.view',
  'workorders.update',
  // Monthly report
  'report.view',
  'report.download',
  // Admin / demo
  'users.view',
  'users.manage',
  'demo.reset',
] as const

export type Permission = (typeof PERMISSIONS)[number]

/** The permission matrix (see CLAUDE.md), one row per role. */
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  fm_manager: [
    'overview.view',
    'smdb.view', 'smdb.createWorkOrder', 'smdb.editThresholds',
    'pq.view',
    'assets.view',
    'energy.view', 'energy.export',
    'billing.view', 'billing.export',
    'devices.view',
    'workorders.view',
    'report.view', 'report.download',
    'users.view',
  ],
  energy_engineer: [
    'overview.view',
    'smdb.view', 'smdb.ackAlerts', 'smdb.createWorkOrder', 'smdb.editThresholds',
    'pq.view',
    'assets.view', 'assets.act',
    'energy.view', 'energy.edit', 'energy.export',
    'billing.view', 'billing.export',
    'devices.view',
    'workorders.view', 'workorders.update',
    'report.view', 'report.download',
  ],
  site_supervisor: [
    'overview.view',
    'smdb.view', 'smdb.ackAlerts', 'smdb.createWorkOrder',
    'pq.view',
    'assets.view', 'assets.act',
    'energy.view',
    'devices.view',
    'workorders.view', 'workorders.update',
    'report.view', 'report.download',
  ],
  client_viewer: [
    'overview.view',
    'smdb.view',
    'assets.view',
    'energy.view', 'energy.export',
    'billing.view', 'billing.export',
    'workorders.view',
    'report.view', 'report.download',
  ],
  admin: [
    'overview.view',
    'smdb.view', 'smdb.ackAlerts', 'smdb.createWorkOrder', 'smdb.editThresholds', 'smdb.simulateFault',
    'pq.view',
    'assets.view', 'assets.act',
    'energy.view', 'energy.edit', 'energy.export',
    'billing.view',
    'devices.view', 'devices.manage',
    'workorders.view',
    'report.view',
    'users.view', 'users.manage',
    'demo.reset',
  ],
}

export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role]
}

/** The one place role checks happen. Usage: can(user, 'workorders.update') */
export function can(user: User | null | undefined, permission: Permission): boolean {
  return !!user && ROLE_PERMISSIONS[user.role].includes(permission)
}

/** True if the user has at least one of the permissions (an empty list = everyone). */
export function canAny(user: User | null | undefined, permissions: readonly Permission[]): boolean {
  if (!user) return false
  return permissions.length === 0 || permissions.some((p) => can(user, p))
}

/** Which permissions open each page. Used by both the sidebar and the route guards. */
export const PAGE_ACCESS = {
  overview: ['overview.view'],
  smdb: ['smdb.view'],
  powerQuality: ['pq.view'],
  assets: ['assets.view'],
  energy: ['energy.view'],
  billing: ['billing.view'],
  devices: ['devices.view'],
  workOrders: ['workorders.view'],
  report: ['report.view'],
  howItWorks: [],
  settings: ['smdb.editThresholds', 'smdb.simulateFault', 'users.view', 'users.manage', 'demo.reset'],
} as const satisfies Record<string, readonly Permission[]>
