import { Menu, RotateCcw } from 'lucide-react'
import { useLocation } from 'react-router'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shadcn/tooltip'
import type { SiteFilter } from '../../types'
import { navItemFor } from './navItems'
import { RoleSwitcher } from './RoleSwitcher'
import { SampleBadge } from './SampleBadge'
import { SiteSwitcher } from './SiteSwitcher'

interface Props {
  site: SiteFilter
  onSiteChange: (value: SiteFilter) => void
  onOpenMenu: () => void
  /** Presenter control: restore the original sample data. */
  onReset: () => void
}

/** One slim bar: where you are on the left, site / demo tools / user on the right. */
export function TopBar({ site, onSiteChange, onOpenMenu, onReset }: Props) {
  const { pathname } = useLocation()
  const current = navItemFor(pathname)
  const isDetail = !!current && pathname !== current.path

  return (
    <header className="sticky top-0 z-20 border-b border-navy-100 bg-white/90 backdrop-blur print:hidden">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button type="button" onClick={onOpenMenu} className="-ml-1 rounded-md p-1.5 text-navy-700 hover:bg-navy-50 lg:hidden" aria-label="Open menu">
          <Menu className="size-6" />
        </button>

        {/* Breadcrumb: section › page */}
        <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-2 text-sm sm:flex">
          {current && <span className="text-navy-400">{current.group}</span>}
          {current && <span className="text-navy-300">/</span>}
          <span className="truncate font-semibold text-navy-900">
            {current?.label ?? 'EnergyIQ'}
            {isDetail && <span className="font-normal text-navy-500"> · details</span>}
          </span>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Wrapper controls visibility: the badge sets its own display class */}
          <div className="hidden md:block">
            <SampleBadge />
          </div>
          <SiteSwitcher value={site} onChange={onSiteChange} />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onReset}
                aria-label="Reset demo data"
                className="inline-flex size-9 items-center justify-center rounded-md border border-navy-100 bg-white text-navy-600 hover:bg-navy-50"
              >
                <RotateCcw className="size-4" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent>Reset demo data</TooltipContent>
          </Tooltip>
          <RoleSwitcher />
        </div>
      </div>

      {/* On small screens the badge gets its own row so it is never hidden */}
      <div className="border-t border-navy-100 px-4 py-1.5 md:hidden">
        <SampleBadge />
      </div>
    </header>
  )
}
