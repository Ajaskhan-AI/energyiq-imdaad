import { format } from 'date-fns'
import { Building2, Download, Factory, FileText, Info, Leaf, Sprout, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/shadcn/table'
import { can } from '../../auth/permissions'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { KpiCard } from '../../components/ui/KpiCard'
import { PageHeader } from '../../components/ui/PageHeader'
import { inputClass } from '../../components/ui/styles'
import { useToast } from '../../components/ui/toastContext'
import { getEnergyHistory } from '../../data/energy'
import { getClient } from '../../data/sites'
import { carbonFileName, carbonOpportunities, carbonPeriods, carbonSummary, monthlyCarbon, periodRange, type CarbonPeriod } from '../../lib/carbon'
import { EMISSION_FACTOR_NOTE, GRID_FACTOR_KG_PER_KWH } from '../../lib/co2'
import { analyseEnergy, groupPatterns } from '../../lib/energyAnalysis'
import { formatNumber } from '../../lib/format'
import { allowedSites, scopedSiteIds } from '../../lib/scope'
import { useAppState } from '../../store/hooks'

const AXIS = { fontSize: 12, fill: '#6a87c4' }
/** One blue shade per site in the stacked chart (logo blue first). */
const SITE_COLORS = ['#014cc3', '#4f86e8', '#0f224b', '#93b4f2', '#2f4f92']
const t = (v: number, digits = 1) => `${formatNumber(v, digits)} t`

/** Scope 2 carbon emissions from the SMDB meters, using the DEWA grid emission factor. */
export default function CarbonPage() {
  const state = useAppState()
  const user = useCurrentUser()
  const toast = useToast()
  const now = useMemo(() => new Date(), [])
  const history = useMemo(() => getEnergyHistory(now), [now])
  const canDownload = can(user, 'carbon.export')

  const ids = scopedSiteIds(user, state.site)
  const sites = allowedSites(user).filter((s) => ids.has(s.id))
  const idKey = [...ids].join()

  const [period, setPeriod] = useState<CarbonPeriod>(() => format(new Date(now.getFullYear(), now.getMonth() - 1, 1), 'yyyy-MM'))
  const [busy, setBusy] = useState(false)
  const range = periodRange(period, now)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(() => carbonSummary(history.boards, ids, period, now), [history, idKey, period, now])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const year = useMemo(() => carbonSummary(history.boards, ids, '12m', now), [history, idKey, now])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const monthly = useMemo(() => monthlyCarbon(history.boards, ids, now), [history, idKey, now])

  // Open waste patterns of the last 30 days → emissions that could be avoided.
  const analysis = useMemo(() => analyseEnergy(history.boards, state.calendar, 365), [history, state.calendar])
  const from30 = format(new Date(now.getTime() - 30 * 86_400_000), 'yyyy-MM-dd')
  const opportunities = carbonOpportunities(
    groupPatterns(analysis.flags.filter((f) => f.date >= from30), 30).filter((p) => !state.reviewedWasteIds.includes(p.id)),
    ids,
  )
  const avoidable = opportunities.reduce((s, o) => s + o.tonnesPerYear, 0)

  // Who the PDF is for: one client if every site in view belongs to it.
  const clientIds = new Set(sites.map((s) => s.clientId))
  const recipient = clientIds.size === 1 ? (getClient(sites[0]?.clientId ?? '')?.name ?? '') : 'Imdaad FM portfolio'
  const scopeLabel = sites.length === 1 ? sites[0].name : `${sites.length} sites`
  const fileKey = sites.length === 1 ? sites[0].id : clientIds.size === 1 ? recipient : 'AllSites'

  const download = async () => {
    setBusy(true)
    try {
      // Load the PDF library only when needed.
      const { downloadCarbonReport } = await import('../../pdf/carbonReport')
      const fileName = await downloadCarbonReport({
        summary,
        monthly,
        sites: sites.map((s) => ({ id: s.id, name: s.shortName })),
        opportunities,
        periodLabel: range.label + (range.isPartial ? ' (to date)' : ''),
        fileName: carbonFileName(period, fileKey),
        recipient,
        scopeLabel,
        reference: `EIQ-CO2-${period.replace('-', '').toUpperCase()}-${fileKey.replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase()}`,
        issued: format(now, 'd MMMM yyyy'),
      })
      toast.show(`Downloaded ${fileName}`)
    } catch (error) {
      console.error(error)
      toast.show('Could not create the PDF', 'alert')
    } finally {
      setBusy(false)
    }
  }

  if (!sites.length) {
    return (
      <>
        <PageHeader title="Carbon emissions" />
        <Card>
          <EmptyState icon={Leaf} title="No sites in view" />
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Carbon emissions · Scope 2"
        description="Greenhouse-gas emissions from the electricity each site buys from DEWA, measured by its SMDB meters and converted with the DEWA grid emission factor. Ready for the client's ESG reporting."
      />

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4 shadow-sm">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-800">Reporting period</span>
          <select value={period} onChange={(ev) => setPeriod(ev.target.value)} className={`${inputClass} min-w-56`}>
            {carbonPeriods(now).map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <Button variant="teal" size="lg" onClick={download} disabled={!canDownload || busy}>
          <Download className="size-5" aria-hidden />
          {busy ? 'Creating PDF…' : 'Download carbon report (PDF)'}
        </Button>
        <p className="text-sm text-navy-500">
          <FileText className="mr-1 inline size-4" aria-hidden />
          {carbonFileName(period, fileKey)}
        </p>
        {!canDownload && <p className="w-full text-sm text-navy-500">Your role can view emissions; downloading the report is for FM and client roles.</p>}
      </div>

      {/* KPIs */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={`Scope 2 emissions · ${range.label.length > 20 ? 'last 12 months' : range.label}`}
          value={t(summary.tonnes)}
          sub={
            summary.changePct === null ? (
              `${formatNumber(summary.kwh / 1000, 1)} MWh metered`
            ) : (
              <span className="inline-flex items-center gap-1">
                {summary.changePct > 0 ? <TrendingUp className="size-3.5" aria-hidden /> : <TrendingDown className="size-3.5" aria-hidden />}
                {summary.changePct > 0 ? '+' : ''}
                {summary.changePct}% vs previous period
              </span>
            )
          }
          icon={Leaf}
          tone="info"
        />
        <KpiCard label="Last 12 months" value={t(year.tonnes, 0)} sub={`${formatNumber(year.kwh / 1000, 0)} MWh × ${GRID_FACTOR_KG_PER_KWH} kg/kWh`} icon={Factory} tone="neutral" />
        <KpiCard label="Carbon intensity" value={`${formatNumber(summary.intensityKgM2Yr, 0)} kg/m²`} sub="kg CO₂e per m² per year" icon={Building2} tone="neutral" />
        <KpiCard
          label="Avoidable emissions"
          value={`${t(avoidable)}/yr`}
          sub={`From ${opportunities.length} open waste pattern${opportunities.length === 1 ? '' : 's'}`}
          icon={Sprout}
          tone={avoidable > 0 ? 'warn' : 'ok'}
          to="/energy?tab=waste"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {/* Monthly trend */}
        <Card className="xl:col-span-2" title="Monthly Scope 2 emissions" subtitle="t CO₂e per month and site, last 12 months (this month to date)">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#e3eaf8" vertical={false} />
                <XAxis dataKey="label" tick={AXIS} />
                <YAxis tick={AXIS} width={48} />
                <Tooltip formatter={(v, name) => [t(Number(v)), sites.find((s) => s.id === name)?.shortName ?? String(name)]} cursor={{ fill: '#f3f6fd' }} />
                <Legend formatter={(v) => sites.find((s) => s.id === v)?.shortName ?? v} wrapperStyle={{ fontSize: 12 }} />
                {sites.map((s, i) => (
                  <Bar key={s.id} dataKey={s.id} stackId="co2" fill={SITE_COLORS[i % SITE_COLORS.length]} isAnimationActive={false} radius={i === sites.length - 1 ? [3, 3, 0, 0] : 0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Emission factor */}
        <Card title="Emission factor & method">
          <div className="rounded-lg border-l-4 border-teal-600 bg-teal-50 px-4 py-3">
            <p className="text-xs font-medium text-navy-600">DEWA grid emission factor</p>
            <p className="text-3xl font-bold text-navy-950 tabular-nums">
              {GRID_FACTOR_KG_PER_KWH.toFixed(2)} <span className="text-base font-semibold text-navy-600">kg CO₂e / kWh</span>
            </p>
            <p className="text-xs text-amber-700">Indicative value for the demo</p>
          </div>
          <dl className="mt-4 space-y-2.5 text-sm">
            {[
              ['Scope', 'Scope 2: purchased electricity'],
              ['Method', 'Location-based (GHG Protocol)'],
              ['Activity data', 'kWh from Selec meters on each SMDB'],
              ['Formula', 't CO₂e = kWh × factor ÷ 1,000'],
              ['Data through', format(new Date(`${summary.to}T00:00:00`), 'd MMM yyyy')],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-navy-500">{k}</dt>
                <dd className="text-right font-medium text-navy-900">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-navy-500">{EMISSION_FACTOR_NOTE}</p>
        </Card>
      </div>

      {/* By site */}
      <Card className="mt-6" flush title={`Emissions by site · ${range.label}${range.isPartial ? ' (to date)' : ''}`} subtitle="Intensity is scaled to a full year so periods of different length compare fairly">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Site</TableHead>
              <TableHead className="text-right">Electricity</TableHead>
              <TableHead className="text-right">Scope 2</TableHead>
              <TableHead className="text-right">Share</TableHead>
              <TableHead className="text-right">Intensity</TableHead>
              <TableHead className="pr-5 text-right">After hours</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.bySite.map((s) => (
              <TableRow key={s.site.id}>
                <TableCell className="pl-5">
                  <p className="font-semibold text-navy-950">{s.site.name}</p>
                  <p className="text-xs text-navy-500">{s.clientName}</p>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(s.kwh / 1000, 1)} MWh</TableCell>
                <TableCell className="text-right font-semibold text-navy-950 tabular-nums">{t(s.tonnes)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className="inline-flex items-center justify-end gap-2">
                    <span className="hidden h-1.5 w-16 rounded-full bg-navy-100 sm:inline-block">
                      <span className="block h-1.5 rounded-full bg-teal-600" style={{ width: `${Math.min(100, s.sharePct)}%` }} />
                    </span>
                    {formatNumber(s.sharePct, 0)}%
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(s.intensityKgM2Yr, 0)} kg/m²·yr</TableCell>
                <TableCell className="pr-5 text-right tabular-nums">
                  {t(s.afterHoursTonnes)} <span className="text-navy-400">({formatNumber(s.tonnes ? (s.afterHoursTonnes / s.tonnes) * 100 : 0, 0)}%)</span>
                </TableCell>
              </TableRow>
            ))}
            {summary.bySite.length > 1 && (
              <TableRow className="bg-navy-50/60 font-semibold">
                <TableCell className="pl-5 text-navy-950">Total</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(summary.kwh / 1000, 1)} MWh</TableCell>
                <TableCell className="text-right text-navy-950 tabular-nums">{t(summary.tonnes)}</TableCell>
                <TableCell className="text-right">100%</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(summary.intensityKgM2Yr, 0)} kg/m²·yr</TableCell>
                <TableCell className="pr-5 text-right tabular-nums">{t(summary.afterHoursTonnes)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {/* By load type */}
        <Card title="Where the emissions come from" subtitle="By type of load on the SMDB, same period">
          <ul className="space-y-3">
            {summary.byLoadType.map((l) => (
              <li key={l.loadType}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-navy-800">{l.label}</span>
                  <span className="text-navy-600 tabular-nums">
                    <strong className="text-navy-950">{t(l.tonnes)}</strong> · {formatNumber(l.sharePct, 0)}%
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-navy-50">
                  <div className="h-2 rounded-full bg-teal-600" style={{ width: `${Math.max(1, l.sharePct)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Reduction opportunities */}
        <Card title="Reduction opportunities" subtitle="Open waste patterns found by the energy analytics, as CO₂e per year if they continue">
          {opportunities.length === 0 ? (
            <EmptyState icon={Sprout} title="No open waste patterns">Nothing to fix right now in the sites in view.</EmptyState>
          ) : (
            <ul className="divide-y divide-navy-100">
              {opportunities.map((o) => (
                <li key={o.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-medium text-navy-900">{o.title}</p>
                    <p className="text-xs text-navy-500">
                      {o.siteName} · about AED {formatNumber(o.aedPerYear)} / yr
                    </p>
                  </div>
                  <p className="shrink-0 text-right font-semibold text-navy-950 tabular-nums">{t(o.tonnesPerYear)}/yr</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 flex items-start gap-1.5 text-xs text-navy-500">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Indicative, if the pattern continues unchanged. Actual reductions are to be measured during the pilot.
          </p>
        </Card>
      </div>
    </>
  )
}
