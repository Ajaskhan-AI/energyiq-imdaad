import type { Asset, AssetCategory } from '../types'

/** Fictional plant assets with CT clamps on the motor supply (predictive maintenance). */
type AssetRow = [id: string, name: string, category: AssetCategory, buildingId: string, location: string, description: string, installYear: number, smdbId?: string]

const ROWS: AssetRow[] = [
  ['HBT-CH-01', 'Chiller 1', 'chiller', 'HBT-B1', 'Roof chiller plant', 'Water-cooled centrifugal chiller, 600 TR', 2015, 'SMDB-HBT-B1-01'],
  ['HBT-CH-02', 'Chiller 2', 'chiller', 'HBT-B1', 'Roof chiller plant', 'Water-cooled centrifugal chiller, 600 TR', 2015, 'SMDB-HBT-B1-01'],
  ['HBT-CHWP-01', 'CHW Secondary Pump 1', 'pump', 'HBT-B1', 'Roof chiller plant', 'Chilled water secondary pump, 45 kW, VSD', 2015, 'SMDB-HBT-B1-01'],
  ['HBT-AHU-01', 'AHU-01 Lobby & Podium', 'ahu', 'HBT-B2', 'Podium plant room', 'Air handling unit, 15,000 L/s', 2016, 'SMDB-HBT-B2-02'],
  ['DLH-RR-01', 'Cold store refrigeration rack 1', 'chiller', 'DLH-B1', 'Cold store plant room', 'Ammonia refrigeration rack, 3 compressors', 2019, 'SMDB-DLH-B1-01'],
  ['PMR-CHWP-01', 'Tower A CHW Pump 1', 'pump', 'PMR-B1', 'Level 41 plant room', 'Chilled water pump (district cooling ETS), 30 kW', 2018, 'SMDB-PMR-B1-01'],
  ['PMR-CHWP-02', 'Tower B CHW Pump 1', 'pump', 'PMR-B2', 'Level 35 plant room', 'Chilled water pump (district cooling ETS), 30 kW', 2018, 'SMDB-PMR-B2-01'],
  ['ANM-CH-01', 'Chiller 1', 'chiller', 'ANM-B1', 'Roof chiller plant', 'Air-cooled screw chiller, 450 TR', 2014, 'SMDB-ANM-B1-01'],
  ['ANM-CH-02', 'Chiller 2', 'chiller', 'ANM-B1', 'Roof chiller plant', 'Air-cooled screw chiller, 450 TR', 2014, 'SMDB-ANM-B1-01'],
  ['ANM-AHU-03', 'AHU-03 Food Court', 'ahu', 'ANM-B1', 'Level 2 plant room', 'Air handling unit, 18,000 L/s', 2014, 'SMDB-ANM-B1-01'],
  ['ANM-CT-01', 'Cooling Tower Fan 1', 'cooling_tower', 'ANM-B1', 'Roof', 'Induced-draft cooling tower fan, 22 kW', 2014, 'SMDB-ANM-B1-01'],
  ['WMC-AHU-01', 'AHU-01 Operating Theatres', 'ahu', 'WMC-B1', 'Roof plant room', 'Theatre AHU with HEPA filtration, 6,000 L/s', 2020, 'SMDB-WMC-B1-01'],
  ['WMC-CHWP-01', 'CHW Pump 1', 'pump', 'WMC-B1', 'Basement pump room', 'Chilled water pump, 22 kW', 2020, 'SMDB-WMC-B1-01'],
]

export const ASSETS: Asset[] = ROWS.map(([id, name, category, buildingId, location, description, installYear, smdbId]) => ({
  id,
  name,
  category,
  siteId: buildingId.slice(0, 3),
  buildingId,
  location,
  description,
  installYear,
  ...(smdbId ? { smdbId } : {}),
}))

const BY_ID = new Map(ASSETS.map((a) => [a.id, a]))

export function getAsset(id: string): Asset | undefined {
  return BY_ID.get(id)
}

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  chiller: 'Chiller / refrigeration',
  ahu: 'Air handling unit',
  pump: 'Pump',
  cooling_tower: 'Cooling tower',
}
