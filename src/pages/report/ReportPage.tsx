import { format } from 'date-fns'
import { Download, FileText } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { can } from '../../auth/permissions'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { KuroshioLogo } from '../../components/layout/BrandMark'
import { Button } from '../../components/ui/Button'
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

/**
 * Monthly Energy & SMDB report, shown as a standard business report: blue header
 * band, report details, summary figures, numbered sections and sign-off. Pick month + scope
 * (one site or one client) and download the PDF.
 */
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
  const isClient = !!scope?.key.startsWith('client:')
  const recipient = scope ? (isClient ? scope.label.replace(' — all sites', '') : scope.label) : ''
  const recipientSub = scope
    ? isClient
      ? `${scope.siteIds.length} site${scope.siteIds.length === 1 ? '' : 's'}`
      : (getClient(sites.find((s) => s.id === scope.siteIds[0])?.clientId ?? '')?.name ?? '')
    : ''
  const scopeLabel = `${recipient}  ·  ${recipientSub}`
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
  const ref = `EIQ-${month.replace('-', '')}-${(scope?.fileKey ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase()}`
  const issued = format(now, 'd MMMM yyyy')

  return (
    <>
      <PageHeader title="Monthly client report" description="A formal monthly report for each client or site, calculated from the live meter data. Choose the month and recipient, then download the PDF to send." />

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4 shadow-sm">
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
        {!canDownload && <p className="w-full text-sm text-navy-500">Your role can preview the report; downloading is for FM and client roles.</p>}
      </div>

      {/* ---------------- The document ---------------- */}
      <div className="mt-6 rounded-2xl bg-navy-50/70 px-2 py-6 sm:px-8 sm:py-10">
        <article className="mx-auto max-w-4xl overflow-hidden rounded-sm bg-white shadow-[0_8px_30px_-10px_rgba(15,34,75,0.25)] ring-1 ring-navy-200" aria-label="Monthly report preview">
          {/* Header band */}
          <header className="bg-teal-600 px-6 py-6 text-white sm:px-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <KuroshioLogo white className="h-10" />
                <div className="leading-tight">
                  <p className="text-base font-bold">Kuroshio AI · EnergyIQ</p>
                  <p className="text-xs text-teal-100">Prepared for Imdaad</p>
                </div>
              </div>
              <span className="rounded bg-white/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ring-1 ring-white/30">Sample data — for demonstration only</span>
            </div>
            <h2 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">Monthly Energy &amp; SMDB Report</h2>
            <p className="mt-1 text-teal-100">{report.monthLabel}</p>
          </header>

          <div className="px-6 py-8 sm:px-10">
            {/* Report details */}
            <dl className="grid gap-x-8 gap-y-3 border-b border-navy-100 pb-6 text-sm sm:grid-cols-2">
              {[
                ['Prepared for', recipient],
                ['Client / scope', recipientSub],
                ['Reporting period', `${report.periodLabel}${report.isPartial ? ' (month to date)' : ''}`],
                ['Reference', ref],
                ['Issued', issued],
                ['Data source', 'Selec energy meters via Kuroshio IoT nodes'],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <dt className="w-36 shrink-0 text-navy-500">{label}</dt>
                  <dd className="font-semibold text-navy-900">{value}</dd>
                </div>
              ))}
            </dl>

            {/* Key figures */}
            <h3 className="mt-8 text-sm font-semibold tracking-wide text-navy-500 uppercase">Summary</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ['Electricity', `${formatNumber(e.totalKwh / 1000, 1)} MWh`, e.changePct === null ? `${e.days} days metered` : `${e.changePct > 0 ? '+' : ''}${e.changePct}% / day vs prior month`],
                ['Estimated cost', `AED ${formatNumber(report.cost.totalAed / 1000, 1)}k`, 'DEWA tariff, indicative'],
                ['Peak demand', `${formatNumber(e.peakKw)} kW`, `${formatNumber(e.afterHoursPct, 0)}% used after hours`],
                ['Waste identified', `AED ${formatNumber(report.waste.excessAed)}`, `${report.waste.patterns.length} pattern${report.waste.patterns.length === 1 ? '' : 's'}`],
                ['Scope 2 CO₂', `${formatNumber(report.co2.tonnes, 1)} t`, 'Indicative grid factor'],
              ].map(([label, value, sub], i) => (
                <div key={label} className={cn('rounded-md border-l-4 border-teal-600 bg-teal-50 px-3 py-3', i === 4 && 'col-span-2 sm:col-span-1')}>
                  <dt className="text-xs font-medium text-navy-600">{label}</dt>
                  <dd className="mt-0.5 text-lg font-bold whitespace-nowrap text-navy-950 tabular-nums">{value}</dd>
                  <dd className="text-[11px] text-navy-500">{sub}</dd>
                </div>
              ))}
            </dl>

            {/* Sections */}
            <DocSection n={1} title="Electricity by building">
              <DocTable
                head={['Building', 'Electricity', 'Share', 'EUI (kWh/m²·yr)', 'After hours']}
                rows={e.byBuilding.map((b) => [
                  b.name,
                  `${formatNumber(b.kwh / 1000, 1)} MWh`,
                  <ShareBar key="s" pct={e.totalKwh ? (b.kwh / e.totalKwh) * 100 : 0} />,
                  formatNumber(b.eui),
                  `${formatNumber(b.afterHoursPct, 0)}%`,
                ])}
              />
              <p className="mt-3 text-sm text-navy-600">
                Average per day by day type:{' '}
                {e.byDayType.map((d, i) => (
                  <span key={d.dayType}>
                    {i > 0 && ' · '}
                    <strong className="font-semibold text-navy-800">{d.label}</strong> {formatNumber(d.avgKwhPerDay)} kWh
                    {d.vsWorkdayPct !== null && ` (${d.vsWorkdayPct}% of a normal day)`}
                  </span>
                ))}
                .
              </p>
            </DocSection>

            <DocSection n={2} title="Energy waste & savings opportunities">
              {report.waste.patterns.length ? (
                <DocTable
                  head={['Finding', 'Days', 'AED this month', 'AED / year*', 'Status']}
                  rows={report.waste.patterns.map((p) => [
                    <span key="t">
                      {p.title}
                      <span className="block text-xs text-navy-500">{p.site}</span>
                    </span>,
                    p.days,
                    formatNumber(p.aed),
                    formatNumber(p.annualAed),
                    p.status,
                  ])}
                />
              ) : (
                <p className="text-sm text-navy-600">No waste patterns were detected this month.</p>
              )}
              <p className="mt-2 text-xs text-navy-500">* If the pattern continues unchanged. Actual savings are to be measured during the pilot.</p>
            </DocSection>

            <DocSection n={3} title="Estimated electricity cost">
              <DocTable head={['Site', 'DEWA account', 'kWh', 'AED', 'fils / kWh']} rows={report.cost.bySite.map((s) => [s.name, s.account, formatNumber(s.kwh), formatNumber(s.aed), s.filsPerKwh.toFixed(1)])} />
              {report.cost.topCostCentres.length > 0 && (
                <p className="mt-3 text-sm text-navy-600">
                  Largest cost centres:{' '}
                  {report.cost.topCostCentres.slice(0, 4).map((c, i) => (
                    <span key={`${c.site}-${c.name}`}>
                      {i > 0 && ' · '}
                      {c.name} <span className="text-navy-400">({c.site})</span> AED {formatNumber(c.aed)}
                    </span>
                  ))}
                  .
                </p>
              )}
            </DocSection>

            <DocSection n={4} title="Power quality, asset health & actions">
              {report.powerQuality.length > 0 ? (
                <DocTable head={['Board', 'Finding', 'Value']} rows={report.powerQuality.map((p) => [`${p.board} · ${p.site}`, p.issue, p.value])} />
              ) : (
                <p className="text-sm text-navy-600">All boards were within their power-quality limits at the time of the report.</p>
              )}
              <p className="mt-3 text-sm text-navy-600">
                <strong className="font-semibold text-navy-800">{report.assets.monitored}</strong> monitored assets: {report.assets.ok} healthy, {report.assets.watch} under watch,{' '}
                {report.assets.alert} in alert. <strong className="font-semibold text-navy-800">{report.alerts.total}</strong> alerts ({report.alerts.critical} critical) and{' '}
                <strong className="font-semibold text-navy-800">{report.workOrders.raised}</strong> work orders raised, {report.workOrders.closed} closed.
              </p>
            </DocSection>

            <DocSection n={5} title="Scope 2 emissions">
              <p className="text-sm text-navy-700">
                Estimated location-based Scope 2 emissions for the period: <strong className="text-base font-bold text-navy-950">{formatNumber(report.co2.tonnes, 1)} t CO₂e</strong>.
              </p>
              <p className="mt-1 text-xs text-navy-500">{EMISSION_FACTOR_NOTE}</p>
            </DocSection>

            {/* Sign-off */}
            <div className="mt-12 grid gap-8 sm:grid-cols-2">
              <Signature role="Prepared by" title="Energy & MEP Engineer" org="Imdaad · FM provider" />
              <Signature role="Reviewed by" title="FM Operations Manager" org="Imdaad · FM provider" />
            </div>
          </div>

          {/* Footer */}
          <footer className="flex flex-wrap justify-between gap-2 border-t border-navy-100 bg-navy-50 px-6 py-3 text-[11px] text-navy-500 sm:px-10">
            <span className="font-semibold text-amber-700">Sample data — for demonstration only</span>
            <span>Tariff and emission factor are indicative.</span>
            <span>Kuroshio AI · www.kuroshioai.com</span>
          </footer>
        </article>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- document parts

function DocSection({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h3 className="flex items-center gap-3 text-lg font-bold text-navy-950">
        <span className="flex size-7 items-center justify-center rounded bg-teal-600 text-sm font-bold text-white tabular-nums">{n}</span>
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function DocTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-navy-100">
      <table className="w-full text-left text-sm">
        <thead className="bg-teal-50">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={cn('px-3 py-2.5 text-xs font-semibold text-navy-800', i === 0 ? 'text-left' : 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-t border-navy-100 even:bg-navy-50/50">
              {row.map((cell, i) => (
                <td key={i} className={cn('px-3 py-2.5 align-top', i === 0 ? 'text-navy-900' : 'text-right text-navy-700 tabular-nums')}>
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

function ShareBar({ pct }: { pct: number }) {
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="hidden h-1.5 w-20 rounded-full bg-navy-100 sm:inline-block">
        <span className="block h-1.5 rounded-full bg-teal-600" style={{ width: `${Math.min(100, pct)}%` }} />
      </span>
      {formatNumber(pct, 0)}%
    </span>
  )
}

function Signature({ role, title, org }: { role: string; title: string; org: string }) {
  return (
    <div>
      <div className="h-10 border-b border-navy-300" />
      <p className="mt-2 text-xs font-semibold tracking-wide text-navy-500 uppercase">{role}</p>
      <p className="text-sm font-semibold text-navy-900">{title}</p>
      <p className="text-xs text-navy-500">{org}</p>
    </div>
  )
}
