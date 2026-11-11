import {
  Activity,
  ChartColumn,
  ClipboardList,
  Cpu,
  FileText,
  LayoutDashboard,
  Radio,
  Receipt,
  Settings,
  Waves,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { PAGE_ACCESS } from '../../auth/permissions'
import type { Permission } from '../../types'

export type NavGroup = 'Monitor' | 'Analyse' | 'Operate' | 'More'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  group: NavGroup
  /** Shown if the user has ANY of these (empty = everyone). Same lists guard the routes. */
  access: readonly Permission[]
  /** Live count shown next to the item (calculated in the sidebar). */
  badge?: 'alerts' | 'offlineNodes' | 'openWorkOrders'
}

export const NAV_GROUPS: NavGroup[] = ['Monitor', 'Analyse', 'Operate', 'More']

export const NAV_ITEMS: NavItem[] = [
  { path: '/overview', label: 'Portfolio overview', icon: LayoutDashboard, group: 'Monitor', access: PAGE_ACCESS.overview },
  { path: '/smdb', label: 'SMDB live monitoring', icon: Zap, group: 'Monitor', access: PAGE_ACCESS.smdb, badge: 'alerts' },
  { path: '/devices', label: 'Device health', icon: Radio, group: 'Monitor', access: PAGE_ACCESS.devices, badge: 'offlineNodes' },
  { path: '/energy', label: 'Energy analytics', icon: ChartColumn, group: 'Analyse', access: PAGE_ACCESS.energy },
  { path: '/power-quality', label: 'Power quality', icon: Waves, group: 'Analyse', access: PAGE_ACCESS.powerQuality },
  { path: '/assets', label: 'Asset health', icon: Activity, group: 'Analyse', access: PAGE_ACCESS.assets },
  { path: '/work-orders', label: 'Work orders', icon: ClipboardList, group: 'Operate', access: PAGE_ACCESS.workOrders, badge: 'openWorkOrders' },
  { path: '/billing', label: 'Billing & sub-metering', icon: Receipt, group: 'Operate', access: PAGE_ACCESS.billing },
  { path: '/report', label: 'Monthly report', icon: FileText, group: 'Operate', access: PAGE_ACCESS.report },
  { path: '/how-it-works', label: 'How it works', icon: Cpu, group: 'More', access: PAGE_ACCESS.howItWorks },
  { path: '/settings', label: 'Settings', icon: Settings, group: 'More', access: PAGE_ACCESS.settings },
]

/** The nav item a URL belongs to (e.g. /smdb/SMDB-HBT-B1-01 → SMDB live monitoring). */
export function navItemFor(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
}
