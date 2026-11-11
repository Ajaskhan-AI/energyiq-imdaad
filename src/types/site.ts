/**
 * Portfolio structure: Imdaad (the FM company) manages sites for several
 * clients. Client → Site → Building → SMDB → IoT node.
 * All clients and sites are fictional demo data.
 */

/** Drives the load profile and what counts as "should be empty". */
export type SiteType = 'office' | 'mall' | 'residential' | 'healthcare' | 'warehouse'

export interface Client {
  id: string // e.g. CL-01
  name: string
  sector: string
}

export interface Site {
  id: string // e.g. HBT, also the prefix of building / SMDB ids
  clientId: string
  name: string
  shortName: string
  /** Dubai community / area, e.g. "Business Bay". */
  area: string
  type: SiteType
  /** Normal opening hours (24 h clock). 0 and 24 = always open. */
  openHour: number
  closeHour: number
  /** Does the site run at full activity on Sat/Sun? */
  openWeekends: boolean
  /** DEWA premises / account number shown on bills (fictional). */
  dewaAccount: string
}

/** What the site switcher is set to: a site id, or 'ALL' = every site the user may see. */
export type SiteFilter = string

export interface Building {
  id: string // e.g. HBT-B1
  siteId: string
  name: string
  shortName: string
  floors: number
  areaM2: number
  /** Typical peak electrical load on a normal day. Drives energy + SMDB data. */
  baseLoadKw: number
}
