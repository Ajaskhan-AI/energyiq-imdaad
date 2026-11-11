import clsx from 'clsx'
import { FlaskConical, Pencil, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { can } from '../../auth/permissions'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { useResetDemo } from '../../components/layout/useResetDemo'
import { FaultControls } from '../../components/smdb/FaultControls'
import { SmdbStatusBadge } from '../../components/smdb/SmdbBits'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { inputClass } from '../../components/ui/styles'
import { useToast } from '../../components/ui/toastContext'
import { getSite } from '../../data/sites'
import { DEFAULT_THRESHOLDS, SMDBS } from '../../data/smdbs'
import { filterBySite } from '../../lib/scope'
import { useSimulator } from '../../sim/simulatorContext'
import { actions } from '../../store/actions'
import { useAppDispatch, useAppState } from '../../store/hooks'
import type { Smdb, SmdbThresholds } from '../../types'
import { UsersSection } from './UsersSection'

export default function SettingsPage() {
  const user = useCurrentUser()
  const { site } = useAppState()
  const resetDemo = useResetDemo()
  const [params] = useSearchParams()
  const focusId = params.get('smdb')
  const canEdit = can(user, 'smdb.editThresholds')

  return (
    <>
      <PageHeader title="Settings" description="Alarm thresholds, users & roles, and demo tools." />
      <div className="space-y-6">
        {canEdit && (
          <Card
            title={
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="size-5 text-teal-600" aria-hidden /> SMDB alarm thresholds
              </span>
            }
            subtitle="Changes apply to the live status straight away. Defaults: warning > 80%, critical > 95% of breaker rating, imbalance > 15%, voltage ±10%, power factor < 0.90. Boards follow the site selected in the top bar."
            flush
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-navy-50/60 text-xs font-semibold tracking-wide text-navy-500 uppercase">
                  <tr>
                    <th className="px-5 py-3">Board</th>
                    <th className="px-3 py-3">Status now</th>
                    <th className="px-3 py-3">Warning %</th>
                    <th className="px-3 py-3">Critical %</th>
                    <th className="px-3 py-3">Imbalance %</th>
                    <th className="px-3 py-3">Voltage ±%</th>
                    <th className="px-3 py-3">Min PF</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50">
                  {filterBySite(SMDBS, user, site).map((smdb) => (
                    <ThresholdRow key={smdb.id} smdb={smdb} focus={focusId === smdb.id} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {can(user, 'smdb.simulateFault') && (
          <Card
            title={
              <span className="flex items-center gap-2">
                <FlaskConical className="size-5 text-amber-600" aria-hidden /> Simulate fault (demo helper)
              </span>
            }
            subtitle="Trip, overload or drop the power factor on a board to show the live alert → acknowledge → work order flow. IoT comms loss can be simulated on the Device health page."
          >
            <FaultControls />
          </Card>
        )}

        {(can(user, 'users.view') || can(user, 'users.manage')) && <UsersSection />}

        {can(user, 'demo.reset') && (
          <Card title="Demo data" subtitle="Restore the original sample data. Everything created during the demo is removed and you are logged out.">
            <Button variant="danger" onClick={resetDemo}>
              <RotateCcw className="size-4" aria-hidden />
              Reset demo data
            </Button>
          </Card>
        )}

        {!canEdit && !can(user, 'smdb.simulateFault') && (
          <p className="text-sm text-navy-500">
            Thresholds are managed by the FM Operations Manager, the Energy & MEP Engineer and the System Admin. <Link to="/smdb" className="text-teal-700 underline">Back to monitoring</Link>
          </p>
        )}
      </div>
    </>
  )
}

type Draft = Record<'warnLoadPct' | 'critLoadPct' | 'imbalancePct' | 'voltageTolPct' | 'minPf', string>
const FIELDS: Array<keyof Draft> = ['warnLoadPct', 'critLoadPct', 'imbalancePct', 'voltageTolPct', 'minPf']

function validate(d: Draft): string | null {
  const [warn, crit, imb, tol, pf] = FIELDS.map((f) => Number(d[f]))
  if ([warn, crit, imb, tol, pf].some((n) => !Number.isFinite(n))) return 'Enter numbers only.'
  if (warn < 30 || warn > 110) return 'Warning must be 30–110%.'
  if (crit <= warn || crit > 130) return 'Critical must be above warning (max 130%).'
  if (imb < 3 || imb > 50) return 'Imbalance must be 3–50%.'
  if (tol < 2 || tol > 20) return 'Voltage band must be 2–20%.'
  if (pf < 0.7 || pf > 0.99) return 'Minimum power factor must be 0.70–0.99.'
  return null
}

function ThresholdRow({ smdb, focus }: { smdb: Smdb; focus: boolean }) {
  const { thresholds } = useAppState()
  const dispatch = useAppDispatch()
  const toast = useToast()
  const sim = useSimulator()
  const current: SmdbThresholds = thresholds[smdb.id] ?? DEFAULT_THRESHOLDS
  const toDraft = (t: SmdbThresholds): Draft => ({
    warnLoadPct: String(t.warnLoadPct),
    critLoadPct: String(t.critLoadPct),
    imbalancePct: String(t.imbalancePct),
    voltageTolPct: String(t.voltageTolPct),
    minPf: String(t.minPf),
  })
  const [editing, setEditing] = useState(focus)
  const [draft, setDraft] = useState<Draft>(() => toDraft(current))
  const [error, setError] = useState<string | null>(null)
  const rowRef = useRef<HTMLTableRowElement>(null)
  const isDefault = FIELDS.every((f) => current[f] === DEFAULT_THRESHOLDS[f])

  // Opened from an SMDB page ("Edit thresholds"): scroll this row into view.
  useEffect(() => {
    if (focus) rowRef.current?.scrollIntoView({ block: 'center' })
  }, [focus])

  const save = () => {
    const problem = validate(draft)
    setError(problem)
    if (problem) return
    dispatch(
      actions.setThresholds(smdb.id, {
        ...current,
        warnLoadPct: Number(draft.warnLoadPct),
        critLoadPct: Number(draft.critLoadPct),
        imbalancePct: Number(draft.imbalancePct),
        voltageTolPct: Number(draft.voltageTolPct),
        minPf: Number(draft.minPf),
      }),
    )
    setEditing(false)
    toast.show(`Thresholds saved for ${smdb.name}`)
  }

  const resetDefaults = () => {
    dispatch(actions.setThresholds(smdb.id, { ...DEFAULT_THRESHOLDS }))
    setDraft(toDraft(DEFAULT_THRESHOLDS))
    setEditing(false)
    setError(null)
    toast.show(`${smdb.name} back to default thresholds`, 'info')
  }

  return (
    <tr ref={rowRef} className={clsx(editing && 'bg-teal-50/50', focus && 'ring-2 ring-teal-400 ring-inset')}>
      <td className="px-5 py-3">
        <Link to={`/smdb/${smdb.id}`} className="font-medium text-navy-900 hover:text-teal-700">
          {smdb.name}
        </Link>
        <p className="text-xs text-navy-400">
          {getSite(smdb.siteId)?.shortName} · {smdb.ratedCurrentA} A{!isDefault && ' · custom'}
        </p>
        {error && <p className="mt-1 text-xs font-medium text-red-700">{error}</p>}
      </td>
      <td className="px-3 py-3">
        <SmdbStatusBadge status={sim.health[smdb.id]?.status ?? 'normal'} />
        <p className="mt-0.5 text-xs text-navy-400 tabular-nums">
          {Math.round(sim.health[smdb.id]?.loadPct ?? 0)}% load · PF {sim.readings[smdb.id]?.pf.toFixed(2)}
        </p>
      </td>
      {FIELDS.map((field) => (
        <td key={field} className="px-3 py-3">
          {editing ? (
            <input
              type="number"
              inputMode="decimal"
              aria-label={`${smdb.name} ${field}`}
              value={draft[field]}
              onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              step={field === 'minPf' ? 0.01 : 1}
              className={clsx(inputClass, 'w-20 py-1')}
            />
          ) : (
            <span className={clsx('tabular-nums', current[field] !== DEFAULT_THRESHOLDS[field] && 'font-semibold text-teal-700')}>{current[field]}</span>
          )}
        </td>
      ))}
      <td className="px-5 py-3 text-right whitespace-nowrap">
        {editing ? (
          <span className="inline-flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => { setEditing(false); setDraft(toDraft(current)); setError(null) }}>
              Cancel
            </Button>
            <Button size="sm" variant="teal" onClick={save}>
              Save
            </Button>
          </span>
        ) : (
          <span className="inline-flex gap-2">
            {!isDefault && (
              <Button size="sm" variant="ghost" onClick={resetDefaults}>
                Defaults
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => { setDraft(toDraft(current)); setEditing(true) }}>
              <Pencil className="size-3.5" aria-hidden />
              Edit
            </Button>
          </span>
        )}
      </td>
    </tr>
  )
}
