import { MapPin } from 'lucide-react'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/shadcn/select'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { CLIENTS } from '../../data/sites'
import { allowedSites } from '../../lib/scope'
import type { SiteFilter } from '../../types'

interface Props {
  value: SiteFilter
  onChange: (value: SiteFilter) => void
}

/**
 * Site switcher in the top bar. Lists only the sites the user may see,
 * grouped by client; a user with a single site sees it as a fixed label.
 */
export function SiteSwitcher({ value, onChange }: Props) {
  const user = useCurrentUser()
  const sites = allowedSites(user)

  if (sites.length <= 1) {
    return (
      <span className="inline-flex h-9 items-center gap-1.5 rounded-md border border-navy-100 bg-navy-50 px-3 text-sm font-medium text-navy-800">
        <MapPin className="size-4 text-navy-500" aria-hidden />
        {sites[0]?.shortName ?? 'No site'}
      </span>
    )
  }

  const clients = CLIENTS.filter((c) => sites.some((s) => s.clientId === c.id))
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label="Site" className="h-9 w-[13.5rem] bg-white">
        <MapPin className="text-navy-500" aria-hidden />
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="end" className="w-72">
        <SelectItem value="ALL">{user?.siteIds === 'ALL' ? `All sites (${sites.length})` : `My sites (${sites.length})`}</SelectItem>
        {clients.map((c) => (
          <SelectGroup key={c.id}>
            <SelectSeparator />
            <SelectLabel className="text-xs text-navy-400">{c.name}</SelectLabel>
            {sites
              .filter((s) => s.clientId === c.id)
              .map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.shortName}
                  <span className="text-muted-foreground"> · {s.area}</span>
                </SelectItem>
              ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
