import { BellRing, ChevronRight, CircleCheck, ClipboardList, Gauge as GaugeIcon, Search, Siren, TriangleAlert, WifiOff, Zap, type LucideIcon } from 'lucide-react'
import { Fragment, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Input } from '@/components/shadcn/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/shadcn/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/shadcn/tabs'
import { cn } from '@/lib/utils'
import { can } from '../../auth/permissions'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { AlertCard } from '../../components/alerts/AlertCard'
import { FaultControls } from '../../components/smdb/FaultControls'
import { LiveIndicator, LoadBar, SmdbStatusBadge } from '../../components/smdb/SmdbBits'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { buttonClass } from '../../components/ui/styles'
import { BUILDINGS, getClient, SITES } from '../../data/sites'
import { DEFAULT_THRESHOLDS, LOAD_TYPE_LABELS } from '../../data/smdbs'
import { formatNumber } from '../../lib/format'
import { filterBySite } from '../../lib/scope'
import { visibleSmdbs, worstStatus } from '../../lib/smdb'
import { useSimulator } from '../../sim/simulatorContext'
import { useAppState } from '../../store/hooks'
import type { Smdb, SmdbStatus } from '../../types'

type Filter = 'all' | 'attention' | 'normal' | 'offline'
const FILTERS: Array<{ id: Filter; label: string; match: (s: SmdbStatus) => boolean }> = [
  { id: 'all', label: 'All boards', match: () => true },
  { id: 'attention', label: 'Needs attention', match: (s) => s === 'warning' || s === 'critical' || s === 'tripped' },
  { id: 'normal', label: 'Normal', match: (s) => s === 'normal' },
  { id: 'offline', label: 'No data', match: (s) => s === 'offline' },
]

/** "SMDB-01 · HVAC plant" → ["SMDB-01", "HVAC plant"] */
function splitName(smdb: Smdb): [string, string] {
  const [code, ...rest] = smdb.name.split(' · ')
  return [code, rest.join(' · ') || smdb.name]
}

/** Every board, per site and building, live, in an aligned table, plus the active alerts. */
export default function SmdbPage() {
  const state = useAppState()
  const user = useCurrentUser()
  const sim = useSimulator()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const boards = visibleSmdbs(user, state.site)
  const boardIds = new Set(boards.map((b) => b.id))
  const statusOf = (b: Smdb): SmdbStatus => sim.health[b.id]?.status ?? 'normal'
  const count = (match: (s: SmdbStatus) => boolean) => boards.filter((b) => match(statusOf(b))).length
  const liveKw = (list: Smdb[]) => list.reduce((sum, b) => sum + (statusOf(b) === 'offline' ? 0 : (sim.readings[b.id]?.kW ?? 0)), 0)

  // Filters: status tab + free-text search (board, meter, location, building, cost centre).
  const q = query.trim().toLowerCase()
  const match = FILTERS.find((f) => f.id === filter)?.match ?? (() => true)
  const shown = boards.filter((b) => {
    if (!match(statusOf(b))) return false
    if (!q) return true
    const building = BUILDINGS.find((x) => x.id === b.buildingId)
    return `${b.name} ${b.meterId} ${b.location} ${b.costCentre} ${building?.name ?? ''}`.toLowerCase().includes(q)
  })
  const sites = SITES.filter((s) => shown.some((b) => b.siteId === s.id))

  const activeAlerts = state.alerts
    .filter((a) => a.source === 'smdb' && !a.resolvedAt && a.smdbId && boardIds.has(a.smdbId))
    .sort((a, b) => Number(b.severity === 'critical') - Number(a.severity === 'critical') || b.createdAt.localeCompare(a.createdAt))
  const openWorkOrders = filterBySite(state.workOrders, user, state.site).filter((w) => w.status !== 'closed')

  return (
    <>
      <PageHeader
        title="SMDB live monitoring"
        description="Every sub-main distribution board, read every few seconds from its Selec energy meter through a Kuroshio IoT node."
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

      {/* Status summary: one strip, each number filters the table */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-navy-100 shadow-sm sm:grid-cols-3 xl:grid-cols-5">
        <SummaryStat icon={GaugeIcon} label="Live load" value={`${formatNumber(liveKw(boards))} kW`} sub={`${boards.length} boards`} tone="info" />
        <SummaryStat icon={CircleCheck} label="Normal" value={count(FILTERS[2].match)} sub="Within all thresholds" tone="ok" active={filter === 'normal'} onClick={() => setFilter('normal')} />
        <SummaryStat
          icon={TriangleAlert}
          label="Warning"
          value={count((s) => s === 'warning')}
          sub="Above a warning limit"
          tone={count((s) => s === 'warning') ? 'warn' : 'ok'}
          active={filter === 'attention'}
          onClick={() => setFilter('attention')}
        />
        <SummaryStat
          icon={Siren}
          label="Critical / tripped"
          value={count((s) => s === 'critical' || s === 'tripped')}
          sub="Needs action now"
          tone={count((s) => s === 'critical' || s === 'tripped') ? 'alert' : 'ok'}
          active={filter === 'attention'}
          onClick={() => setFilter('attention')}
        />
        <SummaryStat
          icon={WifiOff}
          label="No data"
          value={count(FILTERS[3].match)}
          sub="IoT node offline"
          className="col-span-2 sm:col-span-1"
          tone={count(FILTERS[3].match) ? 'warn' : 'ok'}
          active={filter === 'offline'}
          onClick={() => setFilter('offline')}
        />
      </div>

      {/* Active alerts, right where they are noticed */}
      {activeAlerts.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-navy-950">
              <BellRing className="size-5 text-red-600" aria-hidden />
              Active alerts <span className="text-base font-normal text-navy-500">({activeAlerts.length})</span>
            </h2>
            <Link to="/smdb/alerts" className="inline-flex items-center gap-0.5 text-sm font-semibold text-teal-700 hover:underline">
              All alerts
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {activeAlerts.slice(0, 3).map((a) => (
              <AlertCard key={a.id} alert={a} compact />
            ))}
          </div>
        </section>
      )}

      {/* Toolbar */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList className="h-auto flex-wrap bg-navy-50 p-1">
            {FILTERS.map((f) => (
              <TabsTrigger key={f.id} value={f.id} className="h-8 flex-none px-3 text-[13px] data-[state=active]:text-teal-700">
                {f.label}
                <span className="ml-1 rounded-full bg-navy-100 px-1.5 text-xs tabular-nums">{count(f.match)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <label className="relative ml-auto w-full sm:w-72">
          <span className="sr-only">Search boards</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-navy-400" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search board, meter, location…" className="h-9 bg-white pl-9" />
        </label>
      </div>

      {/* One table per site, rows grouped by building */}
      <div className="mt-4 space-y-6">
        {boards.length === 0 ? (
          <Card>
            <EmptyState icon={Zap} title="No boards on this site" />
          </Card>
        ) : sites.length === 0 ? (
          <Card>
            <EmptyState icon={Search} title="No boards match these filters">
              <button type="button" onClick={() => (setFilter('all'), setQuery(''))} className="font-semibold text-teal-700 hover:underline">
                Clear filters
              </button>
            </EmptyState>
          </Card>
        ) : (
          sites.map((site) => {
            const siteBoards = shown.filter((b) => b.siteId === site.id)
            const allSiteBoards = boards.filter((b) => b.siteId === site.id)
            return (
              <section key={site.id} className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-navy-50/50 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-navy-950">{site.name}</h2>
                    <p className="text-sm text-navy-500">
                      {getClient(site.clientId)?.name} · {site.area}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-navy-950 tabular-nums">{formatNumber(liveKw(allSiteBoards))} kW</p>
                    <p className="text-xs text-navy-500">{allSiteBoards.length} boards now</p>
                  </div>
                  <SmdbStatusBadge status={worstStatus(allSiteBoards.map(statusOf))} />
                </header>

                <Table className="min-w-[860px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[34%] pl-5 text-xs font-semibold tracking-wide text-navy-500 uppercase">Board</TableHead>
                      <TableHead className="text-right text-xs font-semibold tracking-wide text-navy-500 uppercase">Live load</TableHead>
                      <TableHead className="w-[22%] text-xs font-semibold tracking-wide text-navy-500 uppercase">Load vs breaker</TableHead>
                      <TableHead className="text-right text-xs font-semibold tracking-wide text-navy-500 uppercase">PF</TableHead>
                      <TableHead className="text-right text-xs font-semibold tracking-wide text-navy-500 uppercase">Voltage</TableHead>
                      <TableHead className="text-xs font-semibold tracking-wide text-navy-500 uppercase">Status</TableHead>
                      <TableHead className="w-8 pr-4" aria-label="Open" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {BUILDINGS.filter((bld) => bld.siteId === site.id).map((building) => {
                      const rows = siteBoards.filter((b) => b.buildingId === building.id)
                      if (!rows.length) return null
                      return (
                        <Fragment key={building.id}>
                          <TableRow className="bg-white hover:bg-white">
                            <TableCell colSpan={7} className="pt-4 pb-1.5 pl-5 text-xs font-semibold tracking-wide text-teal-700 uppercase">
                              {building.shortName}
                              <span className="ml-2 font-medium tracking-normal text-navy-400 normal-case">
                                {rows.length} board{rows.length === 1 ? '' : 's'} · {formatNumber(liveKw(rows))} kW
                              </span>
                            </TableCell>
                          </TableRow>
                          {rows.map((smdb) => (
                            renderRow(smdb)
                          ))}
                        </Fragment>
                      )
                    })}
                  </TableBody>
                </Table>
              </section>
            )
          })
        )}
      </div>

      {/* Footer cards */}
      {(can(user, 'workorders.view') || can(user, 'smdb.simulateFault')) && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {can(user, 'workorders.view') && (
            <Card title="Open work orders" subtitle="Raised from alerts and analytics, not yet closed">
              <div className="flex items-center justify-between">
                <p className="text-3xl font-bold text-navy-950 tabular-nums">{openWorkOrders.length}</p>
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
      )}
    </>
  )

  /** One board row (a plain function, not a component, so rows aren't remounted on every live update). */
  function renderRow(smdb: Smdb) {
    const health = sim.health[smdb.id]
    const reading = sim.readings[smdb.id]
    const t = state.thresholds[smdb.id] ?? DEFAULT_THRESHOLDS
    const offline = health?.status === 'offline'
    const avgV = reading ? reading.phases.reduce((s, p) => s + p.voltageV, 0) / 3 : 0
    const [code, name] = splitName(smdb)
    return (
      <TableRow key={smdb.id} onClick={() => navigate(`/smdb/${smdb.id}`)} className={cn('cursor-pointer', offline && 'text-navy-400')}>
        <TableCell className="py-3 pl-5 whitespace-normal">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 rounded-md bg-navy-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-navy-600 ring-1 ring-navy-100">{code}</span>
            <div className="min-w-0">
              <Link to={`/smdb/${smdb.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-navy-950 hover:text-teal-700">
                {name}
              </Link>
              <p className="text-xs text-navy-500">
                {LOAD_TYPE_LABELS[smdb.loadType]} · {smdb.location}
              </p>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-right text-[15px] font-semibold text-navy-950 tabular-nums">{offline ? '—' : `${formatNumber(reading?.kW ?? 0)} kW`}</TableCell>
        <TableCell>
          {offline ? (
            <span className="text-xs">Last value held</span>
          ) : (
            <div className="flex items-center gap-2.5">
              <LoadBar pct={health?.loadPct ?? 0} warn={t.warnLoadPct} crit={t.critLoadPct} />
              <span className="w-10 shrink-0 text-right text-sm font-medium tabular-nums">{Math.round(health?.loadPct ?? 0)}%</span>
            </div>
          )}
          <p className="mt-0.5 text-[11px] text-navy-400">{smdb.ratedCurrentA} A breaker</p>
        </TableCell>
        <TableCell className={cn('text-right tabular-nums', !offline && reading && reading.pf < t.minPf && 'font-semibold text-amber-700')}>{offline ? '—' : reading?.pf.toFixed(2)}</TableCell>
        <TableCell className="text-right tabular-nums">{offline ? '—' : `${avgV.toFixed(0)} V`}</TableCell>
        <TableCell>
          <SmdbStatusBadge status={health?.status ?? 'normal'} />
        </TableCell>
        <TableCell className="pr-4">
          <ChevronRight className="size-4 text-navy-300" aria-hidden />
        </TableCell>
      </TableRow>
    )
  }
}

/** One cell of the status strip. Clicking it filters the table (when it has an onClick). */
function SummaryStat({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  active,
  onClick,
  className: extra,
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  sub: string
  tone: 'ok' | 'warn' | 'alert' | 'info'
  active?: boolean
  onClick?: () => void
  className?: string
}) {
  const iconTone = { ok: 'bg-green-50 text-green-700', warn: 'bg-amber-50 text-amber-700', alert: 'bg-red-50 text-red-700', info: 'bg-teal-50 text-teal-700' }[tone]
  const body = (
    <>
      <span className={cn('hidden size-10 shrink-0 items-center justify-center rounded-lg sm:flex', iconTone)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-navy-500">{label}</span>
        <span className="block text-2xl leading-tight font-bold text-navy-950 tabular-nums">{value}</span>
        <span className="block truncate text-xs text-navy-400">{sub}</span>
      </span>
    </>
  )
  const className = cn('flex items-center gap-3 bg-white px-4 py-4 text-left sm:px-5', active && 'bg-teal-50', extra)
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(className, 'transition hover:bg-navy-50/70 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none')}>
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  )
}
