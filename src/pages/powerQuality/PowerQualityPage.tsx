import clsx from 'clsx'
import { Activity, CircleCheck, Gauge, Waves, Zap } from 'lucide-react'
import { Link } from 'react-router'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { LiveIndicator } from '../../components/smdb/SmdbBits'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { KpiCard } from '../../components/ui/KpiCard'
import { PageHeader } from '../../components/ui/PageHeader'
import { getSite } from '../../data/sites'
import { DEFAULT_THRESHOLDS } from '../../data/smdbs'
import { formatNumber } from '../../lib/format'
import { visibleSmdbs } from '../../lib/smdb'
import { useSimulator } from '../../sim/simulatorContext'
import { useAppState } from '../../store/hooks'

/** Current THD above this is flagged (IEEE 519-style guide value, indicative). */
const THD_LIMIT = 20
const TARGET_PF = 0.95

/** kVAr of capacitor bank needed to raise PF from `pf` to TARGET_PF at `kW`. */
function kvarToCorrect(kW: number, pf: number): number {
  if (pf >= TARGET_PF || kW <= 0) return 0
  const tan = (p: number) => Math.tan(Math.acos(p))
  return kW * (tan(pf) - tan(TARGET_PF))
}

/** Live power quality across every board: power factor, imbalance, voltage and harmonics. */
export default function PowerQualityPage() {
  const state = useAppState()
  const user = useCurrentUser()
  const sim = useSimulator()

  const rows = visibleSmdbs(user, state.site)
    .filter((s) => sim.health[s.id]?.status !== 'offline' && (sim.readings[s.id]?.kW ?? 0) > 0)
    .map((smdb) => {
      const r = sim.readings[smdb.id]
      const h = sim.health[smdb.id]
      const t = state.thresholds[smdb.id] ?? DEFAULT_THRESHOLDS
      const low = t.nominalVoltageV * (1 - t.voltageTolPct / 100)
      const high = t.nominalVoltageV * (1 + t.voltageTolPct / 100)
      const issues = {
        pf: r.pf < t.minPf,
        imbalance: h.imbalancePct > t.imbalancePct,
        voltage: h.minV < low || h.maxV > high,
        thd: h.maxThd > THD_LIMIT,
      }
      // Near-miss: within 70% of the limit, worth watching.
      const watchImbalance = !issues.imbalance && h.imbalancePct > t.imbalancePct * 0.7
      return { smdb, r, h, t, issues, watchImbalance, kvar: kvarToCorrect(r.kW, r.pf), score: Object.values(issues).filter(Boolean).length + (watchImbalance ? 0.5 : 0) }
    })
    .sort((a, b) => b.score - a.score || a.r.pf - b.r.pf)

  const count = (k: keyof (typeof rows)[number]['issues']) => rows.filter((r) => r.issues[k]).length
  const totalKvar = rows.reduce((s, r) => s + r.kvar, 0)
  const recs = rows.filter((r) => r.issues.pf || r.issues.thd || r.issues.imbalance || r.watchImbalance)

  return (
    <>
      <PageHeader
        title="Power quality"
        description="Live power factor, phase balance, voltage and current harmonics (THD) on every board. Poor power quality wastes capacity, heats cables and transformers, and shortens equipment life."
        actions={<LiveIndicator updatedAt={sim.updatedAt} intervalMs={sim.intervalMs} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Low power factor" value={count('pf')} sub={`Boards below their PF limit · ≈ ${formatNumber(totalKvar)} kVAr to correct to ${TARGET_PF}`} icon={Gauge} tone={count('pf') ? 'warn' : 'ok'} />
        <KpiCard label="Phase imbalance" value={count('imbalance')} sub={`${rows.filter((r) => r.watchImbalance).length} more close to the limit`} icon={Activity} tone={count('imbalance') ? 'warn' : 'ok'} />
        <KpiCard label="Voltage out of band" value={count('voltage')} sub="Outside nominal ± tolerance" icon={Zap} tone={count('voltage') ? 'warn' : 'ok'} />
        <KpiCard label="High harmonics" value={count('thd')} sub={`Current THD above ${THD_LIMIT}%`} icon={Waves} tone={count('thd') ? 'warn' : 'ok'} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card flush title="All boards" subtitle="Worst first · live values" className="xl:col-span-2">
          {rows.length === 0 ? (
            <EmptyState icon={Waves} title="No live boards in view" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-navy-50/60 text-xs font-semibold tracking-wide text-navy-500 uppercase">
                  <tr>
                    <th className="px-5 py-3">Board</th>
                    <th className="px-3 py-3 text-right">Load</th>
                    <th className="px-3 py-3 text-right">PF</th>
                    <th className="px-3 py-3 text-right">kVAr</th>
                    <th className="px-3 py-3 text-right">Imbalance</th>
                    <th className="px-3 py-3 text-right">Voltage L-N</th>
                    <th className="px-5 py-3 text-right">THD-I</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50 tabular-nums">
                  {rows.map(({ smdb, r, h, t, issues, watchImbalance }) => (
                    <tr key={smdb.id} className="hover:bg-navy-50/50">
                      <td className="px-5 py-2.5">
                        <Link to={`/smdb/${smdb.id}`} className="font-medium text-navy-900 hover:text-teal-700">
                          {smdb.name}
                        </Link>
                        <span className="block text-xs text-navy-500">{getSite(smdb.siteId)?.shortName}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">{formatNumber(r.kW)} kW</td>
                      <td className={clsx('px-3 py-2.5 text-right', issues.pf && 'font-semibold text-amber-700')}>{r.pf.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right">{formatNumber(r.kVAr)}</td>
                      <td className={clsx('px-3 py-2.5 text-right', issues.imbalance ? 'font-semibold text-amber-700' : watchImbalance && 'text-amber-600')}>
                        {h.imbalancePct.toFixed(1)}% <span className="text-xs text-navy-400">/ {t.imbalancePct}</span>
                      </td>
                      <td className={clsx('px-3 py-2.5 text-right', issues.voltage && 'font-semibold text-amber-700')}>
                        {Math.round(h.minV)}–{Math.round(h.maxV)} V
                      </td>
                      <td className={clsx('px-5 py-2.5 text-right', issues.thd && 'font-semibold text-amber-700')}>{h.maxThd.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Recommendations" subtitle="Generated from the live readings">
          {recs.length === 0 ? (
            <EmptyState icon={CircleCheck} title="Nothing to recommend">
              All boards are within their power-quality limits.
            </EmptyState>
          ) : (
            <ul className="space-y-4">
              {recs.slice(0, 6).map(({ smdb, r, h, t, issues, watchImbalance, kvar }) => (
                <li key={smdb.id} className="rounded-lg border border-navy-100 p-3">
                  <Link to={`/smdb/${smdb.id}`} className="font-semibold text-navy-900 hover:text-teal-700">
                    {smdb.name}
                  </Link>
                  <p className="text-xs text-navy-500">{getSite(smdb.siteId)?.name}</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-navy-700">
                    {issues.pf && (
                      <li>
                        <Badge tone="warn">PF {r.pf.toFixed(2)}</Badge> Check the capacitor bank and controller. About <strong>{formatNumber(kvar)} kVAr</strong> of correction would bring PF to {TARGET_PF},
                        cutting current by ≈ {Math.round((1 - r.pf / TARGET_PF) * 100)}%.
                      </li>
                    )}
                    {issues.thd && (
                      <li>
                        <Badge tone="warn">THD {h.maxThd.toFixed(0)}%</Badge> High current distortion from UPS / drives. Consider an active harmonic filter; check neutral conductor heating.
                      </li>
                    )}
                    {(issues.imbalance || watchImbalance) && (
                      <li>
                        <Badge tone="warn">Imbalance {h.imbalancePct.toFixed(0)}%</Badge> {issues.imbalance ? 'Above' : 'Close to'} the {t.imbalancePct}% limit. Redistribute single-phase circuits between phases at the next shutdown.
                      </li>
                    )}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-navy-500">Guide values are indicative. Limits per board are set under Settings → Alarm thresholds.</p>
        </Card>
      </div>
    </>
  )
}
