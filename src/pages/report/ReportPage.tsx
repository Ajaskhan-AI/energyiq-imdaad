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

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI']

/**
 * Monthly Energy & SMDB report, shown as a formal document: letterhead, reference
 * number, recipient, numbered sections, sign-off and seal. Pick month + scope
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
        <article className="relative mx-auto max-w-4xl bg-white p-2 shadow-[0_10px_40px_-12px_rgba(15,34,75,0.25)] ring-1 ring-navy-100 sm:p-3" aria-label="Monthly report preview">
          {/* Double frame */}
          <div className="border-2 border-teal-700 p-1">
            <div className="relative overflow-hidden border border-teal-700/40 px-5 py-8 sm:px-12 sm:py-12">
              <CornerOrnaments />

              {/* Watermark: this is a demo document */}
              <span className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[28deg] font-serif text-[7rem] font-bold tracking-[0.2em] whitespace-nowrap text-navy-100/60 select-none sm:text-[10rem]" aria-hidden>
                SAMPLE
              </span>

              <div className="relative">
                {/* Letterhead */}
                <header className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <KuroshioLogo className="h-12" />
                    <div className="leading-tight">
                      <p className="text-lg font-bold tracking-tight text-navy-950">
                        Kuroshio <span className="text-teal-600">AI</span>
                      </p>
                      <p className="text-xs font-semibold tracking-[0.18em] text-navy-500 uppercase">EnergyIQ · Prepared for Imdaad</p>
                    </div>
                  </div>
                  <dl className="text-right text-xs text-navy-600">
                    <div>
                      <dt className="inline font-semibold text-navy-800">Ref. </dt>
                      <dd className="inline font-mono">{ref}</dd>
                    </div>
                    <div>
                      <dt className="inline font-semibold text-navy-800">Issued </dt>
                      <dd className="inline">{issued}</dd>
                    </div>
                  </dl>
                </header>
                <DoubleRule className="mt-5" />

                {/* Title */}
                <div className="mt-8 text-center">
                  <p className="text-xs font-semibold tracking-[0.3em] text-teal-700 uppercase">Monthly report</p>
                  <h2 className="mt-2 font-serif text-3xl font-semibold text-navy-950 sm:text-4xl">Energy &amp; SMDB Performance</h2>
                  <p className="mt-2 font-serif text-lg text-navy-600 italic">{report.monthLabel}</p>
                  <p className="mx-auto mt-6 max-w-xl text-sm text-navy-600">This report summarises the metered electricity use, cost, findings and actions for</p>
                  <p className="mt-2 font-serif text-2xl font-semibold text-navy-950">{recipient}</p>
                  <p className="text-sm text-navy-500">{recipientSub}</p>
                  <p className="mt-3 text-xs text-navy-500">
                    Period {report.periodLabel}
                    {report.isPartial && ' · month to date'} · data from Selec meters via Kuroshio IoT nodes
                  </p>
                </div>

                {/* Key figures */}
                <dl className="mt-8 grid grid-cols-2 border-y border-navy-200 sm:grid-cols-5">
                  {[
                    ['Electricity', `${formatNumber(e.totalKwh / 1000, 1)} MWh`, e.changePct === null ? `${e.days} days metered` : `${e.changePct > 0 ? '+' : ''}${e.changePct}% / day vs prior month`],
                    ['Estimated cost', `AED ${formatNumber(report.cost.totalAed / 1000, 1)}k`, 'DEWA tariff, indicative'],
                    ['Peak demand', `${formatNumber(e.peakKw)} kW`, `${formatNumber(e.afterHoursPct, 0)}% used after hours`],
                    ['Waste identified', `AED ${formatNumber(report.waste.excessAed)}`, `${report.waste.patterns.length} pattern${report.waste.patterns.length === 1 ? '' : 's'}`],
                    ['Scope 2 CO₂', `${formatNumber(report.co2.tonnes, 1)} t`, 'Indicative grid factor'],
                  ].map(([label, value, sub], i) => (
                    <div key={label} className={cn('px-2 py-4 text-center', i > 0 && 'sm:border-l sm:border-navy-200', i % 2 === 1 && 'border-l border-navy-200 sm:border-l', i === 4 && 'col-span-2 border-t border-navy-200 sm:col-span-1 sm:border-t-0')}>
                      <dt className="text-[11px] font-semibold tracking-[0.14em] text-navy-500 uppercase">{label}</dt>
                      <dd className="mt-1 font-serif text-xl font-semibold whitespace-nowrap text-navy-950 tabular-nums">{value}</dd>
                      <dd className="text-xs text-navy-500">{sub}</dd>
                    </div>
                  ))}
                </dl>

                {/* Sections */}
                <DocSection n={0} title="Electricity by building">
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

                <DocSection n={1} title="Energy waste & savings opportunities">
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
                  <p className="mt-2 text-xs text-navy-500 italic">* If the pattern continues unchanged. Actual savings are to be measured during the pilot.</p>
                </DocSection>

                <DocSection n={2} title="Estimated electricity cost">
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

                <DocSection n={3} title="Power quality, asset health & actions">
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

                <DocSection n={4} title="Scope 2 emissions">
                  <p className="text-sm text-navy-700">
                    Estimated location-based Scope 2 emissions for the period: <strong className="font-serif text-lg font-semibold text-navy-950">{formatNumber(report.co2.tonnes, 1)} t CO₂e</strong>.
                  </p>
                  <p className="mt-1 text-xs text-navy-500 italic">{EMISSION_FACTOR_NOTE}</p>
                </DocSection>

                {/* Sign-off */}
                <div className="mt-12 grid items-end gap-8 sm:grid-cols-[1fr_auto_1fr]">
                  <Signature role="Prepared by" title="Energy & MEP Engineer" org="Imdaad · FM provider" />
                  <Seal month={report.monthLabel} />
                  <Signature role="Reviewed by" title="FM Operations Manager" org="Imdaad · FM provider" />
                </div>

                {/* Footer */}
                <DoubleRule className="mt-10" />
                <footer className="mt-3 flex flex-wrap justify-between gap-2 text-[11px] text-navy-500">
                  <span className="font-semibold text-amber-700">Sample data — for demonstration only</span>
                  <span>Tariff and emission factor are indicative.</span>
                  <span>www.kuroshioai.com</span>
                </footer>
              </div>
            </div>
          </div>
        </article>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- document parts

function DoubleRule({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-0.5', className)} aria-hidden>
      <div className="h-px bg-teal-700" />
      <div className="h-px bg-teal-700/40" />
    </div>
  )
}

function DocSection({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h3 className="flex items-baseline gap-3 border-b border-navy-200 pb-2 font-serif text-xl font-semibold text-navy-950">
        <span className="font-serif text-base text-teal-700">{ROMAN[n]}.</span>
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function DocTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b-2 border-navy-800">
            {head.map((h, i) => (
              <th key={h} className={cn('py-2 text-[11px] font-semibold tracking-[0.1em] text-navy-700 uppercase', i === 0 ? 'pr-3' : 'px-2 text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-navy-100">
              {row.map((cell, i) => (
                <td key={i} className={cn('py-2.5 align-top', i === 0 ? 'pr-3 text-navy-900' : 'px-2 text-right text-navy-700 tabular-nums')}>
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
      <span className="hidden h-1.5 w-20 bg-navy-100 sm:inline-block">
        <span className="block h-1.5 bg-teal-600" style={{ width: `${Math.min(100, pct)}%` }} />
      </span>
      {formatNumber(pct, 0)}%
    </span>
  )
}

function Signature({ role, title, org }: { role: string; title: string; org: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto h-10 w-56 border-b border-navy-400" />
      <p className="mt-2 text-[11px] font-semibold tracking-[0.14em] text-navy-500 uppercase">{role}</p>
      <p className="font-serif text-base font-semibold text-navy-900">{title}</p>
      <p className="text-xs text-navy-500">{org}</p>
    </div>
  )
}

/** Round "metered data" seal with the logo in the middle. */
function Seal({ month }: { month: string }) {
  return (
    <div className="mx-auto">
      <svg viewBox="0 0 140 140" className="size-32 text-teal-700" role="img" aria-label={`EnergyIQ metered data seal, ${month}`}>
        <defs>
          <path id="seal-top" d="M 20 70 A 50 50 0 0 1 120 70" />
          <path id="seal-bottom" d="M 26 74 A 44 44 0 0 0 114 74" />
        </defs>
        <circle cx="70" cy="70" r="66" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="70" cy="70" r="61" fill="none" stroke="currentColor" strokeWidth="0.75" strokeDasharray="2 3" />
        <circle cx="70" cy="70" r="38" fill="none" stroke="currentColor" strokeWidth="1" />
        <text fontSize="8.5" fontWeight="700" letterSpacing="1.2" fill="currentColor">
          <textPath href="#seal-top" startOffset="50%" textAnchor="middle">
            ENERGYIQ · METERED DATA
          </textPath>
        </text>
        <text fontSize="8.5" fontWeight="600" letterSpacing="1.6" fill="currentColor">
          <textPath href="#seal-bottom" startOffset="50%" textAnchor="middle">
            {month.toUpperCase()}
          </textPath>
        </text>
        <image href={`${import.meta.env.BASE_URL}kuroshio-logo.png`} x="46" y="54" width="48" height="31" />
      </svg>
    </div>
  )
}

function CornerOrnaments() {
  const base = 'pointer-events-none absolute size-6 border-teal-700'
  return (
    <>
      <span className={cn(base, 'top-2 left-2 border-t-2 border-l-2')} aria-hidden />
      <span className={cn(base, 'top-2 right-2 border-t-2 border-r-2')} aria-hidden />
      <span className={cn(base, 'bottom-2 left-2 border-b-2 border-l-2')} aria-hidden />
      <span className={cn(base, 'right-2 bottom-2 border-r-2 border-b-2')} aria-hidden />
    </>
  )
}
