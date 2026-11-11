import { SITES } from '../data/sites'
import type { Site, SiteFilter, User } from '../types'

/**
 * Site scoping, in one place. A user only ever sees the sites they are
 * assigned to (client viewers: their client's sites; supervisors: their sites).
 * The site switcher then narrows that down to one site, or 'ALL' of them.
 */

/** Ids of every site this user may see. */
export function allowedSiteIds(user: User | null | undefined): string[] {
  if (!user) return []
  return user.siteIds === 'ALL' ? SITES.map((s) => s.id) : user.siteIds
}

export function allowedSites(user: User | null | undefined): Site[] {
  const ids = new Set(allowedSiteIds(user))
  return SITES.filter((s) => ids.has(s.id))
}

/** Sites in view right now: the switcher choice, limited to what the user may see. */
export function scopedSiteIds(user: User | null | undefined, filter: SiteFilter): Set<string> {
  const allowed = allowedSiteIds(user)
  return new Set(filter === 'ALL' ? allowed : allowed.filter((id) => id === filter))
}

export function filterBySite<T extends { siteId: string }>(items: readonly T[], user: User | null | undefined, filter: SiteFilter): T[] {
  const ids = scopedSiteIds(user, filter)
  return items.filter((item) => ids.has(item.siteId))
}

/** May this user open something on this site at all (ignores the switcher)? */
export function canSeeSite(user: User | null | undefined, siteId: string): boolean {
  return allowedSiteIds(user).includes(siteId)
}

/** Label for the current switcher choice. */
export function siteFilterLabel(user: User | null | undefined, filter: SiteFilter): string {
  if (filter !== 'ALL') return SITES.find((s) => s.id === filter)?.shortName ?? filter
  const count = allowedSiteIds(user).length
  return count === SITES.length ? 'All sites' : count === 1 ? (allowedSites(user)[0]?.shortName ?? 'My site') : `My ${count} sites`
}
