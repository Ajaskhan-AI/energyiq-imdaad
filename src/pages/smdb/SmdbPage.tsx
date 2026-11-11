import { BellRing, CircleCheck, ClipboardList, Gauge as GaugeIcon, Siren, TriangleAlert, WifiOff, Zap } from 'lucide-react'
import { Link } from 'react-router'
import { can } from '../../auth/permissions'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { AlertCard } from '../../components/alerts/AlertCard'
import { FaultControls } from '../../components/smdb/FaultControls'
import { LiveIndicator, LoadBar, SmdbStatusBadge } from '../../components/smdb/SmdbBits'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { KpiCard } from '../../components/ui/KpiCard'
import { PageHeader } from '../../components/ui/PageHeader'
import { buttonClass } from '../../components/ui/styles'
import { BUILDINGS, SITES } from '../../data/sites'
import { DEFAULT_THRESHOLDS } from '../../data/smdbs'
import { formatNumber } from '../../lib/format'
import { filterBySite } from '../../lib/scope'
import { visibleSmdbs, worstStatus } from '../../lib/smdb'
import { useSimulator } from '../../sim/simulatorContext'
import { useAppState } from '../../store/hooks'

/** Every board per site and building, live, plus the active alerts. */
export default function SmdbPage() {
  const state = useAppState()
  const user = useCurrentUser()
  const sim = useSimulator()

  const boards = visibleSmdbs(user, state.site)
  const boardIds = new Set(boards.map((b) => b.id))
  const sites = SITES.filter((s) => boards.some((b) => b.siteId === s.id))
  const statuses = boards.map((b) => sim.health[b.id]?.status ?? 'normal')
  const count = (s: string) => statuses.filter((x) => x === s).length
  const totalKw = boards.reduce((sum, b) => sum + (sim.health[b.id]?.status === 'offline' ? 0 : (sim.readings[b.id]?.kW ?? 0)), 0)
  const activeAlerts = state.alerts
    .filter((a) => a.source === 'smdb' && !a.resolvedAt && a.smdbId && boardIds.has(a.smdbId))
    .sort((a, b) => Number(b.severity === 'critical') - Number(a.severity === 'critical') || b.createdAt.localeCompare(a.createdAt))
  const openWorkOrders = filterBySite(state.workOrders, user, state.site).filter((w) => w.status !== 'closed')

  return (
    <>
      <PageHeader
        title="SMDB live monitoring"
        description="Sub-main distribution boards read every few seconds from Selec energy meters via Kuroshio IoT nodes: load, voltage, current, power factor and status."
        actions={
          <>
            <LiveIndicator updatedAt={sim.updatedAt} intervalMs={sim.intervalMs} />
            <Link to="/smdb/alerts" className={buttonClass('secondary')}>
              <BellRing className="size-4" aria-hidden />
              Alerts center
              {activeAlerts.length > 0 && <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">{activeAlerts.length}</span>}
            </Link>
          </>
        }
      />

      {boards.length === 0 ? (
        <Card>
          <EmptyState icon={Zap} title="No boards on this site" />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard label="Boards normal" value={`${count('normal')} / ${boards.length}`} icon={CircleCheck} tone="ok" />
            <KpiCard label="Warning" value={count('warning')} sub="Above a warning threshold" icon={TriangleAlert} tone={count('warning') ? 'warn' : 'ok'} />
            <KpiCard label="Critical / tripped" value={count('critical') + count('tripped')} sub="Needs action now" icon={Siren} tone={count('critical') + count('tripped') ? 'alert' : 'ok'} />
            <KpiCard label="No data" value={count('offline')} sub="IoT node offline" icon={WifiOff} tone={count('offline') ? 'warn' : 'ok'} to={can(user, 'devices.view') ? '/devices' : undefined} />
            <KpiCard label="Live load" value={`${formatNumber(totalKw)} kW`} sub={`${boards.length} boards`} icon={GaugeIcon} tone="info" />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <div className="space-y-8 xl:col-span-2">
              {sites.map((site) => {
                const siteBoards = boards.filter((b) => b.siteId === site.id)
                const siteKw = siteBoards.reduce((sum, b) => sum + (sim.readings[b.id]?.kW ?? 0), 0)
                return (
                  <section key={site.id}>
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="text-lg font-semibold text-navy-900">
                        {site.name} <span className="text-sm font-normal text-navy-500">· {site.area}</span>
                      </h2>
                      <span className="text-sm font-medium text-navy-600 tabular-nums">{formatNumber(siteKw)} kW now</span>
                    </div>
                    <div className="grid content-start gap-4 md:grid-cols-2">
                      {BUILDINGS.filter((bld) => bld.siteId === site.id).map((building) => {
                        const list = siteBoards.filter((s) => s.buildingId === building.id)
                        if (!list.length) return null
                        const worst = worstStatus(list.map((s) => sim.health[s.id]?.status ?? 'normal'))
                        const kw = list.reduce((sum, s) => sum + (sim.readings[s.id]?.kW ?? 0), 0)
                        return (
                          <Card key={building.id} title={building.shortName} subtitle={`${list.length} boards · ${formatNumber(kw)} kW now`} actions={<SmdbStatusBadge status={worst} />}>
                            <ul className="space-y-3">
                              {list.map((smdb) => {
                                const health = sim.health[smdb.id]
                                const t = state.thresholds[smdb.id] ?? DEFAULT_THRESHOLDS
                                const offline = health?.status === 'offline'
                                return (
                                  <li key={smdb.id}>
                                    <Link to={`/smdb/${smdb.id}`} className="-m-2 block rounded-lg p-2 hover:bg-navy-50/70">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="min-w-0">
                                          <span className="block truncate font-medium text-navy-900">{smdb.name}</span>
                                          <span className="block truncate text-xs text-navy-500">{smdb.location}</span>
                                        </span>
                                        <span className="flex shrink-0 items-center gap-2">
                                          <span className={`text-sm font-semibold tabular-nums ${offline ? 'text-navy-400' : 'text-navy-900'}`}>
                                            {formatNumber(sim.readings[smdb.id]?.kW ?? 0)} kW
                                          </span>
                                          <SmdbStatusBadge status={health?.status ?? 'normal'} />
                                        </span>
                                      </div>
                                      <div className="mt-2 flex items-center gap-2">
                                        <LoadBar pct={offline ? 0 : (health?.loadPct ?? 0)} warn={t.warnLoadPct} crit={t.critLoadPct} />
                                        <span className="w-12 shrink-0 text-right text-xs text-navy-600 tabular-nums">{offline ? '—' : `${Math.round(health?.loadPct ?? 0)}%`}</span>
                                      </div>
                                    </Link>
                                  </li>
                                )
                              })}
                            </ul>
                          </Card>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>

            <div className="space-y-6">
              <Card
                title="Active alerts"
                subtitle="Raised automatically from the live readings"
                actions={
                  <Link to="/smdb/alerts" className="text-sm font-medium text-teal-700 hover:underline">
                    View all
                  </Link>
                }
              >
                {activeAlerts.length === 0 ? (
                  <EmptyState icon={CircleCheck} title="No active alerts">
                    All boards are within their thresholds.
                  </EmptyState>
                ) : (
                  <div className="space-y-3">
                    {activeAlerts.slice(0, 5).map((a) => (
                      <AlertCard key={a.id} alert={a} compact />
                    ))}
                  </div>
                )}
              </Card>

              {can(user, 'workorders.view') && (
                <Card title="Open work orders" subtitle="Raised from alerts and analytics, not yet closed">
                  <div className="flex items-center justify-between">
                    <p className="text-3xl font-bold text-navy-900">{openWorkOrders.length}</p>
                    <Link to="/work-orders" className={buttonClass('secondary', 'sm')}>
                      <ClipboardList className="size-4" aria-hidden />
                      Work orders
                    </Link>
                  </div>
                </Card>
              )}

              {can(user, 'smdb.simulateFault') && (
                <Card title="Simulate fault">
                  <FaultControls />
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
