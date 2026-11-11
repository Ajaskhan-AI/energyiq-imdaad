import { format, startOfDay, startOfMonth, subDays } from 'date-fns'
import { BellRing, ChevronRight, ClipboardList, Coins, Flag, Gauge, HeartPulse, Leaf, Radio, Zap } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { can } from '../../auth/permissions'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { AlertCard } from '../../components/alerts/AlertCard'
import { LiveIndicator, SmdbStatusBadge } from '../../components/smdb/SmdbBits'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { KpiCard } from '../../components/ui/KpiCard'
import { ASSETS } from '../../data/assets'
import { getEnergyHistory } from '../../data/energy'
import { getClient, SITES, SITE_TYPE_LABELS } from '../../data/sites'
import { SMDBS } from '../../data/smdbs'
import { isWeekend } from '../../lib/calendar'
import { kwhToTonnesCo2 } from '../../lib/co2'
import { fromISODate, toISODate } from '../../lib/dates'
import { analyseEnergy, groupPatterns } from '../../lib/energyAnalysis'
import { formatNumber } from '../../lib/format'
import { filterBySite, scopedSiteIds, siteFilterLabel } from '../../lib/scope'
import { worstStatus } from '../../lib/smdb'
import { MARGINAL_AED_PER_KWH } from '../../lib/tariff'
import { energyBetween } from '../../sim/smdbModel'
import { useSimulator } from '../../sim/simulatorContext'
import { usePredictive } from '../../sim/usePredictive'
import { actions } from '../../store/actions'
import { useAppDispatch, useAppState } from '../../store/hooks'

const AXIS = { fontSize: 11, fill: '#6a87c4' }

/**
 * Portfolio overview: every number is calculated live from the store, the
 * simulator and the meter history (nothing hard-coded).
 */
export default function OverviewPage() {
  const state = useAppState()
  const user = useCurrentUser()
  const sim = useSimulator()
  const assessments = usePredictive()
  const { site, calendar } = state

  const now = new Date()
  const ids = scopedSiteIds(user, site)
  const sites = SITES.filter((s) => ids.has(s.id))
  const boards = SMDBS.filter((b) => ids.has(b.siteId))

  // ---------- Live ----------
  const liveKw = boards.reduce((s, b) => s + (sim.health[b.id]?.status === 'offline' ? 0 : (sim.readings[b.id]?.kW ?? 0)), 0)
  const first = boards[0] ? sim.history[boards[0].id] : []
  const liveSeries = [
    ...first.map((p, i) => ({ t: p.t, kW: Math.round(boards.reduce((s, b) => s + (sim.history[b.id]?.[i]?.kW ?? 0), 0)) })),
    { t: sim.updatedAt, kW: Math.round(liveKw) },
  ]
  const todayKwhBy = (list: typeof boards) => list.reduce((s, b) => s + energyBetween(b, startOfDay(now), now, calendar), 0)
  const todayKwh = todayKwhBy(boards)

  // ---------- History ----------
  const history = getEnergyHistory(now) // cached per day inside getEnergyHistory
  const analysis = useMemo(() => analyseEnergy(history.boards, calendar, 365), [history, calendar])
  const monthStart = toISODate(startOfMonth(now))
  const monthKwh = history.buildings.filter((r) => ids.has(r.siteId) && r.date >= monthStart).reduce((s, r) => s + r.kWh, 0) + todayKwh
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const date = toISODate(subDays(now, 14 - i))
    const kWh = history.buildings.filter((r) => r.date === date && ids.has(r.siteId)).reduce((s, r) => s + r.kWh, 0)
    const holiday = calendar.some((p) => p.type === 'holiday' && !p.siteId && date >= p.start && date <= p.end)
    return { date, label: format(fromISODate(date), 'EEE d'), kWh, closed: holiday || isWeekend(fromISODate(date)) }
  })

  // ---------- Waste (last 90 days) ----------
  const from90 = toISODate(subDays(now, 90))
  const patterns = groupPatterns(
    analysis.flags.filter((f) => f.date >= from90 && ids.has(f.siteId)),
    90,
  ).filter((p) => !state.reviewedWasteIds.includes(p.id))
  const wasteAnnualAed = patterns.reduce((s, p) => s + p.annualAed, 0)

  // ---------- Alerts, assets, devices, work orders ----------
  const activeAlerts = filterBySite(state.alerts, user, site)
    .filter((a) => !a.resolvedAt && (a.source !== 'device' || can(user, 'devices.view')))
    .sort((a, b) => Number(b.severity === 'critical') - Number(a.severity === 'critical') || b.createdAt.localeCompare(a.createdAt))
  const critical = activeAlerts.filter((a) => a.severity === 'critical').length
  const health = assessments.filter((a) => ids.has(ASSETS.find((x) => x.id === a.assetId)?.siteId ?? ''))
  const nodes = sim.nodes.filter((n) => ids.has(n.node.siteId))
  const nodesUp = nodes.filter((n) => n.status !== 'offline').length
  const openWos = filterBySite(state.workOrders, user, site).filter((w) => w.status !== 'closed')

  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            {greeting}, {user?.name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-navy-500">
            {siteFilterLabel(user, site)} · {sites.length} site{sites.length === 1 ? '' : 's'} · {boards.length} SMDBs metered · {format(now, 'EEEE d MMMM yyyy')}
          </p>
        </div>
        <LiveIndicator updatedAt={sim.updatedAt} intervalMs={sim.intervalMs} />
      </div>

      {/* KPI row: every card links to its module */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiCard label="Live load" value={`${formatNumber(liveKw)} kW`} sub={`Today so far ${formatNumber(todayKwh / 1000, 1)} MWh`} icon={Gauge} tone="info" to="/smdb" />
        <KpiCard
          label="Active alerts"
          value={activeAlerts.length}
          sub={critical ? `${critical} critical` : 'None critical'}
          icon={BellRing}
          tone={critical ? 'alert' : activeAlerts.length ? 'warn' : 'ok'}
          to="/smdb/alerts"
        />
        <KpiCard
          label="Waste found"
          value={`AED ${formatNumber(wasteAnnualAed / 1000)}k / yr`}
          sub={`${patterns.length} open pattern${patterns.length === 1 ? '' : 's'} (last 90 days)`}
          icon={Flag}
          tone={patterns.length ? 'warn' : 'ok'}
          to="/energy?tab=waste"
        />
        <KpiCard
          label={`Cost — ${format(now, 'MMMM')}`}
          value={`AED ${formatNumber((monthKwh * MARGINAL_AED_PER_KWH) / 1000)}k`}
          sub={`${formatNumber(monthKwh / 1000)} MWh month to date (indicative)`}
          icon={Coins}
          tone="neutral"
          to={can(user, 'billing.view') ? '/billing' : '/energy'}
        />
        <KpiCard label={`CO₂ — ${format(now, 'MMMM')}`} value={`${formatNumber(kwhToTonnesCo2(monthKwh), 0)} t`} sub="Scope 2, month to date (indicative)" icon={Leaf} tone="ok" to="/carbon" />
        {can(user, 'devices.view') ? (
          <KpiCard label="IoT nodes online" value={`${nodesUp} / ${nodes.length}`} sub={nodes.length - nodesUp ? `${nodes.length - nodesUp} offline` : 'All reporting'} icon={Radio} tone={nodesUp < nodes.length ? 'warn' : 'ok'} to="/devices" />
        ) : (
          <KpiCard label="Open work orders" value={openWos.length} sub="Raised from alerts & analytics" icon={ClipboardList} tone={openWos.length ? 'warn' : 'ok'} to="/work-orders" />
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Live electrical load — last 24 h" subtitle={`${boards.length} SMDBs · now ${formatNumber(liveKw)} kW`} actions={<CardLink to="/smdb" label="SMDB monitoring" />}>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={liveSeries} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="ovLoad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#014cc3" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#014cc3" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e3eaf8" vertical={false} />
                <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(t: number) => format(t, 'HH:mm')} tick={AXIS} />
                <YAxis tickFormatter={(v: number) => `${formatNumber(v)}`} tick={AXIS} width={48} />
                <Tooltip labelFormatter={(t) => format(Number(t), 'EEE HH:mm')} formatter={(v) => [`${formatNumber(Number(v))} kW`, 'Load']} />
                <Area type="monotone" dataKey="kW" stroke="#014cc3" strokeWidth={2} fill="url(#ovLoad)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Active alerts" subtitle="SMDB, asset health and devices" actions={<CardLink to="/smdb/alerts" label="Alerts center" />}>
          {activeAlerts.length ? (
            <div className="space-y-3">
              {activeAlerts.slice(0, 3).map((a) => (
                <AlertCard key={a.id} alert={a} compact />
              ))}
              {activeAlerts.length > 3 && <p className="text-sm text-navy-500">+{activeAlerts.length - 3} more</p>}
            </div>
          ) : (
            <EmptyState icon={BellRing} title="No active alerts" />
          )}
        </Card>

        <Card className="lg:col-span-3" flush title="Sites" subtitle="Live status per site. Click a site to filter the whole app to it.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-navy-50/60 text-xs font-semibold tracking-wide text-navy-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Site</th>
                  <th className="px-3 py-3">Client</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Live load</th>
                  <th className="px-3 py-3 text-right">Today</th>
                  <th className="px-3 py-3 text-right">Alerts</th>
                  <th className="px-5 py-3 text-right">Waste / yr</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {sites.map((s) => {
                  const list = boards.filter((b) => b.siteId === s.id)
                  const kw = list.reduce((sum, b) => sum + (sim.health[b.id]?.status === 'offline' ? 0 : (sim.readings[b.id]?.kW ?? 0)), 0)
                  const status = worstStatus(list.map((b) => sim.health[b.id]?.status ?? 'normal'))
                  const alerts = activeAlerts.filter((a) => a.siteId === s.id).length
                  const waste = patterns.filter((p) => p.siteId === s.id).reduce((sum, p) => sum + p.annualAed, 0)
                  return (
                    <tr key={s.id} className="hover:bg-navy-50/50">
                      <td className="px-5 py-3">
                        <SiteLink id={s.id} name={s.name} />
                        <span className="block text-xs text-navy-500">
                          {SITE_TYPE_LABELS[s.type]} · {s.area}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-navy-700">{getClient(s.clientId)?.name}</td>
                      <td className="px-3 py-3">
                        <SmdbStatusBadge status={status} />
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatNumber(kw)} kW</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatNumber(todayKwhBy(list))} kWh</td>
                      <td className={`px-3 py-3 text-right tabular-nums ${alerts ? 'font-semibold text-amber-700' : 'text-navy-400'}`}>{alerts}</td>
                      <td className={`px-5 py-3 text-right tabular-nums ${waste ? 'font-semibold text-amber-800' : 'text-navy-400'}`}>{waste ? `AED ${formatNumber(waste)}` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="lg:col-span-2" title="Electricity — last 14 days" subtitle="Navy = working days · amber = weekends and public holidays" actions={<CardLink to="/energy" label="Energy analytics" />}>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last14} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#e3eaf8" vertical={false} />
                <XAxis dataKey="label" tick={AXIS} interval={0} />
                <YAxis tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} tick={AXIS} width={40} />
                <Tooltip formatter={(v) => [`${formatNumber(Number(v))} kWh`, 'Electricity']} labelFormatter={(_l, p) => (p?.[0]?.payload ? format(fromISODate((p[0].payload as (typeof last14)[number]).date), 'EEE d MMM') : '')} />
                <Bar dataKey="kWh" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  {last14.map((d) => (
                    <Cell key={d.date} fill={d.closed ? '#f59e0b' : '#2f4f92'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Top waste patterns" subtitle="Last 90 days, not yet reviewed" actions={<CardLink to="/energy?tab=waste" label="Review" />}>
          {patterns.length === 0 ? (
            <EmptyState icon={Flag} title="No open waste patterns" />
          ) : (
            <ul className="space-y-3">
              {patterns.slice(0, 4).map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium text-navy-900">{p.title}</span>
                    <span className="block text-xs text-navy-500">
                      {SITES.find((s) => s.id === p.siteId)?.shortName} · {p.days} days flagged
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-semibold text-amber-800 tabular-nums">≈ AED {formatNumber(p.annualAed)}/yr</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-navy-500">Indicative, if the pattern continues. Savings to be measured during the pilot.</p>
        </Card>

        {can(user, 'assets.view') && (
          <Card title="Asset health" subtitle={`${health.length} CT-monitored assets`} actions={<CardLink to="/assets" label="Asset health" />}>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                ['OK', health.filter((a) => a.status === 'ok').length, 'text-green-700'],
                ['Watch', health.filter((a) => a.status === 'watch').length, 'text-amber-700'],
                ['Alert', health.filter((a) => a.status === 'alert').length, 'text-red-700'],
              ].map(([label, n, color]) => (
                <div key={label as string} className="rounded-lg bg-navy-50/60 py-2">
                  <dd className={`text-2xl font-bold ${color as string}`}>{n}</dd>
                  <dt className="text-xs text-navy-500">{label}</dt>
                </div>
              ))}
            </dl>
            <ul className="mt-3 space-y-1.5 text-sm">
              {health
                .filter((a) => a.status !== 'ok')
                .sort((a, b) => a.health - b.health)
                .map((a) => (
                  <li key={a.assetId}>
                    <Link to={`/assets/${a.assetId}`} className="flex items-center justify-between gap-2 hover:text-teal-700">
                      <span className="flex items-center gap-1.5 truncate">
                        <HeartPulse className={a.status === 'alert' ? 'size-4 text-red-600' : 'size-4 text-amber-600'} aria-hidden />
                        {ASSETS.find((x) => x.id === a.assetId)?.name} · {ASSETS.find((x) => x.id === a.assetId)?.siteId}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{a.health}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </Card>
        )}

        {can(user, 'workorders.view') && (
          <Card title="Work orders" subtitle="Raised from alerts and analytics" actions={<CardLink to="/work-orders" label="All" />}>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                ['Open', openWos.filter((w) => w.status === 'open').length, 'text-amber-700'],
                ['In progress', openWos.filter((w) => w.status === 'in_progress').length, 'text-sky-700'],
                ['Not in CAFM', openWos.filter((w) => !w.cafmRef).length, 'text-navy-700'],
              ].map(([label, n, color]) => (
                <div key={label as string} className="rounded-lg bg-navy-50/60 py-2">
                  <dd className={`text-2xl font-bold ${color as string}`}>{n}</dd>
                  <dt className="text-xs text-navy-500">{label}</dt>
                </div>
              ))}
            </dl>
            <ul className="mt-3 space-y-1.5 text-sm">
              {openWos.slice(0, 4).map((w) => (
                <li key={w.id}>
                  <Link to={`/work-orders/${w.id}`} className="flex gap-2 hover:text-teal-700">
                    <span className="font-mono text-xs font-semibold text-teal-700">{w.id}</span>
                    <span className="truncate">{w.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card title="What EnergyIQ adds for an FM provider" subtitle="Why this matters for the portfolio">
          <ul className="space-y-2 text-sm text-navy-700">
            <li className="flex gap-2">
              <Zap className="mt-0.5 size-4 shrink-0 text-teal-600" aria-hidden />
              Live view of every SMDB across all client sites, with alerts before a trip becomes a complaint.
            </li>
            <li className="flex gap-2">
              <Flag className="mt-0.5 size-4 shrink-0 text-teal-600" aria-hidden />
              Energy waste found automatically and turned into work orders: a saving Imdaad can show each client.
            </li>
            <li className="flex gap-2">
              <Coins className="mt-0.5 size-4 shrink-0 text-teal-600" aria-hidden />
              Metered tenant recharge and monthly client reports, ready to send.
            </li>
          </ul>
        </Card>
      </div>
    </>
  )
}

/** Site name that switches the top-bar site filter to that site and opens its boards. */
function SiteLink({ id, name }: { id: string; name: string }) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => {
        dispatch(actions.setSite(id))
        navigate('/smdb')
      }}
      className="text-left font-medium text-navy-900 hover:text-teal-700 hover:underline"
    >
      {name}
    </button>
  )
}

function CardLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-0.5 text-sm font-medium text-teal-700 hover:underline">
      {label}
      <ChevronRight className="size-4" aria-hidden />
    </Link>
  )
}
