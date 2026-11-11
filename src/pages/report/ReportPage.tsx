import { ClipboardList, Coins, Download, FileText, Flag, Leaf, TriangleAlert, Zap } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { can } from '../../auth/permissions'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { KpiCard } from '../../components/ui/KpiCard'
import { PageHeader } from '../../components/ui/PageHeader'
import { inputClass } from '../../components/ui/styles'
import { useToast } from '../../components/ui/toastContext'
import { CLIENTS, getClient } from '../../data/sites'
import { EMISSION_FACTOR_NOTE } from '../../lib/co2'
import { formatNumber } from '../../lib/format'
import { buildMonthlyReport, defaultReportMonth, reportFileName, reportMonths, type ReportSource } from '../../lib/report'
import { allowedSites } from '../../lib/scope'
import { useSimulator } from '../../sim/simulatorContext'
import { useAppState } from '../../store/hooks'

/** Monthly Energy & SMDB report: pick month + scope (one site or one client), preview, download a real PDF. */
export default function ReportPage() {
  const state = useAppState()
  const sim = useSimulator()
  const user = useCurrentUser()
  const toast = useToast()
  const now = useMemo(() => new Date(), [])

  const sites = allowedSites(user)
  const clients = CLIENTS.filter((c) => sites.some((s) => s.clientId === c.id))
  // Scope options: one client (all its sites) or a single site.
  const options = [
    ...clients.map((c) => ({ key: `client:${c.id}`, label: `${c.name} — all sites`, siteIds: sites.filter((s) => s.clientId === c.id).map((s) => s.id), fileKey: c.name })),
    ...sites.map((s) => ({ key: `site:${s.id}`, label: s.name, siteIds: [s.id], fileKey: s.id })),
  ]
  const defaultKey = state.site !== 'ALL' && sites.some((s) => s.id === state.site) ? `site:${state.site}` : options[0]?.key
  const [month, setMonth] = useState(() => defaultReportMonth(now))
  const [scopeKey, setScopeKey] = useState(defaultKey ?? '')
  const scope = options.find((o) => o.key === scopeKey) ?? options[0]
  const [busy, setBusy] = useState(false)
  const canDownload = can(user, 'report.download')

  const source: ReportSource = { ...state, readings: sim.readings, health: sim.health, nodes: sim.nodes }
  const scopeLabel = scope
    ? scope.key.startsWith('client:')
      ? `${scope.label.replace(' — all sites', '')}  ·  ${scope.siteIds.length} site(s)`
      : `${scope.label}  ·  ${getClient(sites.find((s) => s.id === scope.siteIds[0])?.clientId ?? '')?.name ?? ''}`
    : ''
  // Recalculated from the live data, so demo actions show up immediately.
  const report = useMemo(() => buildMonthlyReport(source, month, scope?.siteIds ?? [], scopeLabel, now), [source.alerts, source.workOrders, source.calendar, source.reviewedWasteIds, month, scopeKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const download = async () => {
    if (!scope) return
    setBusy(true)
    try {
      // Load the PDF library only when needed (keeps the app itself fast to open).
      const { downloadMonthlyReport } = await import('../../pdf/monthlyReport')
      const fileName = downloadMonthlyReport(buildMonthlyReport(source, month, scope.siteIds, scopeLabel, new Date()), scope.fileKey)
      toast.show(`Downloaded ${fileName}`)
    } catch (error) {
      console.error(error)
      toast.show('Could not create the PDF', 'alert')
    } finally {
      setBusy(false)
    }
  }

  const e = report.energy
  const maxBuilding = Math.max(1, ...e.byBuilding.map((b) => b.kwh))

  return (
    <>
      <PageHeader
        title="Monthly client report"
        description="A ready-to-send monthly report for each client or site: energy, cost, waste found, power quality, alerts and work orders. Calculated from the live data, so actions taken during this demo appear in it."
      />

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-800">Month</span>
            <select value={month} onChange={(ev) => setMonth(ev.target.value)} className={`${inputClass} min-w-56`}>
              {reportMonths(now).map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-800">Report for</span>
            <select value={scope?.key} onChange={(ev) => setScopeKey(ev.target.value)} className={`${inputClass} min-w-72`}>
              <optgroup label="Client (all their sites)">
                {options
                  .filter((o) => o.key.startsWith('client:'))
                  .map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Single site">
                {options
                  .filter((o) => o.key.startsWith('site:'))
                  .map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
              </optgroup>
            </select>
          </label>
          <Button variant="teal" size="lg" onClick={download} disabled={!canDownload || busy || !scope}>
            <Download className="size-5" aria-hidden />
            {busy ? 'Creating PDF…' : 'Download PDF'}
          </Button>
          <p className="text-sm text-navy-500">
            <FileText className="mr-1 inline size-4" aria-hidden />
            {reportFileName(month, scope?.fileKey ?? '')}
          </p>
        </div>
        {!canDownload && <p className="mt-3 text-sm text-navy-500">Your role can preview the report; downloading is for FM and client roles.</p>}
      </Card>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold text-navy-900">
          {report.monthLabel} · {scope?.label}
        </h2>
        {report.isPartial && <Badge tone="warn">Month to date</Badge>}
        <span className="text-sm text-navy-500">{report.periodLabel}</span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Electricity"
          value={`${formatNumber(e.totalKwh / 1000, 1)} MWh`}
          sub={e.changePct === null ? `${e.days} days of meter data` : `${e.changePct > 0 ? '+' : ''}${e.changePct}% per day vs last month`}
          icon={Zap}
          tone="info"
        />
        <KpiCard label="Estimated cost" value={`AED ${formatNumber(report.cost.totalAed / 1000, 1)}k`} sub="DEWA tariff (indicative)" icon={Coins} tone="neutral" />
        <KpiCard label="Waste found" value={`AED ${formatNumber(report.waste.excessAed)}`} sub={`${report.waste.patterns.length} pattern(s) · ≈ AED ${formatNumber(report.waste.annualAed / 1000)}k / yr`} icon={Flag} tone={report.waste.patterns.length ? 'warn' : 'ok'} />
        <KpiCard label="Scope 2 CO₂" value={`${formatNumber(report.co2.tonnes, 1)} t`} sub="Indicative grid factor" icon={Leaf} tone="ok" />
        <KpiCard label="Alerts · work orders" value={`${report.alerts.total} · ${report.workOrders.raised}`} sub={`${report.alerts.critical} critical · ${report.workOrders.closed} WOs closed`} icon={TriangleAlert} tone={report.alerts.critical ? 'alert' : 'neutral'} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Electricity by building" subtitle={`Peak demand ${formatNumber(e.peakKw)} kW · ${formatNumber(e.afterHoursPct, 0)}% used outside opening hours`}>
          <ul className="space-y-2">
            {e.byBuilding.map((b) => (
              <li key={b.id} className="grid grid-cols-[minmax(0,13rem)_1fr_5.5rem] items-center gap-2 text-sm">
                <span className="truncate text-navy-700">{b.name}</span>
                <span className="h-2.5 rounded-full bg-navy-50">
                  <span className="block h-2.5 rounded-full bg-navy-500" style={{ width: `${(b.kwh / maxBuilding) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums">{formatNumber(b.kwh / 1000, 1)} MWh</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 mb-2 text-sm font-semibold text-navy-800">Average per day by day type</p>
          <SimpleTable
            head={['Day type', 'Days', 'Avg per day', 'vs normal day']}
            rows={e.byDayType.map((d) => [d.label, d.days, `${formatNumber(d.avgKwhPerDay)} kWh`, d.vsWorkdayPct === null ? '—' : `${d.vsWorkdayPct}%`])}
          />
          <p className="mt-4 rounded-lg bg-navy-50 px-3 py-2 text-xs text-navy-600">
            <strong>Scope 2 CO₂:</strong> {formatNumber(report.co2.tonnes, 1)} t CO₂e. {EMISSION_FACTOR_NOTE}
          </p>
        </Card>

        <Card title="Energy waste & savings opportunities" subtitle="Patterns found in this month">
          {report.waste.patterns.length ? (
            <SimpleTable
              head={['Pattern', 'Days', 'AED (month)', 'AED / yr', 'Status']}
              rows={report.waste.patterns.map((p) => [
                <span key="t">
                  {p.title}
                  <span className="block text-xs text-navy-500">{p.site}</span>
                </span>,
                p.days,
                formatNumber(p.aed),
                formatNumber(p.annualAed),
                <Badge key="s" tone={p.status === 'Open' ? 'warn' : 'info'}>
                  {p.status}
                </Badge>,
              ])}
            />
          ) : (
            <p className="text-sm text-navy-500">No waste patterns detected this month.</p>
          )}
          <p className="mt-3 text-xs text-navy-500">Annual figures assume the pattern continues. Savings are to be measured during the pilot.</p>
        </Card>

        <Card title="Estimated cost by site" subtitle="DEWA slab tariff + fuel surcharge (indicative)">
          <SimpleTable
            head={['Site', 'Account', 'kWh', 'AED', 'fils/kWh']}
            rows={report.cost.bySite.map((s) => [s.name, s.account, formatNumber(s.kwh), formatNumber(s.aed), s.filsPerKwh.toFixed(1)])}
          />
          {report.cost.topCostCentres.length > 0 && (
            <>
              <p className="mt-4 mb-2 text-sm font-semibold text-navy-800">Largest cost centres</p>
              <SimpleTable head={['Cost centre', 'Site', 'AED']} rows={report.cost.topCostCentres.slice(0, 5).map((c) => [c.name, c.site, formatNumber(c.aed)])} />
            </>
          )}
        </Card>

        <Card title="Power quality, assets & work orders" subtitle={`${report.assets.monitored} monitored assets: ${report.assets.ok} OK · ${report.assets.watch} watch · ${report.assets.alert} alert`}>
          {report.powerQuality.length > 0 ? (
            <SimpleTable head={['SMDB', 'Finding', 'Value']} rows={report.powerQuality.map((p) => [`${p.board} · ${p.site}`, p.issue, p.value])} />
          ) : (
            <p className="text-sm text-navy-500">All boards within their power-quality limits.</p>
          )}
          {report.workOrders.list.length > 0 && (
            <>
              <p className="mt-4 mb-2 flex items-center gap-1.5 text-sm font-semibold text-navy-800">
                <ClipboardList className="size-4" aria-hidden />
                Work orders raised this month
              </p>
              <SimpleTable head={['Work order', 'Status']} rows={report.workOrders.list.map((w) => [`${w.id} · ${w.title}`, w.status])} />
            </>
          )}
        </Card>
      </div>
    </>
  )
}

function SimpleTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs font-semibold tracking-wide text-navy-500 uppercase">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={`border-b border-navy-100 py-2 ${i === 0 ? 'pr-3' : 'px-2 text-right'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-50">
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) => (
                <td key={i} className={`py-2 ${i === 0 ? 'pr-3 text-navy-800' : 'px-2 text-right text-navy-700 tabular-nums'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
