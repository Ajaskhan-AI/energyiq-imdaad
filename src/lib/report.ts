import { eachDayOfInterval, endOfMonth, format, startOfMonth, subDays, subMonths } from 'date-fns'
import { ASSETS } from '../data/assets'
import { getEnergyHistory } from '../data/energy'
import { BUILDINGS, getBuilding, getClient, SITES } from '../data/sites'
import { getSmdb } from '../data/smdbs'
import type { NodeHealth } from '../sim/deviceModel'
import { assessAll } from '../sim/predictiveModel'
import type { SmdbHealth } from '../sim/smdbModel'
import type { Alert, CalendarPeriod, DayType, Reading, SmdbThresholds, WorkOrder } from '../types'
import { billingForMonth } from './billing'
import { DAY_TYPE_LABELS } from './calendar'
import { kwhToTonnesCo2 } from './co2'
import { fromISODate, toISODate } from './dates'
import { analyseEnergy, dayTypeAverages, groupPatterns, WASTE_KIND_LABELS } from './energyAnalysis'

/** Data the report needs from the store and the simulator. */
export interface ReportSource {
  alerts: Alert[]
  workOrders: WorkOrder[]
  calendar: CalendarPeriod[]
  reviewedWasteIds: string[]
  predictiveResets: Record<string, { at: string }>
  thresholds: Record<string, SmdbThresholds>
  /** Live snapshot at the time the report is generated. */
  readings: Record<string, Reading>
  health: Record<string, SmdbHealth>
  nodes: NodeHealth[]
}

export interface MonthlyReport {
  month: string // yyyy-MM
  monthLabel: string // "October 2026"
  scopeLabel: string // site name, or "3 sites — Gulfstone Real Estate"
  siteIds: string[]
  isPartial: boolean
  periodLabel: string
  generatedAt: string
  energy: {
    totalKwh: number
    prevMonthKwh: number
    /** Previous month scaled to the same number of days, for a fair comparison. */
    changePct: number | null
    days: number
    dataThrough: string | null
    peakKw: number
    afterHoursPct: number
    bySite: Array<{ id: string; name: string; client: string; kwh: number; sharePct: number }>
    byBuilding: Array<{ id: string; name: string; kwh: number; eui: number; afterHoursPct: number }>
    byDayType: Array<{ dayType: DayType; label: string; days: number; avgKwhPerDay: number; vsWorkdayPct: number | null }>
  }
  cost: {
    totalAed: number
    bySite: Array<{ name: string; account: string; kwh: number; aed: number; filsPerKwh: number }>
    topCostCentres: Array<{ site: string; name: string; kwh: number; aed: number }>
  }
  co2: { tonnes: number; bySite: Array<{ name: string; tonnes: number }> }
  waste: {
    patterns: Array<{ title: string; site: string; kind: string; days: number; excessKwh: number; aed: number; annualAed: number; status: string }>
    excessKwh: number
    excessAed: number
    annualAed: number
  }
  powerQuality: Array<{ board: string; site: string; issue: string; value: string }>
  alerts: {
    total: number
    critical: number
    acknowledgedPct: number | null
    bySource: Array<{ label: string; count: number }>
    list: Array<{ date: string; title: string; site: string; severity: string }>
  }
  workOrders: { raised: number; closed: number; open: number; list: Array<{ id: string; title: string; status: string; site: string }> }
  assets: { monitored: number; ok: number; watch: number; alert: number; issues: Array<{ name: string; site: string; health: number; issue: string }> }
  devices: { nodes: number; online: number; completenessPct: number }
}

/** Selectable months: current month and the 11 before it (meter history covers 365 days). */
export function reportMonths(now: Date): Array<{ value: string; label: string }> {
  return Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(startOfMonth(now), i)
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') + (i === 0 ? ' (to date)' : '') }
  })
}

/** Previous full month, e.g. "2026-10" in November 2026. */
export function defaultReportMonth(now: Date): string {
  return format(subMonths(startOfMonth(now), 1), 'yyyy-MM')
}

/** e.g. EnergyIQ-Report-2026-10-HBT.pdf */
export function reportFileName(month: string, scope: string): string {
  return `EnergyIQ-Report-${month}-${scope.replace(/[^A-Za-z0-9]+/g, '')}.pdf`
}

const SOURCE_LABELS: Record<Alert['source'], string> = { smdb: 'SMDB monitoring', predictive: 'Asset health', device: 'IoT devices' }
const WO_STATUS: Record<WorkOrder['status'], string> = { open: 'Open', in_progress: 'In progress', closed: 'Closed' }

/**
 * All report numbers, calculated from the CURRENT data, so alerts and work
 * orders created during the demo show up in the report and the PDF.
 */
export function buildMonthlyReport(source: ReportSource, month: string, siteIds: string[], scopeLabel: string, now: Date): MonthlyReport {
  const ids = new Set(siteIds)
  const start = startOfMonth(fromISODate(`${month}-01`))
  const end = endOfMonth(start)
  const today = toISODate(now)
  const from = toISODate(start)
  const to = toISODate(end)
  const isPartial = today <= to
  const periodEnd = isPartial ? today : to
  const inPeriod = (iso: string) => iso.slice(0, 10) >= from && iso.slice(0, 10) <= periodEnd

  // ---------- Energy (meter history ends yesterday) ----------
  const history = getEnergyHistory(now)
  const energyEnd = toISODate(subDays(now, 1)) < periodEnd ? toISODate(subDays(now, 1)) : periodEnd
  const records = history.buildings.filter((r) => ids.has(r.siteId) && r.date >= from && r.date <= energyEnd)
  const totalKwh = records.reduce((s, r) => s + r.kWh, 0)
  const days = energyEnd >= from ? eachDayOfInterval({ start, end: fromISODate(energyEnd) }).length : 0

  const prevStart = subMonths(start, 1)
  const prevFrom = toISODate(prevStart)
  const prevTo = toISODate(endOfMonth(prevStart))
  const prev = history.buildings.filter((r) => ids.has(r.siteId) && r.date >= prevFrom && r.date <= prevTo)
  const prevKwh = prev.reduce((s, r) => s + r.kWh, 0)
  const prevDays = new Set(prev.map((r) => r.date)).size
  const changePct = prevDays && days ? Math.round(((totalKwh / days - prevKwh / prevDays) / (prevKwh / prevDays)) * 1000) / 10 : null

  const dayTotals = new Map<string, number>()
  for (const r of records) dayTotals.set(r.date, (dayTotals.get(r.date) ?? 0) + r.peakKw)
  const peakKw = Math.max(0, ...dayTotals.values())
  const afterHours = records.reduce((s, r) => s + r.afterHoursKwh, 0)

  const sites = SITES.filter((s) => ids.has(s.id))
  const bySite = sites
    .map((s) => {
      const kwh = records.filter((r) => r.siteId === s.id).reduce((sum, r) => sum + r.kWh, 0)
      return { id: s.id, name: s.name, client: getClient(s.clientId)?.name ?? '', kwh, sharePct: totalKwh ? (kwh / totalKwh) * 100 : 0 }
    })
    .sort((a, b) => b.kwh - a.kwh)
  const byBuilding = BUILDINGS.filter((b) => ids.has(b.siteId))
    .map((b) => {
      const list = records.filter((r) => r.buildingId === b.id)
      const kwh = list.reduce((s, r) => s + r.kWh, 0)
      const ah = list.reduce((s, r) => s + r.afterHoursKwh, 0)
      return { id: b.id, name: b.name, kwh, eui: list.length ? ((kwh / list.length) * 365) / b.areaM2 : 0, afterHoursPct: kwh ? (ah / kwh) * 100 : 0 }
    })
    .sort((a, b) => b.kwh - a.kwh)

  // Average daily consumption per day type (uses the editable calendar).
  const analysis = analyseEnergy(history.boards, source.calendar, 365)
  const byDayType = dayTypeAverages(records, analysis.dayTypes).map((row) => ({ ...row, label: DAY_TYPE_LABELS[row.dayType] }))

  // ---------- Cost ----------
  const billing = billingForMonth(month, history.boards, ids, now)
  const topCostCentres = billing.sites
    .flatMap((b) => b.costCentres.map((c) => ({ site: b.site.shortName, name: c.name, kwh: c.kWh, aed: c.aed })))
    .sort((a, b) => b.aed - a.aed)
    .slice(0, 8)

  // ---------- Waste ----------
  const monthFlags = analysis.flags.filter((f) => ids.has(f.siteId) && f.date >= from && f.date <= energyEnd)
  const patterns = groupPatterns(monthFlags, Math.max(days, 1))
  const wasteRows = patterns.map((p) => {
    const wo = source.workOrders.find((w) => w.wasteFlagId === p.id)
    const status = wo ? `${wo.id} (${WO_STATUS[wo.status]})` : source.reviewedWasteIds.includes(p.id) ? 'Reviewed' : 'Open'
    return {
      title: p.title,
      site: SITES.find((s) => s.id === p.siteId)?.shortName ?? p.siteId,
      kind: WASTE_KIND_LABELS[p.kind],
      days: p.days,
      excessKwh: p.excessKwh,
      aed: p.aed,
      annualAed: p.annualAed,
      status,
    }
  })

  // ---------- Power quality (live snapshot) ----------
  const powerQuality: MonthlyReport['powerQuality'] = []
  for (const [smdbId, h] of Object.entries(source.health)) {
    const smdb = getSmdb(smdbId)
    if (!smdb || !ids.has(smdb.siteId) || h.status === 'offline') continue
    const r = source.readings[smdbId]
    const t = source.thresholds[smdbId]
    const site = SITES.find((s) => s.id === smdb.siteId)?.shortName ?? ''
    if (t && r.pf < t.minPf) powerQuality.push({ board: smdb.name, site, issue: 'Low power factor', value: r.pf.toFixed(2) })
    if (h.maxThd > 20) powerQuality.push({ board: smdb.name, site, issue: 'High current THD', value: `${h.maxThd.toFixed(1)}%` })
    if (t && h.imbalancePct > t.imbalancePct * 0.7) powerQuality.push({ board: smdb.name, site, issue: 'Phase imbalance', value: `${h.imbalancePct.toFixed(1)}%` })
  }

  // ---------- Alerts, work orders, assets, devices ----------
  const alerts = source.alerts.filter((a) => ids.has(a.siteId) && inPeriod(a.createdAt))
  const wos = source.workOrders.filter((w) => ids.has(w.siteId) && inPeriod(w.createdAt))
  const assets = ASSETS.filter((a) => ids.has(a.siteId))
  const assessments = assessAll(assets, now, source.predictiveResets)
  const nodes = source.nodes.filter((n) => ids.has(n.node.siteId))

  return {
    month,
    monthLabel: format(start, 'MMMM yyyy'),
    scopeLabel,
    siteIds,
    isPartial,
    periodLabel: isPartial ? `${format(start, 'd')}–${format(fromISODate(periodEnd), 'd MMM yyyy')} (month to date)` : `${format(start, 'd')}–${format(end, 'd MMM yyyy')}`,
    generatedAt: now.toISOString(),
    energy: {
      totalKwh,
      prevMonthKwh: prevKwh,
      changePct,
      days,
      dataThrough: days ? energyEnd : null,
      peakKw,
      afterHoursPct: totalKwh ? (afterHours / totalKwh) * 100 : 0,
      bySite,
      byBuilding,
      byDayType,
    },
    cost: {
      totalAed: billing.totalAed,
      bySite: billing.sites.map((b) => ({ name: b.site.name, account: b.site.dewaAccount, kwh: b.kWh, aed: b.totalAed, filsPerKwh: b.avgFilsPerKwh })),
      topCostCentres,
    },
    co2: { tonnes: kwhToTonnesCo2(totalKwh), bySite: bySite.map((s) => ({ name: s.name, tonnes: kwhToTonnesCo2(s.kwh) })) },
    waste: {
      patterns: wasteRows,
      excessKwh: patterns.reduce((s, p) => s + p.excessKwh, 0),
      excessAed: patterns.reduce((s, p) => s + p.aed, 0),
      annualAed: patterns.reduce((s, p) => s + p.annualAed, 0),
    },
    powerQuality,
    alerts: {
      total: alerts.length,
      critical: alerts.filter((a) => a.severity === 'critical').length,
      acknowledgedPct: alerts.length ? Math.round((alerts.filter((a) => a.acknowledged).length / alerts.length) * 100) : null,
      bySource: (['smdb', 'predictive', 'device'] as const).map((s) => ({ label: SOURCE_LABELS[s], count: alerts.filter((a) => a.source === s).length })).filter((s) => s.count > 0),
      list: [...alerts]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 10)
        .map((a) => ({
          date: format(new Date(a.createdAt), 'd MMM HH:mm'),
          title: a.title,
          site: `${SITES.find((s) => s.id === a.siteId)?.shortName ?? ''} · ${getBuilding(a.buildingId)?.shortName ?? ''}`,
          severity: a.severity === 'critical' ? 'Critical' : 'Warning',
        })),
    },
    workOrders: {
      raised: wos.length,
      closed: wos.filter((w) => w.status === 'closed').length,
      open: wos.filter((w) => w.status !== 'closed').length,
      list: wos.map((w) => ({ id: w.id, title: w.title, status: WO_STATUS[w.status], site: SITES.find((s) => s.id === w.siteId)?.shortName ?? '' })),
    },
    assets: {
      monitored: assets.length,
      ok: assessments.filter((a) => a.status === 'ok').length,
      watch: assessments.filter((a) => a.status === 'watch').length,
      alert: assessments.filter((a) => a.status === 'alert').length,
      issues: assessments
        .filter((a) => a.issue)
        .map((a) => {
          const asset = assets.find((x) => x.id === a.assetId)
          return { name: asset?.name ?? a.assetId, site: SITES.find((s) => s.id === asset?.siteId)?.shortName ?? '', health: a.health, issue: a.issue?.title ?? '' }
        }),
    },
    devices: {
      nodes: nodes.length,
      online: nodes.filter((n) => n.status !== 'offline').length,
      completenessPct: nodes.length ? nodes.reduce((s, n) => s + n.completenessPct, 0) / nodes.length : 0,
    },
  }
}
