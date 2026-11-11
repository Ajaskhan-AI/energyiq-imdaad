import { Coins, Download, FileDown, Receipt, Users, Zap } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router'
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
import { getSmdb } from '../../data/smdbs'
import { billingForMonth, billingMonths } from '../../lib/billing'
import { downloadCsv, toCsv } from '../../lib/csv'
import { formatNumber } from '../../lib/format'
import { scopedSiteIds } from '../../lib/scope'
import { TARIFF_NOTE } from '../../lib/tariff'
import { downloadRechargePdf } from '../../pdf/rechargePdf'
import { useAppState } from '../../store/hooks'

/** Billing & sub-metering: estimated DEWA bill per site and recharge per tenant / cost centre. */
export default function BillingPage() {
  const { site } = useAppState()
  const user = useCurrentUser()
  const toast = useToast()
  const now = useMemo(() => new Date(), [])
  const history = useMemo(() => getEnergyHistory(now), [now])
  const months = billingMonths(now)
  const [month, setMonth] = useState(months[1].id) // last full month by default

  const ids = scopedSiteIds(user, site)
  const billing = useMemo(() => billingForMonth(month, history.boards, ids, now), [month, history, ids, now])
  const centres = billing.sites.reduce((n, s) => n + s.costCentres.length, 0)
  const canExport = can(user, 'billing.export')

  const exportCsv = () => {
    const csv = toCsv(
      ['Month', 'Client', 'Site', 'DEWA account', 'Cost centre', 'SMDBs', 'kWh', 'Share %', 'Recharge AED (indicative)'],
      billing.sites.flatMap((b) =>
        b.costCentres.map((c) => [
          billing.month,
          getClient(b.site.clientId)?.name ?? '',
          b.site.name,
          b.site.dewaAccount,
          c.name,
          c.smdbIds.map((id) => getSmdb(id)?.meterId ?? id).join(' + '),
          Math.round(c.kWh),
          c.sharePct.toFixed(1),
          Math.round(c.aed),
        ]),
      ),
    )
    const fileName = `EnergyIQ-Recharge-${billing.month}.csv`
    downloadCsv(fileName, csv)
    toast.show(`Exported ${centres} cost-centre lines to ${fileName}`)
  }

  return (
    <>
      <PageHeader
        title="Billing & sub-metering"
        description="Each site’s electricity cost estimated from its SMDB meters, then recharged to tenants and landlord cost centres by metered consumption. No more estimating by floor area."
        actions={
          <>
            <select aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)} className={`${inputClass} w-auto`}>
              {months.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            {canExport && (
              <Button variant="secondary" onClick={exportCsv} disabled={!centres}>
                <Download className="size-4" aria-hidden />
                Export CSV
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Metered electricity" value={`${formatNumber(billing.totalKwh / 1000, 1)} MWh`} sub={`${billing.label}${billing.partial ? ' · month to date' : ''}`} icon={Zap} tone="info" />
        <KpiCard label="Estimated DEWA charges" value={`AED ${formatNumber(billing.totalAed)}`} sub="Slab tariff + fuel surcharge (indicative)" icon={Coins} tone="neutral" />
        <KpiCard label="Sites billed" value={billing.sites.length} sub="One DEWA premises account each" icon={Receipt} tone="neutral" />
        <KpiCard label="Cost centres recharged" value={centres} sub="Tenants and landlord areas" icon={Users} tone="neutral" />
      </div>

      {billing.sites.length === 0 ? (
        <Card className="mt-6">
          <EmptyState icon={Receipt} title="No meter data for this month" />
        </Card>
      ) : (
        <div className="mt-6 space-y-6">
          {billing.sites.map((b) => (
            <Card
              key={b.site.id}
              flush
              title={b.site.name}
              subtitle={`${getClient(b.site.clientId)?.name} · DEWA account ${b.site.dewaAccount} · ${b.days} days of data · average ${b.avgFilsPerKwh.toFixed(1)} fils/kWh`}
              actions={
                canExport && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const file = downloadRechargePdf(billing, b)
                      toast.show(`Downloaded ${file}`)
                    }}
                  >
                    <FileDown className="size-4" aria-hidden />
                    Recharge statement PDF
                  </Button>
                )
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-navy-50/60 text-xs font-semibold tracking-wide text-navy-500 uppercase">
                    <tr>
                      <th className="px-5 py-3">Cost centre</th>
                      <th className="px-3 py-3">Meters</th>
                      <th className="px-3 py-3 text-right">kWh</th>
                      <th className="px-3 py-3 text-right">Share</th>
                      <th className="px-3 py-3 text-right">Peak kW</th>
                      <th className="px-5 py-3 text-right">Recharge (AED)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-50 tabular-nums">
                    {b.costCentres.map((c) => (
                      <tr key={c.name}>
                        <td className="px-5 py-2.5 font-medium text-navy-900">{c.name}</td>
                        <td className="px-3 py-2.5 text-navy-600">
                          {c.smdbIds.map((id, i) => (
                            <Fragment key={id}>
                              {i > 0 && ', '}
                              <Link to={`/smdb/${id}`} className="hover:text-teal-700 hover:underline">
                                {getSmdb(id)?.meterId}
                              </Link>
                            </Fragment>
                          ))}
                        </td>
                        <td className="px-3 py-2.5 text-right">{formatNumber(c.kWh)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="inline-flex items-center gap-2">
                            <span className="hidden h-1.5 w-16 rounded-full bg-navy-50 sm:inline-block">
                              <span className="block h-1.5 rounded-full bg-teal-500" style={{ width: `${c.sharePct}%` }} />
                            </span>
                            {c.sharePct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">{formatNumber(c.peakKw)}</td>
                        <td className="px-5 py-2.5 text-right font-semibold">{formatNumber(c.aed)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-navy-100 font-semibold tabular-nums">
                    <tr>
                      <td className="px-5 py-2.5">Site total</td>
                      <td className="px-3 py-2.5 text-xs font-normal text-navy-500">
                        Energy AED {formatNumber(b.energyAed)} + fuel surcharge AED {formatNumber(b.fuelAed)}
                      </td>
                      <td className="px-3 py-2.5 text-right">{formatNumber(b.kWh)}</td>
                      <td className="px-3 py-2.5 text-right">100%</td>
                      <td />
                      <td className="px-5 py-2.5 text-right">{formatNumber(b.totalAed)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          ))}
          <p className="text-xs text-navy-500">
            {TARIFF_NOTE} Recharge uses each site’s average rate. Real tenant billing would follow the lease terms and DEWA’s rules for sub-metering.
          </p>
        </div>
      )}
    </>
  )
}
