import { format, startOfWeek, subDays, subWeeks } from 'date-fns'
import { Activity, PlugZap, Repeat, ShieldCheck, Timer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/shadcn/table'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { KpiCard } from '../../components/ui/KpiCard'
import { PageHeader } from '../../components/ui/PageHeader'
import { getBuilding, getClient, getSite } from '../../data/sites'
import { getSmdb, SMDBS } from '../../data/smdbs'
import { formatDuration, formatNumber } from '../../lib/format'
import { boardAvailability, generatedOutages, OUTAGE_KIND_LABELS, outagesFromAlerts, siteAvailability } from '../../lib/reliability'
import { allowedSites, scopedSiteIds } from '../../lib/scope'
import { useAppState } from '../../store/hooks'

const AXIS = { fontSize: 12, fill: '#6a87c4' }
const DAYS = 90
const WINDOW_MIN = DAYS * 24 * 60
const pct = (v: number) => `${v >= 99.995 ? '100' : v.toFixed(v >= 99.9 ? 3 : 2)}%`
const mins = (m: number) => formatDuration(m * 60_000)

/** Supply reliability per site and board: interruptions, downtime and availability, from the meters. */
export default function ReliabilityPage() {
  const state = useAppState()
  const user = useCurrentUser()
  const now = useMemo(() => new Date(), [])
  const [showAll, setShowAll] = useState(false)

  const ids = scopedSiteIds(user, state.site)
  const from = subDays(now, DAYS).toISOString()
  const events = useMemo(
    () =>
      [...generatedOutages(now, DAYS), ...outagesFromAlerts(state.alerts, new Date())]
        .filter((e) => ids.has(e.siteId) && e.start >= from)
        .sort((a, b) => b.start.localeCompare(a.start)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now, state.alerts, [...ids].join(), from],
  )

  const sites = allowedSites(user).filter((s) => ids.has(s.id))
  const siteRows = sites.map((s) => ({ site: s, a: siteAvailability(s.id, events, WINDOW_MIN) })).sort((x, y) => x.a.availabilityPct - y.a.availabilityPct)
  const boards = SMDBS.filter((b) => ids.has(b.siteId))
  const boardRows = boards
    .map((b) => ({ smdb: b, a: boardAvailability(b.id, events, WINDOW_MIN) }))
    .filter((r) => r.a.events > 0)
    .sort((x, y) => y.a.trips - x.a.trips || y.a.events - x.a.events || y.a.downtimeMin - x.a.downtimeMin)
  const portfolio = boards.length ? boards.reduce((s, b) => s + boardAvailability(b.id, events, WINDOW_MIN).availabilityPct, 0) / boards.length : 100
  const repeat = boardRows.filter((r) => r.a.trips >= 2).length
  const downtime = events.reduce((s, e) => s + e.durationMin, 0)
  const ongoing = events.filter((e) => e.ongoing).length

  // Interruptions per week (13 weeks), split by type.
  const weeks = Array.from({ length: 13 }, (_, i) => {
    const start = startOfWeek(subWeeks(now, 12 - i), { weekStartsOn: 1 })
    const end = subWeeks(start, -1)
    const inWeek = events.filter((e) => e.start >= start.toISOString() && e.start < end.toISOString())
    return {
      label: format(start, 'd MMM'),
      trips: inWeek.filter((e) => e.kind === 'breaker_trip').length,
      supply: inWeek.filter((e) => e.kind === 'supply_interruption').length,
    }
  })

  return (
    <>
      <PageHeader
        title="Supply reliability"
        description="Every interruption seen by the meters: a breaker trip when a board's three phase currents drop to zero, a supply interruption when every board on a site loses voltage together. Availability per board and per site, ready for each client's monthly review."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={`Availability · ${DAYS} days`} value={pct(portfolio)} sub={`${boards.length} boards, time with supply`} icon={ShieldCheck} tone={portfolio >= 99.9 ? 'ok' : 'warn'} />
        <KpiCard label="Interruptions" value={events.length} sub={ongoing ? `${ongoing} happening now` : `${events.filter((e) => e.kind === 'supply_interruption').length} utility, ${events.filter((e) => e.kind === 'breaker_trip').length} breaker trips`} icon={PlugZap} tone={ongoing ? 'alert' : events.length ? 'warn' : 'ok'} />
        <KpiCard label="Total downtime" value={mins(downtime)} sub="Sum over all affected boards" icon={Timer} tone="neutral" />
        <KpiCard label="Boards with repeat trips" value={repeat} sub="2+ breaker trips in 90 days: find the root cause" icon={Repeat} tone={repeat ? 'alert' : 'ok'} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3" title="Interruptions per week" subtitle={`Last 13 weeks · breaker trips vs utility supply interruptions`}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeks} margin={{ top: 10, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="#e3eaf8" vertical={false} />
                <XAxis dataKey="label" tick={{ ...AXIS, fontSize: 11 }} interval={1} />
                <YAxis allowDecimals={false} tick={AXIS} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="trips" name="Breaker trips" stackId="a" fill="#014cc3" radius={[0, 0, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="supply" name="Supply interruptions" stackId="a" fill="#f59e0b" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="xl:col-span-2" flush title="Availability by site" subtitle={`Last ${DAYS} days, lowest first`}>
          {siteRows.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No sites in view" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5 text-xs font-semibold tracking-wide text-navy-500 uppercase">Site</TableHead>
                  <TableHead className="text-right text-xs font-semibold tracking-wide text-navy-500 uppercase">Availability</TableHead>
                  <TableHead className="pr-5 text-right text-xs font-semibold tracking-wide text-navy-500 uppercase">Events</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {siteRows.map(({ site, a }) => (
                  <TableRow key={site.id}>
                    <TableCell className="py-3 pl-5 whitespace-normal">
                      <p className="font-semibold text-navy-950">{site.name}</p>
                      <p className="text-xs text-navy-500">{getClient(site.clientId)?.name}</p>
                    </TableCell>
                    <TableCell className={cn('text-right font-semibold tabular-nums', a.availabilityPct < 99.95 ? 'text-amber-700' : 'text-green-700')}>{pct(a.availabilityPct)}</TableCell>
                    <TableCell className="pr-5 text-right tabular-nums">
                      {a.events}
                      <p className="text-xs text-navy-500">{a.downtimeMin ? mins(a.downtimeMin) : '—'}</p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {/* Boards with interruptions */}
      <Card className="mt-6" flush title="Boards with interruptions" subtitle="Most interruptions first. Repeat trips on the same board usually point to one faulty circuit or piece of equipment.">
        {boardRows.length === 0 ? (
          <EmptyState icon={Activity} title="No interruptions in this period" />
        ) : (
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {['Board', 'Site', 'Interruptions', 'Downtime', 'Longest', 'Availability', 'Last event'].map((h, i) => (
                  <TableHead key={h} className={cn('text-xs font-semibold tracking-wide text-navy-500 uppercase', i === 0 && 'pl-5', i >= 2 && i <= 5 && 'text-right')}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {boardRows.map(({ smdb, a }) => (
                <TableRow key={smdb.id}>
                  <TableCell className="py-3 pl-5 whitespace-normal">
                    <Link to={`/smdb/${smdb.id}`} className="font-semibold text-navy-950 hover:text-teal-700">
                      {smdb.name}
                    </Link>
                    {a.trips >= 2 && (
                      <Badge tone="alert" className="ml-2">
                        Repeat trips
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-navy-600">{getSite(smdb.siteId)?.shortName}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{a.events}</TableCell>
                  <TableCell className="text-right tabular-nums">{mins(a.downtimeMin)}</TableCell>
                  <TableCell className="text-right tabular-nums">{mins(a.longestMin)}</TableCell>
                  <TableCell className={cn('text-right font-semibold tabular-nums', a.availabilityPct < 99.9 ? 'text-amber-700' : 'text-navy-900')}>{pct(a.availabilityPct)}</TableCell>
                  <TableCell className="text-navy-600">{a.lastEvent ? format(new Date(a.lastEvent), 'd MMM, HH:mm') : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Event log */}
      <Card
        className="mt-6"
        flush
        title="Event log"
        subtitle="Newest first. Trips raised live in this demo (e.g. Simulate trip) appear here too."
        actions={
          events.length > 10 && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="text-sm font-semibold text-teal-700 hover:underline">
              {showAll ? 'Show fewer' : `Show all ${events.length}`}
            </button>
          )
        }
      >
        {events.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No interruptions in this period" />
        ) : (
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {['Start', 'Type', 'Where', 'Duration', 'Cause / note'].map((h, i) => (
                  <TableHead key={h} className={cn('text-xs font-semibold tracking-wide text-navy-500 uppercase', i === 0 && 'pl-5', i === 3 && 'text-right')}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(showAll ? events : events.slice(0, 10)).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="py-3 pl-5 whitespace-nowrap text-navy-900 tabular-nums">{format(new Date(e.start), 'EEE d MMM yyyy, HH:mm')}</TableCell>
                  <TableCell>
                    <Badge tone={e.ongoing ? 'alert' : e.kind === 'supply_interruption' ? 'warn' : 'info'}>{e.ongoing ? 'Tripped now' : OUTAGE_KIND_LABELS[e.kind]}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <p className="font-medium text-navy-950">{e.kind === 'supply_interruption' ? `Whole site · ${e.smdbIds.length} boards` : getSmdb(e.smdbIds[0])?.name}</p>
                    <p className="text-xs text-navy-500">
                      {getSite(e.siteId)?.name} · {getBuilding(e.buildingId)?.shortName}
                    </p>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{e.ongoing ? `${mins(e.durationMin)}+` : mins(e.durationMin)}</TableCell>
                  <TableCell className="max-w-md whitespace-normal text-navy-700">{e.cause}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <p className="mt-3 text-xs text-navy-500">
        Sample data. Availability = share of time each board had supply over the last {DAYS} days ({formatNumber(WINDOW_MIN)} minutes per board); site figures average their boards.
      </p>
    </>
  )
}
