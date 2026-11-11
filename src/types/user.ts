/** Logged-in demo roles. */
export type Role =
  | 'fm_manager' // Imdaad: FM / operations manager, whole portfolio
  | 'energy_engineer' // Imdaad: energy & MEP engineer, whole portfolio
  | 'site_supervisor' // Imdaad: supervisor for one or two sites
  | 'client_viewer' // Imdaad's customer (property owner): own sites, read-only
  | 'admin' // Kuroshio AI system admin

export interface User {
  id: string
  name: string
  role: Role
  /** Sites this user may see. 'ALL' = whole portfolio. */
  siteIds: string[] | 'ALL'
  /** Client viewers: the client they belong to. */
  clientId?: string
  initials: string
  jobTitle: string
  organisation: string
}

/** Who did something. Recorded on every alert / work-order action. */
export interface Actor {
  name: string
  role: Role | 'system'
  userId?: string
}

/** "Who + when" pair, e.g. who acknowledged an alert. */
export interface ActionStamp {
  by: Actor
  at: string // ISO timestamp
}
