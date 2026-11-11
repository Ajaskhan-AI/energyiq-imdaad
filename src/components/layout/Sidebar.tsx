import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { NavLink } from 'react-router'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shadcn/tooltip'
import { cn } from '@/lib/utils'
import { can, canAny } from '../../auth/permissions'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { filterBySite } from '../../lib/scope'
import { useSimulator } from '../../sim/simulatorContext'
import { useAppState } from '../../store/hooks'
import { KuroshioLogo } from './BrandMark'
import { NAV_GROUPS, NAV_ITEMS, type NavItem } from './navItems'

interface Props {
  /** Phones/tablets: the sidebar slides in over the page. */
  mobileOpen: boolean
  onClose: () => void
  /** Desktop: icon-only mode, to give charts more room. */
  collapsed: boolean
  onToggleCollapsed: () => void
}

/** Live numbers shown as small badges next to some menu items. */
function useBadges(): Record<NonNullable<NavItem['badge']>, number> {
  const state = useAppState()
  const user = useCurrentUser()
  const sim = useSimulator()
  const alerts = filterBySite(state.alerts, user, state.site).filter((a) => !a.resolvedAt && (a.source !== 'device' || can(user, 'devices.view')))
  const nodes = filterBySite(
    sim.nodes.map((n) => ({ ...n, siteId: n.node.siteId })),
    user,
    state.site,
  )
  return {
    alerts: alerts.length,
    offlineNodes: nodes.filter((n) => n.status === 'offline').length,
    openWorkOrders: filterBySite(state.workOrders, user, state.site).filter((w) => w.status !== 'closed').length,
  }
}

export function Sidebar({ mobileOpen, onClose, collapsed, onToggleCollapsed }: Props) {
  const user = useCurrentUser()
  const badges = useBadges()
  // Only show modules this role can open (same permission lists as the routes).
  const items = NAV_ITEMS.filter((item) => canAny(user, item.access))
  // Collapsing only applies on large screens; the mobile drawer is always full width.
  const mini = collapsed && !mobileOpen

  return (
    <>
      {/* Dark backdrop behind the drawer on phones/tablets */}
      <div className={cn('fixed inset-0 z-30 bg-navy-950/50 lg:hidden', mobileOpen ? 'block' : 'hidden')} onClick={onClose} aria-hidden />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy-950 text-navy-100 transition-[width,transform] duration-200 print:hidden lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          mini && 'lg:w-[4.5rem]',
        )}
      >
        {/* Brand */}
        <div className={cn('flex h-16 items-center gap-3 border-b border-white/10 px-4', mini && 'lg:justify-center lg:px-0')}>
          <KuroshioLogo white className="h-8" />
          <div className={cn('min-w-0 flex-1', mini && 'lg:hidden')}>
            <p className="truncate text-sm font-bold text-white">
              EnergyIQ <span className="font-medium text-navy-300">by Kuroshio AI</span>
            </p>
            <p className="truncate text-xs text-teal-300">Prepared for Imdaad</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-navy-300 hover:bg-white/10 lg:hidden" aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>

        {/* Menu, grouped */}
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
          {NAV_GROUPS.map((group) => {
            const groupItems = items.filter((i) => i.group === group)
            if (!groupItems.length) return null
            return (
              <div key={group} className="mb-5 last:mb-0">
                <p className={cn('mb-1.5 px-3 text-[11px] font-semibold tracking-widest text-navy-400 uppercase', mini && 'lg:sr-only')}>{group}</p>
                <ul className="space-y-0.5">
                  {groupItems.map((item) => (
                    <li key={item.path}>
                      <NavItemLink item={item} count={item.badge ? badges[item.badge] : 0} mini={mini} onNavigate={onClose} />
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </nav>

        {/* Footer: collapse toggle (desktop) */}
        <div className={cn('flex items-center gap-2 border-t border-white/10 px-4 py-3', mini && 'lg:justify-center lg:px-0')}>
          <p className={cn('min-w-0 flex-1 truncate text-xs text-navy-400', mini && 'lg:hidden')}>Selec meters + Kuroshio IoT</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="hidden rounded-md p-1.5 text-navy-300 hover:bg-white/10 hover:text-white lg:inline-flex"
                aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
              >
                {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{collapsed ? 'Expand menu' : 'Collapse menu'}</TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </>
  )
}

function NavItemLink({ item, count, mini, onNavigate }: { item: NavItem; count: number; mini: boolean; onNavigate: () => void }) {
  const Icon = item.icon
  const alertTone = item.badge === 'alerts' || item.badge === 'offlineNodes'
  const link = (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive ? 'bg-white/10 text-white' : 'text-navy-200 hover:bg-white/5 hover:text-white',
          mini && 'lg:justify-center lg:px-0',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Teal marker on the active page */}
          <span className={cn('absolute top-1.5 bottom-1.5 left-0 w-1 rounded-r-full bg-teal-400 transition-opacity', isActive ? 'opacity-100' : 'opacity-0')} aria-hidden />
          <Icon className={cn('size-[18px] shrink-0', isActive ? 'text-teal-300' : 'text-navy-300 group-hover:text-white')} aria-hidden />
          <span className={cn('min-w-0 flex-1 truncate', mini && 'lg:hidden')}>{item.label}</span>
          {count > 0 && (
            <span
              className={cn(
                'rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums',
                alertTone ? 'bg-red-500 text-white' : 'bg-amber-400 text-navy-950',
                mini && 'lg:absolute lg:top-0.5 lg:right-1.5 lg:px-1',
              )}
            >
              {count}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
  if (!mini) return link
  // Icon-only mode: show the name on hover.
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">
        {item.label}
        {count > 0 && ` · ${count}`}
      </TooltipContent>
    </Tooltip>
  )
}
