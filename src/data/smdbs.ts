import type { IotNode, LoadType, Smdb, SmdbThresholds } from '../types'
import { BUILDINGS } from './sites'

export const DEFAULT_THRESHOLDS: SmdbThresholds = {
  warnLoadPct: 80,
  critLoadPct: 95,
  imbalancePct: 15,
  voltageTolPct: 10,
  nominalVoltageV: 230,
  minPf: 0.9,
}

export const LOAD_TYPE_LABELS: Record<LoadType, string> = {
  hvac: 'HVAC / chilled water',
  lighting_power: 'Lighting & small power',
  tenant: 'Tenant supply',
  common: 'Common areas & lifts',
  carpark: 'Car park & ventilation',
  kitchen: 'Kitchens / F&B',
  critical: 'Critical / process load',
}

/** Standard breaker ratings; pick the smallest that leaves ~35% headroom. */
const RATINGS = [250, 400, 630, 800, 1000, 1250, 1600]

function ratingFor(peakKw: number): number {
  // 3-phase 400 V: I = P / (√3 × V × PF), PF 0.92.
  const peakA = (peakKw * 1000) / (Math.sqrt(3) * 400 * 0.92)
  return RATINGS.find((r) => r >= peakA * 1.35) ?? RATINGS[RATINGS.length - 1]
}

type BoardRow = [name: string, location: string, loadType: LoadType, share: number, costCentre: string]

/** Boards per building. Shares add up to 1 for each building. */
const BOARDS: Record<string, BoardRow[]> = {
  'HBT-B1': [
    ['HVAC plant', 'Roof chiller plant room', 'hvac', 0.45, 'Landlord — HVAC'],
    ['Tenants L1–15', 'Level 1 electrical room', 'tenant', 0.2, 'Office tenants L1–15'],
    ['Tenants L16–32', 'Level 16 electrical room', 'tenant', 0.22, 'Office tenants L16–32'],
    ['Common & lifts', 'Ground floor LV room', 'common', 0.13, 'Landlord — common areas'],
  ],
  'HBT-B2': [
    ['Car park & ventilation', 'Basement B1 LV room', 'carpark', 0.4, 'Landlord — car park'],
    ['Podium retail', 'Podium LV room', 'tenant', 0.35, 'Podium retail tenants'],
    ['F&B kitchens', 'Podium service corridor', 'kitchen', 0.25, 'F&B tenants'],
  ],
  'DLH-B1': [
    ['Cold store refrigeration', 'Cold store plant room', 'critical', 0.55, 'Cold storage operator'],
    ['Warehouse lighting & MHE charging', 'Warehouse LV room', 'lighting_power', 0.45, 'Warehouse operator'],
  ],
  'DLH-B2': [
    ['Office HVAC', 'Roof plant', 'hvac', 0.55, 'Landlord — office block'],
    ['Office power', 'Ground floor electrical room', 'lighting_power', 0.45, 'Landlord — office block'],
  ],
  'PMR-B1': [
    ['HVAC (CHW & FCUs)', 'Level 41 plant room', 'hvac', 0.5, 'Landlord — district cooling side'],
    ['Apartment risers', 'Ground floor LV room', 'tenant', 0.35, 'Residents — Tower A'],
    ['Common, lifts & pool', 'Podium LV room', 'common', 0.15, 'Owners association — Tower A'],
  ],
  'PMR-B2': [
    ['HVAC (CHW & FCUs)', 'Level 35 plant room', 'hvac', 0.5, 'Landlord — district cooling side'],
    ['Apartment risers', 'Ground floor LV room', 'tenant', 0.35, 'Residents — Tower B'],
    ['Common, lifts & gym', 'Podium LV room', 'common', 0.15, 'Owners association — Tower B'],
  ],
  'ANM-B1': [
    ['HVAC plant', 'Roof chiller plant', 'hvac', 0.42, 'Mall — HVAC'],
    ['Retail tenants', 'Level 1 LV room', 'tenant', 0.3, 'Retail tenants'],
    ['Food court kitchens', 'Level 2 service area', 'kitchen', 0.16, 'Food court tenants'],
    ['Common areas & car park', 'Basement LV room', 'common', 0.12, 'Mall — common areas'],
  ],
  'WMC-B1': [
    ['HVAC plant', 'Roof plant room', 'hvac', 0.45, 'Medical centre — HVAC'],
    ['Imaging & theatres (UPS)', 'Level 1 critical LV room', 'critical', 0.3, 'Medical centre — clinical'],
    ['General power & lighting', 'Ground floor electrical room', 'lighting_power', 0.25, 'Medical centre — general'],
  ],
}

/** How many meters one IoT node reads (they share an RS-485 bus). */
const METERS_PER_NODE = 2

export const SMDBS: Smdb[] = []
export const NODES: IotNode[] = []

let meterNo = 2001
let nodeNo = 1
for (const building of BUILDINGS) {
  const rows = BOARDS[building.id] ?? []
  const boards = rows.map(([name, location, loadType, share, costCentre], i): Smdb => {
    const suffix = String(i + 1).padStart(2, '0')
    return {
      id: `SMDB-${building.id}-${suffix}`,
      name: `SMDB-${suffix} · ${name}`,
      buildingId: building.id,
      siteId: building.siteId,
      location,
      loadType,
      ratedCurrentA: ratingFor(building.baseLoadKw * share),
      meterId: `SEL-EM-${meterNo++}`,
      nodeId: '', // filled below
      loadShare: share,
      costCentre,
    }
  })
  for (let i = 0; i < boards.length; i += METERS_PER_NODE) {
    const group = boards.slice(i, i + METERS_PER_NODE)
    const nodeId = `KAI-N-${String(nodeNo++).padStart(4, '0')}`
    for (const b of group) b.nodeId = nodeId
    NODES.push({
      id: nodeId,
      siteId: building.siteId,
      buildingId: building.id,
      location: group[0].location,
      firmware: nodeNo % 5 === 0 ? 'v2.3.1' : 'v2.4.0',
      smdbIds: group.map((b) => b.id),
      installedAt: '2026-08-18',
    })
  }
  SMDBS.push(...boards)
}

const BY_ID = new Map(SMDBS.map((s) => [s.id, s]))
const NODE_BY_ID = new Map(NODES.map((n) => [n.id, n]))

export function getSmdb(id: string): Smdb | undefined {
  return BY_ID.get(id)
}

export function getNode(id: string): IotNode | undefined {
  return NODE_BY_ID.get(id)
}

/** Latest firmware available for the nodes (used by Device health). */
export const LATEST_FIRMWARE = 'v2.4.0'
