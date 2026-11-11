import { ArrowLeft, Cpu, MapPin, Receipt, SlidersHorizontal, TriangleAlert, Zap } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { can } from '../../auth/permissions'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { AlertCard } from '../../components/alerts/AlertCard'
import { FaultControls } from '../../components/smdb/FaultControls'
import { Gauge } from '../../components/smdb/Gauge'
import { LoadTrendChart } from '../../components/smdb/LoadTrendChart'
import { LiveIndicator, SmdbStatusBadge } from '../../components/smdb/SmdbBits'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { getBuilding, getSite } from '../../data/sites'
import { DEFAULT_THRESHOLDS, LOAD_TYPE_LABELS, getSmdb } from '../../data/smdbs'
import { canSeeSite } from '../../lib/scope'
import { formatNumber } from '../../lib/format'
import { boardPeakKw } from '../../sim/loadModel'
import { useSimulator } from '../../sim/simulatorContext'
import { useAppState } from '../../store/hooks'
import AccessRestrictedPage from '../AccessRestrictedPage'

/** One board: live gauges, per-phase values, last-24 h trend and its alerts. */
export default function SmdbDetailPage() {
  const { smdbId = '' } = useParams()
  const state = useAppState()
  const user = useCurrentUser()
  const sim = useSimulator()

  const smdb = getSmdb(smdbId)
  if (!smdb) {
    return (
      <EmptyState icon={Zap} title={`Board ${smdbId} not found`}>
        <Link to="/smdb" className="text-teal-700 underline">
          Back to all boards
        </Link>
      </EmptyState>
    )
  }
  if (!can(user, 'smdb.view') || !canSeeSite(user, smdb.siteId)) return <AccessRestrictedPage />

  const reading = sim.readings[smdb.id]
  const health = sim.health[smdb.id]
  const t = state.thresholds[smdb.id] ?? DEFAULT_THRESHOLDS
  const building = getBuilding(smdb.buildingId)
  const site = getSite(smdb.siteId)
  const offline = health.status === 'offline'
  const ratedKw = (smdb.ratedCurrentA * Math.sqrt(3) * 400 * 0.92) / 1000
  const avgV = reading.phases.reduce((s, p) => s + p.voltageV, 0) / 3
  const points = offline ? sim.history[smdb.id] : [...sim.history[smdb.id], { t: sim.updatedAt, kW: reading.kW, loadPct: Math.round(health.loadPct * 10) / 10 }]
  const alerts = state.alerts.filter((a) => a.smdbId === smdb.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10)
  const low = t.nominalVoltageV * (1 - t.voltageTolPct / 100)
  const high = t.nominalVoltageV * (1 + t.voltageTolPct / 100)

  return (
    <>
      <Link to="/smdb" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-navy-800">
        <ArrowLeft className="size-4" aria-hidden />
        All boards
      </Link>

      <div className="mt-3 mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">{smdb.name}</h1>
            <SmdbStatusBadge status={health.status} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-navy-600">
            <MapPin className="size-4" aria-hidden />
            {site?.name} · {building?.shortName} · {smdb.location}
            <span className="text-navy-400">
              · {smdb.id} · {LOAD_TYPE_LABELS[smdb.loadType]} · {smdb.ratedCurrentA} A breaker
            </span>
          </p>
        </div>
        <LiveIndicator updatedAt={sim.updatedAt} intervalMs={sim.intervalMs} />
      </div>

      {health.issues.length > 0 && (
        <div className="mb-5 space-y-2">
          {health.issues.map((issue) => (
            <p
              key={issue.code}
              className={
                issue.severity === 'critical'
                  ? 'flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-medium text-red-800'
                  : 'flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 font-medium text-amber-900'
              }
            >
              <TriangleAlert className="size-5 shrink-0" aria-hidden />
              {issue.title} — {issue.message}
            </p>
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Live readings">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Gauge label="Load (max phase)" value={health.loadPct} display={`${Math.round(health.loadPct)}%`} unit="of breaker rating" min={0} max={120} warnAt={t.warnLoadPct} critAt={t.critLoadPct} />
              <Gauge label="Active power" value={reading.kW} display={formatNumber(reading.kW)} unit="kW" min={0} max={Math.max(ratedKw, boardPeakKw(smdb))} />
              <Gauge label="Avg voltage (L-N)" value={avgV} display={avgV.toFixed(1)} unit="V" min={190} max={270} warnAt={high} lowWarnAt={low} />
              <Gauge label="Power factor" value={reading.pf} display={reading.pf.toFixed(2)} unit="PF" min={0.7} max={1} lowWarnAt={t.minPf} />
            </div>
          </Card>

          <Card title="Last 24 hours" subtitle="Load as % of breaker rating, with warning and critical thresholds">
            <LoadTrendChart points={points} warnPct={t.warnLoadPct} critPct={t.critLoadPct} />
          </Card>

          <Card title="Alerts on this board" subtitle="Newest first">
            {alerts.length ? (
              <div className="space-y-3">
                {alerts.map((a) => (
                  <AlertCard key={a.id} alert={a} />
                ))}
              </div>
            ) : (
              <EmptyState icon={TriangleAlert} title="No alerts on this board" />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Per-phase values" flush>
            <table className="w-full text-sm">
              <thead className="bg-navy-50/60 text-xs font-semibold tracking-wide text-navy-500 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Phase</th>
                  <th className="px-3 py-2 text-right">Voltage</th>
                  <th className="px-3 py-2 text-right">Current</th>
                  <th className="px-3 py-2 text-right">Load</th>
                  <th className="px-4 py-2 text-right">THD-I</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50 tabular-nums">
                {reading.phases.map((p, i) => {
                  const pct = (p.currentA / smdb.ratedCurrentA) * 100
                  return (
                    <tr key={i}>
                      <td className="px-4 py-2.5 font-semibold text-navy-900">L{i + 1}</td>
                      <td className={`px-3 py-2.5 text-right ${p.voltageV < low || p.voltageV > high ? 'font-semibold text-amber-700' : ''}`}>{p.voltageV.toFixed(1)} V</td>
                      <td className="px-3 py-2.5 text-right">{p.currentA.toFixed(1)} A</td>
                      <td className={`px-3 py-2.5 text-right ${pct > t.critLoadPct ? 'font-semibold text-red-700' : pct > t.warnLoadPct ? 'font-semibold text-amber-700' : ''}`}>
                        {Math.round(pct)}%
                      </td>
                      <td className={`px-4 py-2.5 text-right ${p.thdPct > 20 ? 'font-semibold text-amber-700' : ''}`}>{p.thdPct.toFixed(1)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-navy-100 px-4 py-3 text-sm">
              {[
                ['Active power', `${formatNumber(reading.kW, 1)} kW`],
                ['Apparent power', `${formatNumber(reading.kVA, 1)} kVA`],
                ['Reactive power', `${formatNumber(reading.kVAr, 1)} kVAr`],
                ['Power factor', reading.pf.toFixed(2)],
                ['Frequency', `${reading.frequencyHz.toFixed(2)} Hz`],
                ['Phase imbalance', `${health.imbalancePct.toFixed(1)}%`],
                ['Energy counter', `${formatNumber(reading.kWh)} kWh`],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-navy-500">{label}</dt>
                  <dd className="font-semibold tabular-nums text-navy-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card
            title="Alarm thresholds"
            actions={
              can(user, 'smdb.editThresholds') && (
                <Link to={`/settings?smdb=${smdb.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:underline">
                  <SlidersHorizontal className="size-4" aria-hidden />
                  Edit
                </Link>
              )
            }
          >
            <dl className="space-y-1.5 text-sm">
              {[
                ['Warning load', `> ${t.warnLoadPct}%`],
                ['Critical load', `> ${t.critLoadPct}%`],
                ['Phase imbalance', `> ${t.imbalancePct}%`],
                ['Voltage band', `${t.nominalVoltageV} V ± ${t.voltageTolPct}%`],
                ['Minimum power factor', t.minPf.toFixed(2)],
                ['Tripped', 'zero current on all phases'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-navy-500">{label}</dt>
                  <dd className="font-medium text-navy-800">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="Metering">
            <p className="flex items-start gap-2 text-sm text-navy-600">
              <Cpu className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Selec energy meter <span className="font-semibold">{smdb.meterId}</span> (RS-485 / Modbus) → Kuroshio IoT node{' '}
                {can(user, 'devices.view') ? (
                  <Link to="/devices" className="font-semibold text-teal-700 hover:underline">
                    {smdb.nodeId}
                  </Link>
                ) : (
                  <span className="font-semibold">{smdb.nodeId}</span>
                )}{' '}
                (ESP32-S3 + SIM7080G cellular) → EnergyIQ cloud. Values shown here are simulated for the demo.
              </span>
            </p>
            <p className="mt-3 flex items-start gap-2 text-sm text-navy-600">
              <Receipt className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Billed to cost centre <span className="font-semibold">{smdb.costCentre}</span>
              </span>
            </p>
          </Card>

          {can(user, 'smdb.simulateFault') && (
            <Card title="Simulate fault">
              <FaultControls smdbId={smdb.id} />
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
