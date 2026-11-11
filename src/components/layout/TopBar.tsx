import { Menu, RotateCcw } from 'lucide-react'
import type { SiteFilter } from '../../types'
import { BrandMark } from './BrandMark'
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

export function TopBar({ site, onSiteChange, onOpenMenu, onReset }: Props) {
  return (
    <header className="sticky top-0 z-20 border-b border-navy-100 bg-white/95 backdrop-blur print:hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <button type="button" onClick={onOpenMenu} className="rounded-md p-1.5 text-navy-700 hover:bg-navy-50 lg:hidden" aria-label="Open menu">
          <Menu className="size-6" />
        </button>

        <BrandMark />

        <div className="ml-auto flex flex-wrap items-center gap-3">
          {/* Wrapper controls visibility: the badge sets its own display class */}
          <div className="hidden md:block">
            <SampleBadge />
          </div>
          <SiteSwitcher value={site} onChange={onSiteChange} />
          <button
            type="button"
            onClick={onReset}
            title="Reset demo data"
            aria-label="Reset demo data"
            className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 px-3 py-1.5 text-sm font-medium text-navy-600 hover:bg-navy-50"
          >
            <RotateCcw className="size-4" aria-hidden />
            <span className="hidden 2xl:inline">Reset demo data</span>
          </button>
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
