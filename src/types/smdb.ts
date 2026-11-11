/** What a board mainly feeds. Drives its load shape and billing labels. */
export type LoadType = 'hvac' | 'lighting_power' | 'tenant' | 'common' | 'carpark' | 'kitchen' | 'critical'

/** Sub-Main Distribution Board with a Selec energy meter (RS-485/Modbus) read by a Kuroshio IoT node. */
export interface Smdb {
  id: string // e.g. SMDB-HBT-B1-01
  name: string
  buildingId: string
  siteId: string
  location: string
  loadType: LoadType
  ratedCurrentA: number
  meterId: string
  /** Kuroshio IoT node reading this meter. */
  nodeId: string
  /** Share of the building's load on this board (0–1). */
  loadShare: number
  /** Tenant / cost centre this board is billed to (sub-metering). */
  costCentre: string
}

/** Configurable per SMDB on the settings page. */
export interface SmdbThresholds {
  warnLoadPct: number // % of rated current → Warning
  critLoadPct: number // % of rated current → Critical
  imbalancePct: number // max deviation between phases
  voltageTolPct: number // ± around nominal
  nominalVoltageV: number // phase-to-neutral
  minPf: number // power factor below this → Warning
}

export interface PhaseReading {
  voltageV: number
  currentA: number
  /** Total harmonic distortion of the current, %. */
  thdPct: number
}

export interface Reading {
  smdbId: string
  at: string
  phases: [PhaseReading, PhaseReading, PhaseReading]
  kW: number
  kVA: number
  kVAr: number
  pf: number
  /** Cumulative energy counter, like the meter's register. */
  kWh: number
  frequencyHz: number
}

export type SmdbStatus = 'normal' | 'warning' | 'critical' | 'tripped' | 'offline'
