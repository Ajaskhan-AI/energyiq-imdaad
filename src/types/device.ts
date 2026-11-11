/** Kuroshio IoT node: ESP32-S3 + SIM7080G (LTE-M / NB-IoT), reads up to 4 meters over RS-485. */
export interface IotNode {
  id: string // e.g. KAI-N-0101
  siteId: string
  buildingId: string
  location: string
  firmware: string
  /** Meters (SMDB ids) this node reads. */
  smdbIds: string[]
  installedAt: string // ISO date
}

export type NodeStatus = 'online' | 'weak' | 'offline'
