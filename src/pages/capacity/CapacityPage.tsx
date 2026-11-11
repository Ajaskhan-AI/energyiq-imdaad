import { format } from 'date-fns'
import { ChevronRight, CircleCheck, Gauge, PlugZap, Timer, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Input } from '@/components/shadcn/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/shadcn/table'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { LoadBar } from '../../components/smdb/SmdbBits'
import { Badge, type Tone } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { KpiCard } from '../../components/ui/KpiCard'
import { PageHeader } from '../../components/ui/PageHeader'
import { inputClass } from '../../components/ui/styles'
import { getEnergyHistory } from '../../data/energy'
import { getSite } from '../../data/sites'
import { DEFAULT_THRESHOLDS } from '../../data/smdbs'
import { boardCapacity, checkAddLoad, loadDurationCurve, type BoardCapacity } from '../../lib/capacity'
import { fromISODate } from '../../lib/dates'
import { formatNumber } from '../../lib/format'
import { visibleSmdbs } from '../../lib/smdb'
import { useAppState } from '../../store/hooks'

const AXIS = { fontSize: 12, fill: '#6a87c4' }
const STATUS: Record<BoardCapacity['status'], { label: string; tone: Tone }> = {
  ok: { label: 'Spare capacity', tone: 'ok' },
  tight: { label: 'Near limit', tone: 'warn' },
  over: { label: 'Over limit', tone: 'alert' },
}
const VERDICT = {
  ok: { tone: 'border-green-200 bg-green-50 text-green-900', title: 'Yes — fits within the planning limit' },
  tight: { tone: 'border-amber-200 bg-amber-50 text-amber-900', title: 'Possible, but tight — above the planning limit' },
  no: { tone: 'border-red-200 bg-red-50 text-red-900', title: 'Not recommended — exceeds the critical limit' },
} as const

/** Capacity & maximum demand per board, with a "can this board take more load?" checker. */
export default function CapacityPage() {
  const { site, thresholds } = useAppState()
  const user = useCurrentUser()
  const navigate = useNavigate()
  const now = useMemo(() => new Date(), [])
  const history = useMemo(() => getEnergyHistory(now), [now])

  const boards = visibleSmdbs(user, site)
  const caps = useMemo(
    () => boards.map((b) => boardCapacity(b, history.boards, thresholds[b.id] ?? DEFAULT_THRESHOLDS, now)).sort((a, b) => b.util30Pct - a.util30Pct),
    // boards change with the site switcher; ids keep the dependency stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boards.map((b) => b.id).join(), history, thresholds, now],
  )

  // ---- Checker ----
  const [boardId, setBoardId] = useState<string | null>(null)
  const [addKw, setAddKw] = useState('40')
  const [atPeak, setAtPeak] = useState(true)
  const selected = caps.find((c) => c.smdb.id === boardId) ?? caps[0]
  const t = selected ? (thresholds[selected.smdb.id] ?? DEFAULT_THRESHOLDS) : DEFAULT_THRESHOLDS
  const addValue = Math.max(0, Number(addKw) || 0)
  const check = selected ? checkAddLoad(selected, addValue, atPeak, t) : null
  const curve = useMemo(() => (selected ? loadDurationCurve(selected.smdb, now) : []), [selected, now])

  const tight = caps.filter((c) => c.status !== 'ok')
  const totalHeadroom = caps.reduce((s, c) => s + c.headroomKw, 0)
  const hoursAbove = caps.reduce((s, c) => s + c.hoursAbovePlanning, 0)

  return (
    <>
      <PageHeader
        title="Capacity & maximum demand"
        description="Metered peak demand on every board compared with its breaker rating. Know where there is spare capacity before a tenant adds equipment, and which boards are running close to their limit."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Boards near or over limit" value={`${tight.length} / ${caps.length}`} sub="30-day peak above the planning limit" icon={TriangleAlert} tone={tight.length ? 'warn' : 'ok'} />
        <KpiCard label="Spare capacity" value={`${formatNumber(totalHeadroom)} kW`} sub="Sum of headroom to planning limits" icon={PlugZap} tone="info" />
        <KpiCard
          label="Highest utilisation"
          value={caps[0] ? `${Math.round(caps[0].util30Pct)}%` : '—'}
          sub={caps[0] ? `${caps[0].smdb.name} · ${getSite(caps[0].smdb.siteId)?.shortName}` : ''}
          icon={Gauge}
          tone={caps[0]?.status === 'over' ? 'alert' : caps[0]?.status === 'tight' ? 'warn' : 'ok'}
        />
        <KpiCard label="Hours above limit" value={formatNumber(hoursAbove)} sub="All boards, last 30 days" icon={Timer} tone={hoursAbove ? 'warn' : 'ok'} />
      </div>

      {caps.length === 0 ? (
        <Card className="mt-6">
          <EmptyState icon={Gauge} title="No boards in view" />
        </Card>
      ) : (
        <>
          <div className="mt-6 grid gap-6 xl:grid-cols-5">
            {/* Checker */}
            <Card className="xl:col-span-2" title="Can this board take more load?" subtitle="E.g. a tenant adding kitchen equipment, EV chargers or a new AHU">
              {selected && check && (
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-navy-800">Board</span>
                    <select value={selected.smdb.id} onChange={(e) => setBoardId(e.target.value)} className={inputClass}>
                      {caps.map((c) => (
                        <option key={c.smdb.id} value={c.smdb.id}>
                          {getSite(c.smdb.siteId)?.shortName} · {c.smdb.name} ({Math.round(c.util30Pct)}%)
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-navy-800">New load (kW)</span>
                      <Input type="number" min={0} step={5} value={addKw} onChange={(e) => setAddKw(e.target.value)} />
                    </label>
                    <label className="flex items-end gap-2 pb-2 text-sm text-navy-700">
                      <input type="checkbox" checked={atPeak} onChange={(e) => setAtPeak(e.target.checked)} className="size-4 accent-teal-600" />
                      Runs at peak times
                    </label>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-center">
                    {[
                      ['Peak now', `${formatNumber(selected.peak30Kw)} kW`],
                      ['Peak after', `${formatNumber(check.newPeak)} kW`],
                      ['Of rating', `${Math.round(check.pct)}%`],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg bg-navy-50 px-2 py-2.5">
                        <dt className="text-xs text-navy-500">{label}</dt>
                        <dd className="text-lg font-bold text-navy-950 tabular-nums">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className={cn('rounded-lg border px-4 py-3 text-sm', VERDICT[check.verdict].tone)}>
                    <p className="font-semibold">{VERDICT[check.verdict].title}</p>
                    <p className="mt-0.5">
                      Breaker {selected.smdb.ratedCurrentA} A ≈ {formatNumber(selected.ratedKw)} kW · planning limit {t.warnLoadPct}% ={' '}
                      {formatNumber(selected.planningKw)} kW · headroom today {formatNumber(selected.headroomKw)} kW.
                      {!atPeak && ' Off-peak load counted at 40% (diversity).'}
                    </p>
                  </div>
                  <p className="text-xs text-navy-500">Indicative check from 30 days of metered data; a design review is still needed before connecting new load.</p>
                </div>
              )}
            </Card>

            {/* Load duration curve */}
            <Card className="xl:col-span-3" title={selected ? `Load duration curve — ${selected.smdb.name}` : 'Load duration curve'} subtitle="Every hour of the last 30 days, highest load first. The steeper the left end, the more the peak is a short spike.">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={curve} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="ldc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#014cc3" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#014cc3" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#e3eaf8" vertical={false} />
                    <XAxis dataKey="pctOfTime" type="number" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={AXIS} />
                    <YAxis tick={AXIS} width={52} domain={[0, (max: number) => Math.ceil(Math.max(max, selected?.ratedKw ?? 0) * 1.05)]} />
                    <Tooltip formatter={(v) => [`${formatNumber(Number(v))} kW`, 'Load']} labelFormatter={(v) => `Exceeded ${v}% of the time`} />
                    {selected && (
                      <>
                        <ReferenceLine y={selected.ratedKw} stroke="#dc2626" strokeDasharray="4 4" label={{ value: `Breaker rating ${formatNumber(selected.ratedKw)} kW`, position: 'insideTopRight', fill: '#b91c1c', fontSize: 11 }} />
                        <ReferenceLine y={selected.planningKw} stroke="#d97706" strokeDasharray="4 4" label={{ value: `Planning limit ${formatNumber(selected.planningKw)} kW`, position: 'insideBottomRight', fill: '#b45309', fontSize: 11 }} />
                      </>
                    )}
                    <Area type="monotone" dataKey="kw" stroke="#014cc3" strokeWidth={2} fill="url(#ldc)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Table */}
          <section className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
            <header className="border-b bg-navy-50/50 px-5 py-3.5">
              <h2 className="text-base font-semibold text-navy-950">All boards — highest utilisation first</h2>
              <p className="text-sm text-navy-500">Peak = highest 15-minute demand from the meter. Headroom is to the planning limit (warning threshold), based on the last 30 days.</p>
            </header>
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {['Board', 'Breaker', 'Peak · 30 days', 'Peak · 12 months', 'Utilisation (30 days)', 'Headroom', 'Hours above limit', 'Status', ''].map((h, i) => (
                    <TableHead key={i} className={cn('text-xs font-semibold tracking-wide text-navy-500 uppercase', i === 0 && 'pl-5', [1, 2, 3, 5, 6].includes(i) && 'text-right')}>
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {caps.map((c) => {
                  const th = thresholds[c.smdb.id] ?? DEFAULT_THRESHOLDS
                  return (
                    <TableRow key={c.smdb.id} onClick={() => setBoardId(c.smdb.id)} className={cn('cursor-pointer', selected?.smdb.id === c.smdb.id && 'bg-teal-50/60')}>
                      <TableCell className="py-3 pl-5 whitespace-normal">
                        <Link to={`/smdb/${c.smdb.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-navy-950 hover:text-teal-700">
                          {c.smdb.name}
                        </Link>
                        <p className="text-xs text-navy-500">{getSite(c.smdb.siteId)?.name}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.smdb.ratedCurrentA} A<p className="text-xs text-navy-500">{formatNumber(c.ratedKw)} kW</p>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-navy-950 tabular-nums">
                        {formatNumber(c.peak30Kw)} kW<p className="text-xs font-normal text-navy-500">{c.peak30Date && format(fromISODate(c.peak30Date), 'd MMM')}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(c.peak12Kw)} kW
                        <p className={cn('text-xs', c.util12Pct > 100 ? 'font-semibold text-red-700' : 'text-navy-500')}>
                          {Math.round(c.util12Pct)}% · {c.peak12Date && format(fromISODate(c.peak12Date), 'MMM yyyy')}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <LoadBar pct={c.util30Pct} warn={th.warnLoadPct} crit={th.critLoadPct} />
                          <span className="w-10 shrink-0 text-right text-sm font-medium tabular-nums">{Math.round(c.util30Pct)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className={cn('text-right font-semibold tabular-nums', c.headroomKw < 20 ? 'text-amber-700' : 'text-green-700')}>{formatNumber(c.headroomKw)} kW</TableCell>
                      <TableCell className={cn('text-right tabular-nums', c.hoursAbovePlanning > 0 && 'font-semibold text-amber-700')}>{c.hoursAbovePlanning} h</TableCell>
                      <TableCell>
                        <Badge tone={STATUS[c.status].tone}>
                          {c.status === 'ok' && <CircleCheck aria-hidden />}
                          {STATUS[c.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-4">
                        <button type="button" onClick={(e) => (e.stopPropagation(), navigate(`/smdb/${c.smdb.id}`))} aria-label={`Open ${c.smdb.name}`} className="text-navy-300 hover:text-teal-700">
                          <ChevronRight className="size-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </section>
          <p className="mt-3 text-xs text-navy-500">Usable kW assumes 400 V three-phase at power factor 0.92. Click a row to check it in the tool above.</p>
        </>
      )}
    </>
  )
}
