import { differenceInCalendarDays, format } from 'date-fns'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { can } from '../../auth/permissions'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useToast } from '../../components/ui/toastContext'
import { getSite } from '../../data/sites'
import { DAY_TYPE_COLORS, PERIOD_TYPE_LABELS } from '../../lib/calendar'
import { fromISODate } from '../../lib/dates'
import { allowedSiteIds } from '../../lib/scope'
import { actions } from '../../store/actions'
import { useAppDispatch, useAppState } from '../../store/hooks'
import type { CalendarPeriod } from '../../types'
import { PeriodModal } from './PeriodModal'

/** The operating calendar that drives the analysis. Editing it recalculates every flag. */
export function CalendarTab({ patternCount }: { patternCount: number }) {
  const { calendar } = useAppState()
  const user = useCurrentUser()
  const dispatch = useAppDispatch()
  const toast = useToast()
  const canEdit = can(user, 'energy.edit')
  const [editing, setEditing] = useState<CalendarPeriod | 'new' | null>(null)

  const allowed = new Set(allowedSiteIds(user))
  const nextId = `cal-u${calendar.reduce((max, p) => Math.max(max, Number(p.id.replace(/\D/g, '')) || 0), 0) + 1}`
  const sorted = [...calendar].filter((p) => !p.siteId || allowed.has(p.siteId)).sort((a, b) => a.start.localeCompare(b.start))

  const save = (period: CalendarPeriod) => {
    dispatch(actions.savePeriod(period))
    setEditing(null)
    toast.show(`“${period.name}” saved — analysis recalculated`)
  }
  const remove = (period: CalendarPeriod) => {
    if (!window.confirm(`Delete “${period.name}”? The analysis will recalculate.`)) return
    dispatch(actions.deletePeriod(period.id))
    toast.show(`“${period.name}” deleted — analysis recalculated`, 'info')
  }

  return (
    <Card
      title="Operating calendar"
      subtitle={`UAE public holidays, Ramadan hours, planned shutdowns and events. Islamic dates are approximate. Currently ${patternCount} waste patterns across the portfolio over 12 months. Meter data never changes: only the analysis does.`}
      actions={
        canEdit && (
          <Button variant="teal" size="sm" onClick={() => setEditing('new')}>
            <Plus className="size-4" aria-hidden />
            Add period
          </Button>
        )
      }
      flush
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-navy-50/60 text-xs font-semibold tracking-wide text-navy-500 uppercase">
            <tr>
              <th className="px-5 py-3">Period</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Applies to</th>
              <th className="px-3 py-3">Start</th>
              <th className="px-3 py-3">End</th>
              <th className="px-3 py-3 text-right">Days</th>
              {canEdit && <th className="px-5 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-50">
            {sorted.map((p) => (
              <tr key={p.id}>
                <td className="px-5 py-2.5 font-medium text-navy-900">{p.name}</td>
                <td className="px-3 py-2.5">
                  <span className="rounded px-2 py-0.5 text-xs font-medium text-navy-800" style={{ background: DAY_TYPE_COLORS[p.type] }}>
                    {PERIOD_TYPE_LABELS[p.type]}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-navy-600">{p.siteId ? getSite(p.siteId)?.shortName : 'All sites'}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{format(fromISODate(p.start), 'EEE d MMM yyyy')}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{format(fromISODate(p.end), 'EEE d MMM yyyy')}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{differenceInCalendarDays(fromISODate(p.end), fromISODate(p.start)) + 1}</td>
                {canEdit && (
                  <td className="px-5 py-2.5 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}>
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(p)} aria-label={`Delete ${p.name}`}>
                      <Trash2 className="size-4 text-red-600" aria-hidden />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-5 py-3 text-sm text-navy-500">
        Weekends (Sat–Sun) are applied automatically to sites that close at weekends.
        {!canEdit && ' The calendar is maintained by the Energy & MEP Engineer.'}
      </p>
      {editing && <PeriodModal period={editing === 'new' ? undefined : editing} nextId={nextId} onSave={save} onClose={() => setEditing(null)} />}
    </Card>
  )
}
