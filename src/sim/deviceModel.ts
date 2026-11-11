import { NODES } from '../data/smdbs'
import type { IotNode, NodeStatus } from '../types'
import { createRng, hashString } from './rng'

/**
 * Simulated health of the Kuroshio IoT nodes (ESP32-S3 + SIM7080G).
 * Signal strength is stable per node (seeded). All nodes start online with
 * good coverage; Device health can simulate a comms loss for the demo.
 */

/** Nodes that start the demo offline, with how long ago they dropped out (minutes). None: every node starts online; use "Simulate comms loss" on Device health to show an outage. */
export const SEED_OFFLINE: Record<string, number> = {}

/** Per-node signal overrides (dBm), e.g. { 'KAI-N-0003': -105 } for a basement node. None: every node has good coverage. */
const RSSI_OVERRIDE: Record<string, number> = {}

export interface NodeHealth {
  node: IotNode
  status: NodeStatus
  /** Received signal strength, dBm (−70 good … −110 very weak). */
  rssiDbm: number
  network: 'LTE-M' | 'NB-IoT'
  /** Share of expected 1-minute readings received in the last 24 h. */
  completenessPct: number
  uptimeHours: number
  lastSeen: number // epoch ms
  /** Days of readings held in local flash while offline (store-and-forward). */
  bufferedReadings: number
}

export function nodeHealth(node: IotNode, now: number, offlineSince: number | undefined): NodeHealth {
  const rng = createRng(hashString(`node:${node.id}`))
  const rssi = RSSI_OVERRIDE[node.id] ?? Math.round(rng.range(-88, -71))
  const weak = rssi <= -100
  const offline = offlineSince !== undefined
  const offlineMin = offline ? Math.max(0, (now - offlineSince) / 60_000) : 0
  const completeness = offline ? Math.max(0, 100 - (offlineMin / 1440) * 100) : weak ? 96.8 : 99.2 + rng.range(0, 0.8)
  return {
    node,
    status: offline ? 'offline' : weak ? 'weak' : 'online',
    rssiDbm: rssi,
    network: weak ? 'NB-IoT' : 'LTE-M',
    completenessPct: Math.round(completeness * 10) / 10,
    uptimeHours: offline ? 0 : Math.round(rng.range(120, 2000)),
    lastSeen: offline ? offlineSince : now - Math.round(rng.range(5, 55)) * 1000,
    bufferedReadings: Math.round(offlineMin * node.smdbIds.length),
  }
}

export function allNodeHealth(now: number, offline: Record<string, number>): NodeHealth[] {
  return NODES.map((n) => nodeHealth(n, now, offline[n.id]))
}

export const NODE_STATUS_LABELS: Record<NodeStatus, string> = { online: 'Online', weak: 'Weak signal', offline: 'Offline' }
