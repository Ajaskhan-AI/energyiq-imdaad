import { addDays, format, startOfWeek, subWeeks } from 'date-fns'
import { useState } from 'react'
import { Heatmap, type HeatmapRow } from '../../components/energy/EnergyCharts'
import { Card } from '../../components/ui/Card'
import { inputClass } from '../../components/ui/styles'
import { buildingHourly } from '../../data/energy'
import { getSite } from '../../data/sites'
import { fromISODate, toISODate } from '../../lib/dates'
import type { EnergyScope } from './scope'

/** Hour × day heatmap for one building and one week. Night and weekend waste stands out. */
export function HeatmapTab({ scope }: { scope: EnergyScope }) {
  // Default building: the one with the most flags in scope, else the first.
  const flagCounts = new Map<string, number>()
  for (const f of scope.flags) flagCounts.set(f.buildingId, (flagCounts.get(f.buildingId) ?? 0) + 1)
  const defaultBuilding = [...flagCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? scope.buildings[0]?.id ?? ''
  const [buildingChoice, setBuildingChoice] = useState<string | null>(null)
  const buildingId = buildingChoice && scope.buildings.some((b) => b.id === buildingChoice) ? buildingChoice : defaultBuilding
  const building = scope.buildings.find((b) => b.id === buildingId)
  const site = building ? getSite(building.siteId) : undefined

  // Weeks (Mon–Sun) in the selected range, newest first; the current week is incomplete, so start from the last full one.
  const lastDay = fromISODate(scope.to)
  const weeks: string[] = []
  for (let w = subWeeks(startOfWeek(lastDay, { weekStartsOn: 1 }), 1); toISODate(w) >= scope.from || weeks.length === 0; w = subWeeks(w, 1)) {
    weeks.push(toISODate(w))
    if (weeks.length >= 53) break
  }
  const [weekChoice, setWeekChoice] = useState<string | null>(null)
  const week = weekChoice && weeks.includes(weekChoice) ? weekChoice : weeks[0]

  const flagged = new Set(scope.flags.filter((f) => f.buildingId === buildingId).map((f) => f.date))
  const rows: HeatmapRow[] = Array.from({ length: 7 }, (_, i) => toISODate(addDays(fromISODate(week), i))).map((date) => ({
    date,
    dayType: (site && scope.analysis.dayTypes.get(`${site.id}:${date}`)) || 'workday',
    hours: buildingHourly(buildingId, date),
    flagged: flagged.has(date),
  }))

  return (
    <Card title="Hourly heatmap" subtitle="Each cell is one hour. A building should look pale outside its opening hours and on closed days.">
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-navy-600">Building</span>
          <select value={buildingId} onChange={(e) => setBuildingChoice(e.target.value)} className={inputClass}>
            {scope.buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {flagCounts.get(b.id) ? ` — ${flagCounts.get(b.id)} flagged days` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-navy-600">Week starting</span>
          <select value={week} onChange={(e) => setWeekChoice(e.target.value)} className={inputClass}>
            {weeks.map((w) => (
              <option key={w} value={w}>
                {format(fromISODate(w), 'EEE d MMM yyyy')}
              </option>
            ))}
          </select>
        </label>
      </div>
      {building ? <Heatmap rows={rows} openHours={[site?.openHour ?? 0, site?.closeHour ?? 24]} /> : <p className="text-sm text-navy-500">No building selected.</p>}
    </Card>
  )
}
