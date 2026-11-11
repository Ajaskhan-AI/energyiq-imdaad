import type { SmdbDay } from '../../data/energy'
import type { EnergyAnalysis, WasteFlag, WastePattern } from '../../lib/energyAnalysis'
import type { Building, EnergyRecord, Smdb } from '../../types'

/** What the Energy page's filters select; passed to each tab. */
export interface EnergyScope {
  /** Daily totals per building, for the selected buildings and dates. */
  records: EnergyRecord[]
  /** Daily values per board, for the selected buildings and dates. */
  boardDays: SmdbDay[]
  buildings: Building[]
  smdbs: Smdb[]
  /** Flags and patterns for the selection. */
  flags: WasteFlag[]
  patterns: WastePattern[]
  from: string
  to: string
  days: number
  analysis: EnergyAnalysis
}
