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

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  /** Shown if the user has ANY of these (empty = everyone). Same lists guard the routes. */
  access: readonly Permission[]
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/overview', label: 'Portfolio overview', icon: LayoutDashboard, access: PAGE_ACCESS.overview },
  { path: '/smdb', label: 'SMDB live monitoring', icon: Zap, access: PAGE_ACCESS.smdb },
  { path: '/energy', label: 'Energy analytics', icon: ChartColumn, access: PAGE_ACCESS.energy },
  { path: '/power-quality', label: 'Power quality', icon: Waves, access: PAGE_ACCESS.powerQuality },
  { path: '/assets', label: 'Asset health', icon: Activity, access: PAGE_ACCESS.assets },
  { path: '/billing', label: 'Billing & sub-metering', icon: Receipt, access: PAGE_ACCESS.billing },
  { path: '/work-orders', label: 'Work orders', icon: ClipboardList, access: PAGE_ACCESS.workOrders },
  { path: '/devices', label: 'Device health', icon: Radio, access: PAGE_ACCESS.devices },
  { path: '/report', label: 'Monthly report', icon: FileText, access: PAGE_ACCESS.report },
  { path: '/how-it-works', label: 'How it works', icon: Cpu, access: PAGE_ACCESS.howItWorks },
  { path: '/settings', label: 'Settings', icon: Settings, access: PAGE_ACCESS.settings },
]
