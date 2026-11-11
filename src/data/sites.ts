import type { Building, Client, Site } from '../types'

/**
 * Fictional portfolio for the demo: clients whose buildings Imdaad maintains.
 * None of these are real Imdaad customers or real buildings.
 */
export const CLIENTS: Client[] = [
  { id: 'CL-01', name: 'Gulfstone Real Estate', sector: 'Commercial & logistics landlord' },
  { id: 'CL-02', name: 'Palmyra Communities', sector: 'Residential towers' },
  { id: 'CL-03', name: 'Al Noor Retail Group', sector: 'Community retail' },
  { id: 'CL-04', name: 'Wellspring Healthcare', sector: 'Outpatient healthcare' },
]

export const SITES: Site[] = [
  { id: 'HBT', clientId: 'CL-01', name: 'Gulfstone Business Tower', shortName: 'Business Tower', area: 'Business Bay', type: 'office', openHour: 8, closeHour: 19, openWeekends: false, dewaAccount: '20-4417-0091' },
  { id: 'DLH', clientId: 'CL-01', name: 'Gulfstone Logistics Hub', shortName: 'Logistics Hub', area: 'Dubai Investments Park', type: 'warehouse', openHour: 6, closeHour: 22, openWeekends: false, dewaAccount: '20-5102-3378' },
  { id: 'PMR', clientId: 'CL-02', name: 'Palmyra Marina Residences', shortName: 'Marina Residences', area: 'Dubai Marina', type: 'residential', openHour: 0, closeHour: 24, openWeekends: true, dewaAccount: '20-3388-7120' },
  { id: 'ANM', clientId: 'CL-03', name: 'Al Noor Community Mall', shortName: 'Community Mall', area: 'Mirdif', type: 'mall', openHour: 10, closeHour: 23, openWeekends: true, dewaAccount: '20-6620-4415' },
  { id: 'WMC', clientId: 'CL-04', name: 'Wellspring Medical Centre', shortName: 'Medical Centre', area: 'Al Barsha', type: 'healthcare', openHour: 7, closeHour: 22, openWeekends: true, dewaAccount: '20-2903-5564' },
]

export const BUILDINGS: Building[] = [
  { id: 'HBT-B1', siteId: 'HBT', name: 'Business Tower — Office Tower', shortName: 'Office Tower', floors: 32, areaM2: 48000, baseLoadKw: 1450 },
  { id: 'HBT-B2', siteId: 'HBT', name: 'Business Tower — Podium & Car Park', shortName: 'Podium', floors: 5, areaM2: 22000, baseLoadKw: 420 },
  { id: 'DLH-B1', siteId: 'DLH', name: 'Logistics Hub — Warehouse A', shortName: 'Warehouse A', floors: 1, areaM2: 18000, baseLoadKw: 560 },
  { id: 'DLH-B2', siteId: 'DLH', name: 'Logistics Hub — Office Block', shortName: 'Office Block', floors: 2, areaM2: 2400, baseLoadKw: 150 },
  { id: 'PMR-B1', siteId: 'PMR', name: 'Marina Residences — Tower A', shortName: 'Tower A', floors: 40, areaM2: 52000, baseLoadKw: 1100 },
  { id: 'PMR-B2', siteId: 'PMR', name: 'Marina Residences — Tower B', shortName: 'Tower B', floors: 34, areaM2: 44000, baseLoadKw: 950 },
  { id: 'ANM-B1', siteId: 'ANM', name: 'Al Noor Community Mall', shortName: 'Mall', floors: 3, areaM2: 36000, baseLoadKw: 1600 },
  { id: 'WMC-B1', siteId: 'WMC', name: 'Wellspring Medical Centre', shortName: 'Medical Centre', floors: 6, areaM2: 14500, baseLoadKw: 820 },
]

const SITE_BY_ID = new Map(SITES.map((s) => [s.id, s]))
const BUILDING_BY_ID = new Map(BUILDINGS.map((b) => [b.id, b]))
const CLIENT_BY_ID = new Map(CLIENTS.map((c) => [c.id, c]))

export function getSite(id: string): Site | undefined {
  return SITE_BY_ID.get(id)
}

export function getBuilding(id: string): Building | undefined {
  return BUILDING_BY_ID.get(id)
}

export function getClient(id: string): Client | undefined {
  return CLIENT_BY_ID.get(id)
}

/** Site of a building (every building belongs to exactly one site). */
export function siteOfBuilding(buildingId: string): Site | undefined {
  const building = getBuilding(buildingId)
  return building ? getSite(building.siteId) : undefined
}

export const SITE_TYPE_LABELS: Record<Site['type'], string> = {
  office: 'Office tower',
  mall: 'Shopping mall',
  residential: 'Residential',
  healthcare: 'Healthcare',
  warehouse: 'Logistics / warehouse',
}

/** "08:00–19:00, Mon–Fri" or "24/7". */
export function openingHoursLabel(site: Site): string {
  const days = site.openWeekends ? 'every day' : 'Mon–Fri'
  if (site.openHour === 0 && site.closeHour === 24) return `24/7`
  const pad = (h: number) => `${String(h % 24).padStart(2, '0')}:00`
  return `${pad(site.openHour)}–${pad(site.closeHour)}, ${days}`
}
