import type { Role } from '../types'

export const ROLE_LABELS: Record<Role, string> = {
  fm_manager: 'FM Operations Manager',
  energy_engineer: 'Energy & MEP Engineer',
  site_supervisor: 'Site Supervisor',
  client_viewer: 'Client (building owner)',
  admin: 'System Admin',
}

/** Where each role lands after logging in. */
export const ROLE_HOME: Record<Role, string> = {
  fm_manager: '/overview',
  energy_engineer: '/energy',
  site_supervisor: '/smdb',
  client_viewer: '/overview',
  admin: '/devices',
}

/** Avatar colours per role (full class names so Tailwind can find them). */
export const ROLE_AVATAR: Record<Role, string> = {
  fm_manager: 'bg-navy-800 text-white',
  energy_engineer: 'bg-teal-600 text-white',
  site_supervisor: 'bg-amber-500 text-white',
  client_viewer: 'bg-sky-600 text-white',
  admin: 'bg-slate-600 text-white',
}

/** Order used on the login screen and in the role switcher. */
export const ROLE_ORDER: Role[] = ['fm_manager', 'energy_engineer', 'site_supervisor', 'client_viewer', 'admin']
