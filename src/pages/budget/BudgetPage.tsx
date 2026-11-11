import { Banknote, CalendarClock, Pencil, RotateCcw, TrendingUp, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Input } from '@/components/shadcn/input'
import { cn } from '@/lib/utils'
import { can } from '../../auth/permissions'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { Badge, type Tone } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { KpiCard } from '../../components/ui/KpiCard'
import { PageHeader } from '../../components/ui/PageHeader'
import { useToast } from '../../components/ui/toastContext'
import { getEnergyHistory } from '../../data/energy'
import { getClient } from '../../data/sites'
import { siteBudget, monthLabel, type SiteBudget } from '../../lib/budget'
import { analyseEnergy, groupPatterns } from '../../lib/energyAnalysis'
import { formatNumber } from '../../lib/format'
import { allowedSites, scopedSiteIds } from '../../lib/scope'
import { TARIFF_NOTE } from '../../lib/tariff'
import { actions } from '../../store/actions'
import { useAppDispatch, useAppState } from '../../store/hooks'

const AXIS = { fontSize: 12, fill: '#6a87c4' }
const STATUS: Record<SiteBudget['status'], { label: string; tone: Tone }> = {
  on_track: { label: 'On track', tone: 'ok' },
  at_risk: { label: 'At risk', tone: 'warn' },
  over: { label: 'Forecast over budget', tone: 'alert' },
}
const aed = (v: number) => `AED ${formatNumber(Math.round(v))}`

/** Monthly electricity budget per site: spent so far, month-end forecast, and the gap. */
export default function BudgetPage() {
  const state = useAppState()
  const user = useCurrentUser()
  const dispatch = useAppDispatch()
  const toast = useToast()
  const now = useMemo(() => new Date(), [])
  const history = useMemo(() => getEnergyHistory(now), [now])
  const canEdit = can(user, 'budget.edit')

  const ids = scopedSiteIds(user, state.site)
  const sites = allowedSites(user).filter((s) => ids.has(s.id))
  const rows = useMemo(
    () => sites.map((s) => siteBudget(s, history.boards, state.calendar, now, state.budgets[s.id])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sites.map((s) => s.id).join(), history, state.calendar, state.budgets, now],
  )

  // Open waste patterns per site (last 30 days): the usual reason a site runs over.
  const analysis = useMemo(() => analyseEnergy(history.boards, state.calendar, 365), [history, state.calendar])
  const from30 = new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10)
  const patterns = groupPatterns(analysis.flags.filter((f) => f.date >= from30), 30).filter((p) => !state.reviewedWasteIds.includes(p.id))

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = rows.find((r) => r.site.id === selectedId) ?? [...rows].sort((a, b) => b.variancePct - a.variancePct)[0]
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const total = rows.reduce(
    (t, r) => ({ budget: t.budget + r.budgetAed, actual: t.actual + r.actualAed, forecast: t.forecast + r.forecastAed }),
    { budget: 0, actual: 0, forecast: 0 },
  )
  const atRisk = rows.filter((r) => r.status !== 'on_track').length

  const saveBudget = (siteId: string) => {
    const value = Math.round(Number(draft))
    if (!Number.isFinite(value) || value <= 0) return
    dispatch(actions.setBudget(siteId, value))
    setEditing(null)
    toast.show(`Budget saved: ${aed(value)} per month`)
  }

  return (
    <>
      <PageHeader
        title={`Budget & forecast · ${monthLabel(now)}`}
        description="Each site's electricity cost so far this month, measured by its SMDB meters, and where it will end the month if nothing changes. Spot an overspend in week one, not when the DEWA bill arrives."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Budget this month" value={aed(total.budget)} sub={`${rows.length} site${rows.length === 1 ? '' : 's'}`} icon={Banknote} tone="info" />
        <KpiCard label="Spent so far" value={aed(total.actual)} sub={`${Math.round((rows[0]?.elapsed ?? 0) * 100)}% of the month gone`} icon={CalendarClock} tone="neutral" />
        <KpiCard
          label="Forecast month end"
          value={aed(total.forecast)}
          sub={`${total.forecast >= total.budget ? '+' : ''}${aed(total.forecast - total.budget)} vs budget`}
          icon={TrendingUp}
          tone={total.forecast > total.budget * 1.03 ? 'alert' : total.forecast > total.budget * 0.98 ? 'warn' : 'ok'}
        />
        <KpiCard label="Sites at risk or over" value={`${atRisk} / ${rows.length}`} sub="Forecast within 1.5% of budget or above" icon={TriangleAlert} tone={atRisk ? 'warn' : 'ok'} />
      </div>

      {rows.length === 0 ? (
        <Card className="mt-6">
          <EmptyState icon={Banknote} title="No sites in view" />
        </Card>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-5">
          {/* Site list */}
          <div className="space-y-3 xl:col-span-2">
            {rows.map((r) => {
              const max = Math.max(r.budgetAed, r.forecastAed) * 1.05
              const sitePatterns = patterns.filter((p) => p.siteId === r.site.id)
              const isSelected = selected?.site.id === r.site.id
              return (
                <div
                  key={r.site.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(r.site.id)}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedId(r.site.id)}
                  className={cn('cursor-pointer rounded-xl border bg-card p-4 shadow-sm transition hover:border-teal-300', isSelected && 'border-teal-500 ring-2 ring-teal-500/15')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-navy-950">{r.site.name}</p>
                      <p className="text-xs text-navy-500">{getClient(r.site.clientId)?.name}</p>
                    </div>
                    <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                  </div>

                  {/* Bar: spent so far (solid), forecast (light), budget (line), today's pace (tick) */}
                  <div className="relative mt-4 h-3 rounded-full bg-navy-50">
                    <div className={cn('absolute inset-y-0 left-0 rounded-full opacity-30', r.status === 'over' ? 'bg-red-500' : 'bg-teal-500')} style={{ width: `${(r.forecastAed / max) * 100}%` }} />
                    <div className={cn('absolute inset-y-0 left-0 rounded-full', r.status === 'over' ? 'bg-red-500' : 'bg-teal-600')} style={{ width: `${(r.actualAed / max) * 100}%` }} />
                    <span className="absolute -top-1 -bottom-1 w-0.5 rounded bg-navy-900" style={{ left: `${(r.budgetAed / max) * 100}%` }} title="Budget" />
                  </div>

                  <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-navy-500">Spent so far</dt>
                      <dd className="font-semibold text-navy-950 tabular-nums">{aed(r.actualAed)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-navy-500">Forecast</dt>
                      <dd className="font-semibold text-navy-950 tabular-nums">{aed(r.forecastAed)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-navy-500">Budget</dt>
                      {editing === r.site.id ? (
                        <dd className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Input
                            type="number"
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveBudget(r.site.id)
                              if (e.key === 'Escape') setEditing(null)
                            }}
                            className="h-7 px-2 text-sm"
                            aria-label={`Monthly budget for ${r.site.name} (AED)`}
                          />
                        </dd>
                      ) : (
                        <dd className="flex items-center gap-1 font-semibold text-navy-950 tabular-nums">
                          {aed(r.budgetAed)}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDraft(String(Math.round(r.budgetAed)))
                                setEditing(r.site.id)
                              }}
                              aria-label={`Edit budget for ${r.site.name}`}
                              className="rounded p-0.5 text-navy-400 hover:bg-navy-50 hover:text-teal-700"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                          )}
                        </dd>
                      )}
                    </div>
                  </dl>

                  <p className={cn('mt-2 text-sm', r.varianceAed > 0 ? 'text-red-700' : 'text-green-700')}>
                    {r.varianceAed > 0 ? 'Forecast over budget by ' : 'Forecast under budget by '}
                    <strong className="tabular-nums">
                      {aed(Math.abs(r.varianceAed))} ({Math.abs(r.variancePct).toFixed(1)}%)
                    </strong>
                    {r.isDefaultBudget && <span className="text-navy-400"> · default budget</span>}
                  </p>
                  {sitePatterns.length > 0 && r.varianceAed > 0 && (
                    <p className="mt-1 text-xs text-navy-600">
                      Likely cause:{' '}
                      <Link to="/energy?tab=waste" onClick={(e) => e.stopPropagation()} className="font-semibold text-teal-700 hover:underline">
                        {sitePatterns[0].title}
                      </Link>
                    </p>
                  )}
                  {editing === r.site.id && (
                    <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="teal" onClick={() => saveBudget(r.site.id)}>
                        Save budget
                      </Button>
                      {!r.isDefaultBudget && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            dispatch(actions.setBudget(r.site.id, null))
                            setEditing(null)
                            toast.show('Back to the default budget', 'info')
                          }}
                        >
                          <RotateCcw className="size-4" aria-hidden />
                          Use default
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Chart for the selected site */}
          {selected && (
            <Card className="xl:col-span-3" title={`${selected.site.name} — cumulative cost this month`} subtitle="Solid = metered so far · dashed = forecast if nothing changes · grey = budget spread over the month">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selected.series} margin={{ top: 10, right: 16, bottom: 0, left: 8 }}>
                    <CartesianGrid stroke="#e3eaf8" vertical={false} />
                    <XAxis dataKey="day" tick={AXIS} tickFormatter={(d: number) => `${d}`} label={{ value: `Day of ${monthLabel(now)}`, position: 'insideBottom', offset: -2, fill: '#6a87c4', fontSize: 11 }} height={36} />
                    <YAxis tick={AXIS} width={64} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v, name) => [aed(Number(v)), name === 'actual' ? 'Metered' : name === 'forecast' ? 'Forecast' : 'Budget pace']} labelFormatter={(d) => `Day ${d}`} />
                    <Legend formatter={(v) => (v === 'actual' ? 'Metered so far' : v === 'forecast' ? 'Forecast' : 'Budget pace')} wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine x={now.getDate()} stroke="#9bb1dd" strokeDasharray="3 3" label={{ value: 'Today', position: 'insideTopLeft', fill: '#4766a8', fontSize: 11 }} />
                    <Line type="monotone" dataKey="budget" stroke="#9bb1dd" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="actual" stroke="#014cc3" strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls={false} />
                    <Line type="monotone" dataKey="forecast" stroke={selected.status === 'over' ? '#dc2626' : '#014cc3'} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {[
                  ['Metered so far', `${formatNumber(selected.actualKwh / 1000, 1)} MWh`],
                  ['Forecast month end', `${formatNumber(selected.forecastKwh / 1000, 1)} MWh`],
                  ['Gap to budget', `${selected.varianceAed > 0 ? '+' : '−'}${aed(Math.abs(selected.varianceAed))}`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-navy-50 px-3 py-2.5">
                    <p className="text-xs text-navy-500">{label}</p>
                    <p className="text-lg font-bold text-navy-950 tabular-nums">{value}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-navy-500">
        Default budgets come from each site's normal (waste-free) consumption for the month plus 3%. {TARIFF_NOTE} The forecast assumes current behaviour continues; it is not a
        guarantee.
      </p>
    </>
  )
}
