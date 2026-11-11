import { format } from 'date-fns'
import { CheckCheck, ClipboardList, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { can } from '../../auth/permissions'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { HourlyChart } from '../../components/energy/EnergyCharts'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/toastContext'
import { smdbHourly } from '../../data/energy'
import { getBuilding, getSite } from '../../data/sites'
import { getSmdb } from '../../data/smdbs'
import { actorFromUser } from '../../lib/actor'
import { DAY_TYPE_LABELS } from '../../lib/calendar'
import { kwhToTonnesCo2 } from '../../lib/co2'
import { fromISODate } from '../../lib/dates'
import { WASTE_KIND_LABELS, type WastePattern } from '../../lib/energyAnalysis'
import { formatNumber } from '../../lib/format'
import { wasteWorkOrder } from '../../lib/workOrders'
import { isAfterHours, kwFor } from '../../sim/loadModel'
import { actions } from '../../store/actions'
import { useAppDispatch, useAppState } from '../../store/hooks'

/** One recurring pattern: what was found, the hourly evidence, and what to do. */
export function PatternModal({ pattern, onClose }: { pattern: WastePattern; onClose: () => void }) {
  const { workOrders, reviewedWasteIds, counters } = useAppState()
  const user = useCurrentUser()
  const dispatch = useAppDispatch()
  const toast = useToast()
  const navigate = useNavigate()

  const smdb = getSmdb(pattern.smdbId)
  const site = getSite(pattern.siteId)
  const building = getBuilding(pattern.buildingId)
  const recent = [...pattern.flags].sort((a, b) => b.date.localeCompare(a.date))
  const [day, setDay] = useState(recent[0]?.date ?? pattern.lastDate)
  const flag = recent.find((f) => f.date === day) ?? recent[0]

  const reviewed = reviewedWasteIds.includes(pattern.id)
  const workOrder = workOrders.find((w) => w.wasteFlagId === pattern.id)
  const canReview = can(user, 'energy.edit')
  const canWorkOrder = can(user, 'smdb.createWorkOrder')

  // Evidence: the board's hourly profile on the chosen day vs what it should look like.
  const date = fromISODate(flag.date)
  const hours = smdb ? smdbHourly(smdb, flag.date) : []
  const expected = smdb && site ? Array.from({ length: 24 }, (_, h) => kwFor(smdb, site, flag.dayType, h + 0.5, date.getMonth(), false)) : undefined
  const after = Array.from({ length: 24 }, (_, h) => (site ? isAfterHours(site, flag.dayType, h) : false))

  const toggleReviewed = () => {
    dispatch(actions.setWasteReviewed(pattern.id, !reviewed))
    toast.show(reviewed ? 'Pattern reopened' : 'Marked as reviewed', 'info')
  }
  const createWorkOrder = () => {
    if (!user) return
    const id = `WO-${counters.workOrder}`
    dispatch(actions.createWorkOrder(wasteWorkOrder(pattern, id, actorFromUser(user))))
    toast.show(`Work order ${id} created`)
    navigate(`/work-orders/${id}`)
  }

  return (
    <Modal
      title={pattern.title}
      onClose={onClose}
      footer={
        <>
          {canReview && (
            <Button variant="secondary" onClick={toggleReviewed}>
              {reviewed ? <RotateCcw className="size-4" aria-hidden /> : <CheckCheck className="size-4" aria-hidden />}
              {reviewed ? 'Reopen' : 'Mark as reviewed'}
            </Button>
          )}
          {workOrder ? (
            <Link to={`/work-orders/${workOrder.id}`} className="inline-flex items-center gap-1.5 px-2 text-sm font-semibold text-teal-700 hover:underline">
              <ClipboardList className="size-4" aria-hidden />
              Work order {workOrder.id}
            </Link>
          ) : (
            canWorkOrder && (
              <Button variant="teal" onClick={createWorkOrder}>
                <ClipboardList className="size-4" aria-hidden />
                Create work order
              </Button>
            )
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone="warn">{WASTE_KIND_LABELS[pattern.kind]}</Badge>
          {reviewed && <Badge tone="ok">Reviewed</Badge>}
        </div>
        <p className="text-sm text-navy-700">
          {site?.name} · {building?.shortName} ·{' '}
          <Link to={`/smdb/${pattern.smdbId}`} className="font-medium text-teal-700 hover:underline">
            {smdb?.name}
          </Link>{' '}
          ({smdb?.costCentre})
        </p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Days flagged', `${pattern.days} (avg +${pattern.avgExcessPct}%)`],
            ['Excess energy', `${formatNumber(pattern.excessKwh)} kWh`],
            ['Indicative cost', `AED ${formatNumber(pattern.aed)} · ${formatNumber(kwhToTonnesCo2(pattern.excessKwh), 1)} t CO₂`],
            ['Per year if not fixed', `≈ AED ${formatNumber(pattern.annualAed)}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-navy-50 p-3">
              <dt className="text-xs text-navy-500">{label}</dt>
              <dd className="font-semibold text-navy-900">{value}</dd>
            </div>
          ))}
        </dl>

        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-navy-800">
              Hourly profile · {format(date, 'EEE d MMM yyyy')} ({DAY_TYPE_LABELS[flag.dayType].toLowerCase()})
            </p>
            <select aria-label="Flagged day" value={flag.date} onChange={(e) => setDay(e.target.value)} className="rounded-md border border-navy-200 px-2 py-1 text-xs">
              {recent.slice(0, 30).map((f) => (
                <option key={f.date} value={f.date}>
                  {format(fromISODate(f.date), 'EEE d MMM')} · +{f.excessPct}%
                </option>
              ))}
            </select>
          </div>
          <HourlyChart hours={hours} expected={expected} afterHours={after} />
          <p className="mt-1 text-xs text-navy-500">Bars = metered kWh per hour (amber = outside opening hours) · dashed line = expected for this day type.</p>
        </div>
        <p className="text-sm text-navy-700">
          <span className="font-semibold">Likely causes to check: </span>
          {pattern.kind === 'low_occupancy_day'
            ? 'BMS time schedule not following the holiday / weekend calendar, a manual override left on, or plant in hand mode.'
            : 'Lighting contactors or timers not switching off after closing, ventilation or HVAC schedules running past opening hours, or tenant equipment left on.'}
        </p>
      </div>
    </Modal>
  )
}
