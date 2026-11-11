import clsx from 'clsx'
import { Building2, X } from 'lucide-react'
import { NavLink } from 'react-router'
import { canAny } from '../../auth/permissions'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { NAV_ITEMS } from './navItems'

interface Props {
  /** Only used on small screens, where the sidebar slides in over the page. */
  mobileOpen: boolean
  onClose: () => void
}

export function Sidebar({ mobileOpen, onClose }: Props) {
  const user = useCurrentUser()
  // Only show modules this role can open (same permission lists as the routes).
  const items = NAV_ITEMS.filter((item) => canAny(user, item.access))

  return (
    <>
      {/* Dark backdrop behind the sidebar on phones/tablets */}
      <div
        className={clsx(
          'fixed inset-0 z-30 bg-navy-950/50 lg:hidden',
          mobileOpen ? 'block' : 'hidden',
        )}
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col print:hidden bg-navy-900 text-navy-100 transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-3 border-b border-navy-800 px-5 py-5">
          <div className="flex size-10 items-center justify-center rounded-lg bg-teal-500/15 text-teal-300">
            <Building2 className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">EnergyIQ for FM</p>
            <p className="truncate text-xs text-navy-300">Prepared for Imdaad</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-navy-300 hover:bg-navy-800 lg:hidden"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors',
                  isActive
                    ? 'bg-teal-500/15 text-teal-200 ring-1 ring-teal-400/30'
                    : 'text-navy-200 hover:bg-navy-800 hover:text-white',
                )
              }
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-navy-800 px-5 py-4 text-xs text-navy-400">
          Powered by <span className="font-semibold text-navy-200">Kuroshio AI</span> · Selec meters + Kuroshio IoT
        </div>
      </aside>
    </>
  )
}
