import { createContext, useContext } from 'react'
import type { Reading } from '../types'
import type { NodeHealth } from './deviceModel'
import type { FaultType, HistoryPoint, SmdbHealth } from './smdbModel'

export interface SimulatorValue {
  /** Latest meter reading per SMDB id (frozen at the last value while its node is offline). */
  readings: Record<string, Reading>
  /** Status + issues per SMDB, from the readings and the current thresholds. */
  health: Record<string, SmdbHealth>
  /** Last 24 h (15-min steps) per SMDB, generated at start-up. */
  history: Record<string, HistoryPoint[]>
  /** Health of every IoT node. */
  nodes: NodeHealth[]
  /** Demo faults currently forced on boards. */
  faults: Record<string, FaultType>
  /** Offline nodes: node id → time it went offline (ms). */
  offlineNodes: Record<string, number>
  injectFault: (smdbId: string, type: FaultType) => void
  clearFault: (smdbId: string) => void
  /** Simulate a comms loss, or bring the node back ("Restart node"). */
  setNodeOffline: (nodeId: string, offline: boolean) => void
  /** Reset demo: remove every fault and restore the seeded node states. */
  resetSimulation: () => void
  /** Time of the last update (ms). */
  updatedAt: number
  intervalMs: number
}

export const SimulatorContext = createContext<SimulatorValue | null>(null)

export function useSimulator(): SimulatorValue {
  const value = useContext(SimulatorContext)
  if (!value) throw new Error('useSimulator must be used inside <SimulatorProvider>')
  return value
}
