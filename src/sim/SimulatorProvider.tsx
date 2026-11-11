import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { can } from '../auth/permissions'
import { useCurrentUser } from '../auth/useCurrentUser'
import { useToast } from '../components/ui/toastContext'
import { getAsset } from '../data/assets'
import { DEFAULT_THRESHOLDS, SMDBS, getNode } from '../data/smdbs'
import { canSeeSite } from '../lib/scope'
import { actions } from '../store/actions'
import { useAppDispatch, useAppState } from '../store/hooks'
import type { Alert, Reading } from '../types'
import { allNodeHealth, SEED_OFFLINE } from './deviceModel'
import { expectedKw } from './loadModel'
import { SimulatorContext, type SimulatorValue } from './simulatorContext'
import { boardConstants, buildHistory, computeHealth, makeReading, type FaultType } from './smdbModel'
import { usePredictive } from './usePredictive'

const INTERVAL_MS = 4000
/** An alert auto-resolves after its condition has been clear for this many updates (avoids flapping). */
const CLEAR_TICKS = 3

const seedOffline = (): Record<string, number> => Object.fromEntries(Object.entries(SEED_OFFLINE).map(([id, min]) => [id, Date.now() - min * 60_000]))

/**
 * The live data engine. Every 4 s it produces new readings for all SMDBs,
 * works out their status from the editable thresholds, raises alerts for new
 * problems (with a toast) and resolves alerts that cleared. Boards behind an
 * offline IoT node keep their last reading and show "Offline".
 * In a real deployment the readings come from the meters via the IoT nodes.
 */
export function SimulatorProvider({ children }: { children: ReactNode }) {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const user = useCurrentUser()
  const toast = useToast()

  // Values the interval callback needs, kept fresh in refs (the interval itself never restarts).
  const calendarRef = useRef(state.calendar)
  calendarRef.current = state.calendar

  const [faults, setFaults] = useState<Record<string, FaultType>>({})
  const faultsRef = useRef(faults)
  faultsRef.current = faults

  const [offlineNodes, setOfflineNodes] = useState<Record<string, number>>(seedOffline)
  const offlineRef = useRef(offlineNodes)
  offlineRef.current = offlineNodes

  // Random-walk noise and running kWh counter per board.
  const walkRef = useRef<Record<string, number>>({})
  const kwhRef = useRef<Record<string, number>>(Object.fromEntries(SMDBS.map((s) => [s.id, boardConstants(s).startKwh])))
  const lastTickRef = useRef(Date.now())
  const lastReadingsRef = useRef<Record<string, Reading>>({})

  const computeReadings = useCallback((): Record<string, Reading> => {
    const now = new Date()
    const hours = (now.getTime() - lastTickRef.current) / 3_600_000
    lastTickRef.current = now.getTime()
    const next: Record<string, Reading> = {}
    for (const smdb of SMDBS) {
      const offlineSince = offlineRef.current[smdb.nodeId]
      const previous = lastReadingsRef.current[smdb.id]
      if (offlineSince !== undefined) {
        // No data from the node: keep the last value we received (or what it was when it dropped out).
        next[smdb.id] =
          previous && new Date(previous.at).getTime() <= offlineSince
            ? previous
            : makeReading(smdb, new Date(offlineSince), expectedKw(smdb, new Date(offlineSince), calendarRef.current), kwhRef.current[smdb.id], Math.random)
        continue
      }
      // Noise drifts slowly (±7%) instead of jumping, like real load.
      const walk = Math.min(1.07, Math.max(0.93, (walkRef.current[smdb.id] ?? 1) + (Math.random() - 0.5) * 0.02))
      walkRef.current[smdb.id] = walk
      const kW = expectedKw(smdb, now, calendarRef.current) * walk
      const reading = makeReading(smdb, now, kW, kwhRef.current[smdb.id], Math.random, faultsRef.current[smdb.id])
      kwhRef.current[smdb.id] += reading.kW * hours
      next[smdb.id] = reading
    }
    lastReadingsRef.current = next
    return next
  }, [])

  const [readings, setReadings] = useState<Record<string, Reading>>(() => computeReadings())
  const [updatedAt, setUpdatedAt] = useState(() => Date.now())
  const tick = useCallback(() => {
    setReadings(computeReadings())
    setUpdatedAt(Date.now())
  }, [computeReadings])

  useEffect(() => {
    const id = window.setInterval(tick, INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [tick])

  // 24 h history, generated once.
  const [history] = useState(() => Object.fromEntries(SMDBS.map((s) => [s.id, buildHistory(s, new Date(), state.calendar)])))

  // Status depends on the thresholds too, so editing a threshold changes status immediately.
  const health = useMemo(
    () =>
      Object.fromEntries(
        SMDBS.map((s) => [s.id, computeHealth(readings[s.id], s, state.thresholds[s.id] ?? DEFAULT_THRESHOLDS, offlineNodes[s.nodeId] !== undefined)]),
      ),
    [readings, state.thresholds, offlineNodes],
  )
  const nodes = useMemo(() => allNodeHealth(updatedAt, offlineNodes), [updatedAt, offlineNodes])

  // ---------- Alert sync (SMDB + device) ----------
  const clearCountsRef = useRef<Map<string, number>>(new Map())
  const pendingRef = useRef<Map<string, number>>(new Map()) // raised, not yet in the store
  const countedTickRef = useRef(0)
  const canSeeSmdb = can(user, 'smdb.view')
  const canSeeDevices = can(user, 'devices.view')

  useEffect(() => {
    const now = Date.now()
    const keyOf = (a: Pick<Alert, 'source' | 'smdbId' | 'nodeId' | 'code'>) => `${a.source}:${a.smdbId ?? a.nodeId}:${a.code}`
    const open = state.alerts.filter((a) => (a.source === 'smdb' || a.source === 'device') && !a.resolvedAt && a.code)
    const openKey = new Set(open.map(keyOf))
    for (const key of [...pendingRef.current.keys()]) {
      if (openKey.has(key) || now - (pendingRef.current.get(key) ?? 0) > 10_000) pendingRef.current.delete(key)
    }

    // Conditions present right now, keyed like the alerts.
    const present = new Map<string, Omit<Alert, 'id'>>()
    for (const smdb of SMDBS) {
      for (const issue of health[smdb.id]?.issues ?? []) {
        if (issue.code === 'offline') continue // covered by the device alert below
        const alert: Omit<Alert, 'id'> = {
          source: 'smdb',
          severity: issue.severity,
          title: issue.title,
          message: issue.message,
          siteId: smdb.siteId,
          buildingId: smdb.buildingId,
          smdbId: smdb.id,
          code: issue.code,
          createdAt: new Date(now).toISOString(),
          notes: [],
        }
        present.set(keyOf(alert), alert)
      }
    }
    for (const nodeId of Object.keys(offlineNodes)) {
      const node = getNode(nodeId)
      if (!node) continue
      const alert: Omit<Alert, 'id'> = {
        source: 'device',
        severity: 'warning',
        title: 'IoT node offline',
        message: `No data from node ${node.id} (${node.location}) since ${new Date(offlineNodes[nodeId]).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. ${node.smdbIds.length} meter(s) affected; readings are buffered on the node and back-filled when it reconnects.`,
        siteId: node.siteId,
        buildingId: node.buildingId,
        nodeId: node.id,
        code: 'offline',
        createdAt: new Date(offlineNodes[nodeId]).toISOString(),
        notes: [],
      }
      present.set(keyOf(alert), alert)
    }

    const toRaise: Array<Omit<Alert, 'id'>> = []
    for (const [key, alert] of present) {
      clearCountsRef.current.delete(key)
      if (openKey.has(key) || pendingRef.current.has(key)) continue
      pendingRef.current.set(key, now)
      toRaise.push(alert)
    }

    // Count "clear" updates only once per tick (this effect also runs when alerts change).
    const toResolve: string[] = []
    const isNewTick = countedTickRef.current !== updatedAt
    countedTickRef.current = updatedAt
    for (const alert of open) {
      const key = keyOf(alert)
      if (present.has(key)) continue
      const count = (clearCountsRef.current.get(key) ?? 0) + (isNewTick ? 1 : 0)
      if (count >= CLEAR_TICKS || alert.source === 'device') {
        toResolve.push(alert.id)
        clearCountsRef.current.delete(key)
      } else clearCountsRef.current.set(key, count)
    }

    if (toRaise.length) {
      dispatch(actions.raiseAlerts(toRaise))
      const visible = toRaise.filter((a) => canSeeSite(user, a.siteId) && (a.source === 'device' ? canSeeDevices : canSeeSmdb))
      for (const a of visible.slice(0, 3)) {
        const where = a.smdbId ? SMDBS.find((s) => s.id === a.smdbId)?.name : a.nodeId
        toast.show(`${a.title} — ${where ?? ''}`, a.severity === 'critical' ? 'alert' : 'warn')
      }
    }
    if (toResolve.length) dispatch(actions.resolveAlerts(toResolve))
  }, [health, offlineNodes, state.alerts, updatedAt, dispatch, toast, user, canSeeSmdb, canSeeDevices])

  // ---------- Predictive (asset health) alert sync ----------
  // One alert per asset while its health is in "Alert"; resolved when the asset recovers.
  const assessments = usePredictive()
  const pendingPredictiveRef = useRef<Set<string>>(new Set())
  const canSeeAssets = can(user, 'assets.view')

  useEffect(() => {
    const open = state.alerts.filter((a) => a.source === 'predictive' && a.code === 'health' && !a.resolvedAt)
    for (const id of [...pendingPredictiveRef.current]) if (open.some((a) => a.assetId === id)) pendingPredictiveRef.current.delete(id)

    const toRaise: Array<Omit<Alert, 'id'>> = []
    const toResolve: string[] = []
    for (const assessment of assessments) {
      const asset = getAsset(assessment.assetId)
      if (!asset) continue
      const existing = open.find((a) => a.assetId === asset.id)
      if (assessment.status === 'alert' && assessment.issue) {
        if (existing || pendingPredictiveRef.current.has(asset.id)) continue
        pendingPredictiveRef.current.add(asset.id)
        toRaise.push({
          source: 'predictive',
          severity: 'critical',
          title: assessment.issue.title,
          message: `Health score ${assessment.health}/100 on ${asset.name} (${asset.id}). ${assessment.issue.detail}`,
          siteId: asset.siteId,
          buildingId: asset.buildingId,
          assetId: asset.id,
          code: 'health',
          createdAt: new Date().toISOString(),
          notes: [],
        })
      } else if (existing) {
        toResolve.push(existing.id)
      }
    }
    if (toRaise.length) {
      dispatch(actions.raiseAlerts(toRaise))
      if (canSeeAssets) for (const a of toRaise.filter((x) => canSeeSite(user, x.siteId))) toast.show(`Asset health: ${a.title}`, 'alert')
    }
    if (toResolve.length) dispatch(actions.resolveAlerts(toResolve))
  }, [assessments, state.alerts, dispatch, toast, user, canSeeAssets])

  // ---------- Demo faults ----------

  const injectFault = useCallback(
    (smdbId: string, type: FaultType) => {
      faultsRef.current = { ...faultsRef.current, [smdbId]: type }
      setFaults(faultsRef.current)
      tick() // show it immediately, don't wait for the next interval
    },
    [tick],
  )
  const clearFault = useCallback(
    (smdbId: string) => {
      const next = { ...faultsRef.current }
      delete next[smdbId]
      faultsRef.current = next
      setFaults(next)
      tick()
    },
    [tick],
  )
  const setNodeOffline = useCallback(
    (nodeId: string, offline: boolean) => {
      const next = { ...offlineRef.current }
      if (offline) next[nodeId] = Date.now()
      else delete next[nodeId]
      offlineRef.current = next
      setOfflineNodes(next)
      tick()
    },
    [tick],
  )

  /** Used by "Reset demo data": remove every simulated fault and restore the seeded node states. */
  const resetSimulation = useCallback(() => {
    faultsRef.current = {}
    setFaults({})
    offlineRef.current = seedOffline()
    setOfflineNodes(offlineRef.current)
    tick()
  }, [tick])

  const value = useMemo<SimulatorValue>(
    () => ({ readings, health, history, nodes, faults, offlineNodes, injectFault, clearFault, setNodeOffline, resetSimulation, updatedAt, intervalMs: INTERVAL_MS }),
    [readings, health, history, nodes, faults, offlineNodes, injectFault, clearFault, setNodeOffline, resetSimulation, updatedAt],
  )

  return <SimulatorContext.Provider value={value}>{children}</SimulatorContext.Provider>
}

