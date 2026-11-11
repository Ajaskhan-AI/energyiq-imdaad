import { BreakdownBars, DailyEnergyChart, PeriodLegend, type DailyPoint } from '../../components/energy/EnergyCharts'
import { Card } from '../../components/ui/Card'
import { getSite } from '../../data/sites'
import { getSmdb, LOAD_TYPE_LABELS } from '../../data/smdbs'
import { DAY_TYPE_COLORS, DAY_TYPE_LABELS } from '../../lib/calendar'
import { fromISODate } from '../../lib/dates'
import { dayTypeAverages } from '../../lib/energyAnalysis'
import { formatNumber } from '../../lib/format'
import { useAppState } from '../../store/hooks'
import type { LoadType } from '../../types'
import type { EnergyScope } from './scope'

export function OverviewTab({ scope }: { scope: EnergyScope }) {
  const { calendar } = useAppState()
  const { records, boardDays, analysis } = scope
  const siteIds = new Set(scope.buildings.map((b) => b.siteId))

  // ---- Daily totals vs expected ----
  // Red dots: closed days (weekends, holidays, shutdowns) with flagged waste. After-hours waste is shown in the heatmap and waste tab.
  const flaggedDates = new Set(scope.flags.filter((f) => f.kind === 'low_occupancy_day').map((f) => f.date))
  const byDate = new Map<string, DailyPoint>()
  for (const r of boardDays) {
    const p = byDate.get(r.date) ?? { t: fromISODate(r.date).getTime(), date: r.date, kWh: 0, expected: 0, flagged: flaggedDates.has(r.date) }
    p.kWh += r.kWh
    p.expected += Math.round(analysis.expected.get(`${r.smdbId}:${r.date}`) ?? 0)
    byDate.set(r.date, p)
  }
  const points = [...byDate.values()].sort((a, b) => a.t - b.t)
  const periods = calendar.filter((p) => !p.siteId || siteIds.has(p.siteId))

  // ---- By what the boards feed ----
  const byLoad = new Map<LoadType, number>()
  for (const r of boardDays) {
    const type = getSmdb(r.smdbId)?.loadType
    if (type) byLoad.set(type, (byLoad.get(type) ?? 0) + r.kWh)
  }
  const total = [...byLoad.values()].reduce((s, v) => s + v, 0) || 1
  const loadRows = [...byLoad.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, kwh]) => ({ label: LOAD_TYPE_LABELS[type], value: kwh, sub: `${Math.round((kwh / total) * 100)}%` }))

  // ---- Per building: intensity and after-hours share ----
  const buildingRows = scope.buildings
    .map((b) => {
      const list = records.filter((r) => r.buildingId === b.id)
      const kwh = list.reduce((s, r) => s + r.kWh, 0)
      const after = list.reduce((s, r) => s + r.afterHoursKwh, 0)
      const site = getSite(b.siteId)
      return {
        b,
        site,
        kwh,
        eui: list.length ? (kwh / list.length) * 365 / b.areaM2 : 0,
        afterPct: kwh ? Math.round((after / kwh) * 100) : 0,
        peak: Math.max(0, ...list.map((r) => r.peakKw)),
      }
    })
    .sort((a, b) => b.eui - a.eui)

  // ---- Average per day by day type (per site) ----
  const byType = dayTypeAverages(records, analysis.dayTypes)
  const maxAvg = Math.max(1, ...byType.map((t) => t.avgKwhPerDay))

  return (
    <div className="space-y-6">
      <Card title="Daily electricity vs expected" subtitle="Expected = each board’s normal behaviour for its site’s opening hours, day type and season. Coloured bands = calendar periods.">
        <DailyEnergyChart points={points} periods={periods} />
        <div className="mt-3">
          <PeriodLegend />
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Where the energy goes" subtitle="By what each SMDB feeds, for the selected buildings and dates">
          <BreakdownBars rows={loadRows} />
        </Card>

        <Card title="Average per day by day type" subtitle="A closed day should use far less than a normal operating day">
          <ul className="space-y-3">
            {byType.map((t) => (
              <li key={t.dayType} className="grid grid-cols-[10rem_1fr_7rem] items-center gap-3 text-sm">
                <span className="flex items-center gap-2 text-navy-800">
                  <span className="size-3 rounded-sm" style={{ background: t.dayType === 'workday' ? '#6a87c4' : DAY_TYPE_COLORS[t.dayType] }} />
                  {DAY_TYPE_LABELS[t.dayType]} <span className="text-xs text-navy-400">({t.days}d)</span>
                </span>
                <span className="h-2.5 rounded-full bg-navy-50">
                  <span className="block h-2.5 rounded-full bg-navy-500" style={{ width: `${(t.avgKwhPerDay / maxAvg) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums">
                  {formatNumber(t.avgKwhPerDay)} kWh
                  {t.vsWorkdayPct !== null && <span className="block text-xs text-navy-500">{t.vsWorkdayPct}% of a normal day</span>}
                </span>
              </li>
            ))}
          </ul>
          {siteIds.size > 1 && <p className="mt-3 text-xs text-navy-500">Day types differ per site (weekends are normal days for the mall but closed days for the office tower), so each % compares the same sites.</p>}
        </Card>
      </div>

      <Card flush title="Building benchmark" subtitle="Energy use intensity (EUI, kWh per m² per year, annualised from the selected dates) and share of energy used outside opening hours">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-navy-50/60 text-xs font-semibold tracking-wide text-navy-500 uppercase">
              <tr>
                <th className="px-5 py-3">Building</th>
                <th className="px-3 py-3">Site type · hours</th>
                <th className="px-3 py-3 text-right">Energy</th>
                <th className="px-3 py-3 text-right">EUI</th>
                <th className="px-3 py-3 text-right">After-hours share</th>
                <th className="px-5 py-3 text-right">Peak demand</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {buildingRows.map(({ b, site, kwh, eui, afterPct, peak }) => (
                <tr key={b.id}>
                  <td className="px-5 py-3">
                    <span className="font-medium text-navy-900">{b.name}</span>
                    <span className="block text-xs text-navy-500">
                      {formatNumber(b.areaM2)} m² · {b.floors} floors
                    </span>
                  </td>
                  <td className="px-3 py-3 text-navy-600">
                    {site?.type} · {site && (site.openHour === 0 && site.closeHour === 24 ? '24/7' : `${site.openHour}:00–${site.closeHour}:00${site.openWeekends ? '' : ', Mon–Fri'}`)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatNumber(kwh / 1000, 1)} MWh</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatNumber(eui)} kWh/m²</td>
                  <td className={`px-3 py-3 text-right tabular-nums ${afterPct > 45 ? 'font-semibold text-amber-700' : ''}`}>{site?.openHour === 0 && site.closeHour === 24 ? '— (24/7)' : `${afterPct}%`}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatNumber(peak)} kW</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
