export type AssetCategory = 'chiller' | 'ahu' | 'pump' | 'cooling_tower'

/** Plant asset with CT clamps on its motor supply (predictive maintenance). */
export interface Asset {
  id: string // e.g. HBT-CH-01
  name: string
  category: AssetCategory
  siteId: string
  buildingId: string
  location: string
  description: string
  installYear: number
  /** Board that feeds it. */
  smdbId?: string
}
