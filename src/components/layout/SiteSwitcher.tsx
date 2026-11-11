import { MapPin } from 'lucide-react'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { allowedSites } from '../../lib/scope'
import type { SiteFilter } from '../../types'

interface Props {
  value: SiteFilter
  onChange: (value: SiteFilter) => void
}

/**
 * Site switcher in the top bar. Lists only the sites the user may see; a
 * user with a single site sees it as a fixed label.
 */
export function SiteSwitcher({ value, onChange }: Props) {
  const user = useCurrentUser()
  const sites = allowedSites(user)

  if (sites.length <= 1) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-navy-100 px-3 py-1.5 text-sm font-medium text-navy-800">
        <MapPin className="size-4" aria-hidden />
        {sites[0]?.shortName ?? 'No site'}
      </span>
    )
  }

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Site</span>
      <MapPin className="pointer-events-none absolute left-2.5 size-4 text-navy-500" aria-hidden />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-navy-200 bg-white py-1.5 pr-8 pl-8 text-sm font-medium text-navy-800 hover:bg-navy-50 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
      >
        <option value="ALL">{user?.siteIds === 'ALL' ? `All sites (${sites.length})` : `My sites (${sites.length})`}</option>
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.shortName} · {s.area}
          </option>
        ))}
      </select>
    </label>
  )
}
