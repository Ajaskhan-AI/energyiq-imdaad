import clsx from 'clsx'
import { format } from 'date-fns'
import { ArrowRight, ClipboardList, Download, Flag } from 'lucide-react'
import { useState } from 'react'
import { can } from '../../auth/permissions'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/toastContext'
import { getBuilding, getSite } from '../../data/sites'
import { getSmdb } from '../../data/smdbs'
import { DAY_TYPE_LABELS } from '../../lib/calendar'
import { downloadCsv, toCsv } from '../../lib/csv'
import { fromISODate } from '../../lib/dates'
import { WASTE_KIND_LABELS, type WastePattern } from '../../lib/energyAnalysis'
import { formatNumber } from '../../lib/format'
import { TARIFF_NOTE } from '../../lib/tariff'
import { useAppState } from '../../store/hooks'
import { PatternModal } from './PatternModal'
import type { EnergyScope } from './scope'

/** Recurring waste patterns: energy used when the site is closed or after hours. */
export function WasteTab({ scope }: { scope: EnergyScope }) {
  const { reviewedWasteIds, workOrders } = useAppState()
  const user = useCurrentUser()
  const toast = useToast()
  const [showReviewed, setShowReviewed] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const isReviewed = (p: WastePattern) => reviewedWasteIds.includes(p.id)
  const workOrderFor = (p: WastePattern) => workOrders.find((w) => w.wasteFlagId === p.id)
  const list = scope.patterns.filter((p) => showReviewed || !isReviewed(p))
  const selectedPattern = scope.patterns.find((p) => p.id === selected)

  const exportCsv = () => {
    const csv = toCsv(
      ['Date', 'Site', 'Building', 'SMDB', 'Type', 'Day type', 'Actual kWh', 'Expected kWh', 'Excess kWh', 'Excess %', 'Indicative cost (AED)', 'Pattern reviewed'],
      scope.flags.map((f) => [
        f.date,
        getSite(f.siteId)?.name ?? f.siteId,
        getBuilding(f.buildingId)?.name ?? f.buildingId,
        getSmdb(f.smdbId)?.name ?? f.smdbId,
        WASTE_KIND_LABELS[f.kind],
        DAY_TYPE_LABELS[f.dayType],
        f.actualKwh,
        f.expectedKwh,
        f.excessKwh,
        f.excessPct,
        f.aed,
        reviewedWasteIds.includes(f.patternId) ? 'Yes' : 'No',
      ]),
    )
    const fileName = `EnergyIQ-Waste-Flags-${scope.from}-to-${scope.to}.csv`
    downloadCsv(fileName, csv)
    toast.show(`Exported ${scope.flags.length} flagged days to ${fileName}`)
  }

  return (
    <div className="space-y-6">
      <Card
        title="Recurring waste patterns"
        subtitle="Boards using much more than expected on closed days, or outside opening hours. Ranked by excess cost in the selected period."
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-navy-700">
              <input type="checkbox" checked={showReviewed} onChange={(e) => setShowReviewed(e.target.checked)} className="size-4 accent-teal-600" />
              Show reviewed
            </label>
            {can(user, 'energy.export') && (
              <Button size="sm" variant="secondary" onClick={exportCsv} disabled={!scope.flags.length}>
                <Download className="size-4" aria-hidden />
                Export CSV
              </Button>
            )}
          </>
        }
      >
        {list.length === 0 ? (
          <EmptyState icon={Flag} title="No open waste patterns for these filters">
            Every board is using energy in line with its site’s opening hours.
          </EmptyState>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {list.map((p) => {
              const wo = workOrderFor(p)
              const reviewed = isReviewed(p)
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(p.id)}
                    className={clsx(
                      'block h-full w-full rounded-xl border p-4 text-left transition hover:shadow-md',
                      reviewed ? 'border-navy-100 bg-white opacity-75' : 'border-amber-200 bg-amber-50/60 hover:border-amber-300',
                    )}
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="warn">{WASTE_KIND_LABELS[p.kind]}</Badge>
                      {reviewed && <Badge tone="ok">Reviewed</Badge>}
                      {wo && (
                        <Badge tone="info">
                          <ClipboardList className="size-3" aria-hidden />
                          {wo.id}
                        </Badge>
                      )}
                    </span>
                    <span className="mt-2 block font-semibold text-navy-900">{p.title}</span>
                    <span className="block text-sm text-navy-600">
                      {getSite(p.siteId)?.name} · {getBuilding(p.buildingId)?.shortName}
                    </span>
                    <span className="mt-2 block text-sm text-navy-700">{p.hint}</span>
                    <span className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <span>
                        <span className="block text-xs text-navy-500">Days flagged</span>
                        <span className="font-semibold text-navy-900 tabular-nums">
                          {p.days} / {scope.days}
                        </span>
                      </span>
                      <span>
                        <span className="block text-xs text-navy-500">Excess in period</span>
                        <span className="font-semibold text-navy-900 tabular-nums">
                          {formatNumber(p.excessKwh / 1000, 1)} MWh · AED {formatNumber(p.aed)}
                        </span>
                      </span>
                      <span>
                        <span className="block text-xs text-navy-500">If not fixed (per year)</span>
                        <span className="font-bold text-amber-800 tabular-nums">≈ AED {formatNumber(p.annualAed)}</span>
                      </span>
                    </span>
                    <span className="mt-3 flex items-center justify-between text-xs text-navy-500">
                      Last seen {format(fromISODate(p.lastDate), 'EEE d MMM')}
                      <span className="inline-flex items-center gap-1 font-semibold text-teal-700">
                        Details
                        <ArrowRight className="size-3.5" aria-hidden />
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <p className="mt-4 text-xs text-navy-500">
          {TARIFF_NOTE} Annual figures assume the pattern continues unchanged; actual savings are to be measured during the pilot.
        </p>
      </Card>

      {selectedPattern && <PatternModal pattern={selectedPattern} onClose={() => setSelected(null)} />}
    </div>
  )
}
