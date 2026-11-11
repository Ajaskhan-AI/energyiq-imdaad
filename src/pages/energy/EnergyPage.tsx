import clsx from 'clsx'
import { format, subDays } from 'date-fns'
import { CalendarRange, ChartColumn, Coins, Flag, Grid3x3, Leaf, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { Card } from '../../components/ui/Card'
import { KpiCard } from '../../components/ui/KpiCard'
import { PageHeader } from '../../components/ui/PageHeader'
import { inputClass } from '../../components/ui/styles'
import { getEnergyHistory } from '../../data/energy'
import { BUILDINGS } from '../../data/sites'
import { SMDBS } from '../../data/smdbs'
import { kwhToTonnesCo2 } from '../../lib/co2'
import { fromISODate, toISODate } from '../../lib/dates'
import { analyseEnergy, groupPatterns } from '../../lib/energyAnalysis'
import { formatNumber } from '../../lib/format'
import { filterBySite } from '../../lib/scope'
import { MARGINAL_AED_PER_KWH } from '../../lib/tariff'
import { useAppState } from '../../store/hooks'
import { CalendarTab } from './CalendarTab'
import { HeatmapTab } from './HeatmapTab'
import { OverviewTab } from './OverviewTab'
import type { EnergyScope } from './scope'
import { WasteTab } from './WasteTab'

type Tab = 'overview' | 'waste' | 'heatmap' | 'calendar'
const TABS: Array<{ id: Tab; label: string; icon: typeof ChartColumn }> = [
  { id: 'overview', label: 'Consumption', icon: ChartColumn },
  { id: 'waste', label: 'Waste detection', icon: Flag },
  { id: 'heatmap', label: 'Hourly heatmap', icon: Grid3x3 },
  { id: 'calendar', label: 'Operating calendar', icon: CalendarRange },
]
const RANGES = [
  { id: '30', label: 'Last 30 days' },
  { id: '90', label: 'Last 90 days' },
  { id: '365', label: 'Last 12 months' },
  { id: 'custom', label: 'Custom range' },
] as const

/** Energy analytics: consumption against opening hours and the operating calendar, with waste detection. */
export default function EnergyPage() {
  const { calendar, site, reviewedWasteIds } = useAppState()
  const user = useCurrentUser()
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.some((t) => t.id === params.get('tab')) ? (params.get('tab') as Tab) : 'overview'

  const now = useMemo(() => new Date(), [])
  const history = useMemo(() => getEnergyHistory(now), [now])
  // Recalculated whenever the operating calendar is edited.
  const analysis = useMemo(() => analyseEnergy(history.boards, calendar, 365), [history, calendar])
  const lastDay = toISODate(subDays(now, 1))
  const firstDay = toISODate(subDays(now, 365))

  const [buildingId, setBuildingId] = useState('all')
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('90')
  const [customFrom, setCustomFrom] = useState(toISODate(subDays(now, 60)))
  const [customTo, setCustomTo] = useState(lastDay)

  const siteBuildings = filterBySite(BUILDINGS, user, site)
  const activeBuilding = siteBuildings.some((b) => b.id === buildingId) ? buildingId : 'all'
  const buildings = activeBuilding === 'all' ? siteBuildings : siteBuildings.filter((b) => b.id === activeBuilding)
  const ids = new Set(buildings.map((b) => b.id))
  const from = range === 'custom' ? (customFrom < firstDay ? firstDay : customFrom) : toISODate(subDays(now, Number(range)))
  const to = range === 'custom' ? (customTo > lastDay ? lastDay : customTo) : lastDay
  const days = Math.max(1, Math.round((fromISODate(to).getTime() - fromISODate(from).getTime()) / 86_400_000) + 1)

  const inRange = <T extends { buildingId: string; date: string }>(r: T) => ids.has(r.buildingId) && r.date >= from && r.date <= to
  const flags = analysis.flags.filter(inRange)
  const scope: EnergyScope = {
    records: history.buildings.filter(inRange),
    boardDays: history.boards.filter(inRange),
    buildings,
    smdbs: SMDBS.filter((s) => ids.has(s.buildingId)),
    flags,
    patterns: groupPatterns(flags, days),
    from,
    to,
    days,
    analysis,
  }

  const totalKwh = scope.records.reduce((s, r) => s + r.kWh, 0)
  const peakKw = scope.records.length ? Math.max(...peakByDate(scope.records)) : 0
  const open = scope.patterns.filter((p) => !reviewedWasteIds.includes(p.id))
  const annualAed = open.reduce((s, p) => s + p.annualAed, 0)
  const annualKwh = open.reduce((s, p) => s + p.annualKwh, 0)

  return (
    <>
      <PageHeader
        title="Energy analytics"
        description="Every SMDB meter compared with its site’s opening hours and the UAE operating calendar (weekends, public holidays, Ramadan, shutdowns), to find energy used when nobody needs it."
      />

      {/* Filters shared by every tab (the site comes from the top bar) */}
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-navy-600">Building</span>
            <select value={activeBuilding} onChange={(e) => setBuildingId(e.target.value)} className={inputClass}>
              <option value="all">All buildings in view ({siteBuildings.length})</option>
              {siteBuildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-navy-600">Date range</span>
            <select value={range} onChange={(e) => setRange(e.target.value as typeof range)} className={inputClass}>
              {RANGES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          {range === 'custom' ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-navy-600">From</span>
                <input type="date" min={firstDay} max={lastDay} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className={inputClass} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-navy-600">To</span>
                <input type="date" min={firstDay} max={lastDay} value={customTo} onChange={(e) => setCustomTo(e.target.value)} className={inputClass} />
              </label>
            </div>
          ) : (
            <p className="self-end pb-2 text-sm text-navy-500">
              {format(fromISODate(from), 'd MMM yyyy')} – {format(fromISODate(to), 'd MMM yyyy')} · {days} days
            </p>
          )}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Electricity" value={`${formatNumber(totalKwh / 1000, 1)} MWh`} sub={`${buildings.length} building${buildings.length === 1 ? '' : 's'} · peak ${formatNumber(peakKw)} kW`} icon={Zap} tone="info" />
        <KpiCard label="Indicative cost" value={`AED ${formatNumber(totalKwh * MARGINAL_AED_PER_KWH / 1000, 0)}k`} sub="DEWA tariff incl. fuel surcharge (indicative)" icon={Coins} tone="neutral" to="/billing" />
        <KpiCard
          label="Waste patterns (open)"
          value={open.length}
          sub={`≈ ${formatNumber(annualKwh / 1000)} MWh / AED ${formatNumber(annualAed / 1000)}k per year if not fixed`}
          icon={Flag}
          tone={open.length ? 'warn' : 'ok'}
          to="/energy?tab=waste"
        />
        <KpiCard label="Scope 2 CO₂" value={`${formatNumber(kwhToTonnesCo2(totalKwh), 0)} t`} sub="Indicative Dubai grid factor" icon={Leaf} tone="ok" />
      </div>

      <div role="tablist" aria-label="Energy views" className="mt-6 flex flex-wrap gap-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setParams({ tab: id }, { replace: true })}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium',
              tab === id ? 'bg-navy-800 text-white' : 'bg-white text-navy-600 ring-1 ring-navy-100 hover:bg-navy-50',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
            {id === 'waste' && open.length > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-xs text-white">{open.length}</span>}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === 'overview' && <OverviewTab scope={scope} />}
        {tab === 'waste' && <WasteTab scope={scope} />}
        {tab === 'heatmap' && <HeatmapTab scope={scope} />}
        {tab === 'calendar' && <CalendarTab patternCount={groupPatterns(analysis.flags, 365).length} />}
      </div>
    </>
  )
}

/** Portfolio peak per day (sum of building peaks). */
function peakByDate(records: EnergyScope['records']): number[] {
  const byDate = new Map<string, number>()
  for (const r of records) byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.peakKw)
  return [...byDate.values()]
}
