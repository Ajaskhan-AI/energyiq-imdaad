import clsx from 'clsx'
import { format } from 'date-fns'
import { Activity, BellRing, Check, CheckCheck, ClipboardList, MessageSquare, Radio, Siren, Zap } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { getAsset } from '../../data/assets'
import { getBuilding } from '../../data/sites'
import { getSmdb } from '../../data/smdbs'
import { actorFromUser } from '../../lib/actor'
import { workOrderFromAlert } from '../../lib/workOrders'
import { formatAgo } from '../../lib/format'
import { alertPermissions } from '../../lib/smdb'
import { actions } from '../../store/actions'
import { useAppDispatch, useAppState } from '../../store/hooks'
import type { Alert } from '../../types'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { inputClass } from '../ui/styles'
import { useToast } from '../ui/toastContext'

/** One alert with its actions: acknowledge, add a note, create / open the work order. */
export function AlertCard({ alert, compact = false }: { alert: Alert; compact?: boolean }) {
  const { counters } = useAppState()
  const user = useCurrentUser()
  const dispatch = useAppDispatch()
  const toast = useToast()
  const navigate = useNavigate()
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')

  const perms = alertPermissions(user, alert)
  const smdb = alert.smdbId ? getSmdb(alert.smdbId) : undefined
  const asset = alert.assetId ? getAsset(alert.assetId) : undefined
  const building = getBuilding(alert.buildingId)
  const active = !alert.resolvedAt
  const critical = alert.severity === 'critical'
  const Icon = alert.source === 'predictive' ? Activity : alert.source === 'device' ? Radio : critical ? Siren : Zap
  const equipmentLink = smdb ? `/smdb/${smdb.id}` : asset ? `/assets/${asset.id}` : alert.nodeId ? '/devices' : undefined
  const equipmentName = smdb?.name ?? asset?.name ?? (alert.nodeId ? `Node ${alert.nodeId}` : undefined)

  const acknowledge = () => {
    if (!user) return
    dispatch(actions.acknowledgeAlert(alert.id, actorFromUser(user)))
    toast.show(`Alert ${alert.id} acknowledged`, 'info')
  }
  const saveNote = () => {
    if (!user || !note.trim()) return
    dispatch(actions.addAlertNote(alert.id, note, actorFromUser(user)))
    setNote('')
    setNoteOpen(false)
  }
  const createWorkOrder = () => {
    if (!user) return
    const id = `WO-${counters.workOrder}`
    dispatch(actions.createWorkOrder(workOrderFromAlert(alert, id, actorFromUser(user))))
    toast.show(`Work order ${id} created from ${alert.id}`)
    navigate(`/work-orders/${id}`)
  }

  return (
    <article
      className={clsx(
        'rounded-xl border bg-white p-4 shadow-sm',
        active ? (critical ? 'border-red-200 border-l-4 border-l-red-500' : 'border-amber-200 border-l-4 border-l-amber-500') : 'border-navy-100 opacity-90',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={clsx(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            !active ? 'bg-navy-50 text-navy-500' : critical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-semibold text-navy-900">{alert.title}</p>
            <Badge tone={critical ? 'alert' : 'warn'}>{critical ? 'Critical' : 'Warning'}</Badge>
            {active ? <Badge tone="alert">Active</Badge> : <Badge tone="ok">Resolved</Badge>}
            {alert.acknowledged && <Badge tone="info">Acknowledged</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-navy-600">
            {equipmentLink ? (
              <Link to={equipmentLink} className="font-medium text-teal-700 hover:underline">
                {equipmentName}
              </Link>
            ) : null}
            {equipmentLink && ' · '}
            {building?.name} · {alert.id} · {formatAgo(alert.createdAt)}
          </p>
          {!compact && <p className="mt-1 text-sm text-navy-700">{alert.message}</p>}

          {!compact && (alert.acknowledged || alert.notes.length > 0 || alert.resolvedAt) && (
            <ul className="mt-2 space-y-1 text-xs text-navy-500">
              {alert.acknowledged && (
                <li className="flex items-center gap-1">
                  <CheckCheck className="size-3.5" aria-hidden />
                  Acknowledged by {alert.acknowledged.by.name} · {format(new Date(alert.acknowledged.at), 'd MMM HH:mm')}
                </li>
              )}
              {alert.notes.map((n, i) => (
                <li key={i} className="flex items-start gap-1">
                  <MessageSquare className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span>
                    <span className="font-medium text-navy-700">{n.by.name}:</span> {n.text} · {format(new Date(n.at), 'd MMM HH:mm')}
                  </span>
                </li>
              ))}
              {alert.resolvedAt && (
                <li className="flex items-center gap-1">
                  <Check className="size-3.5" aria-hidden />
                  Condition cleared · {format(new Date(alert.resolvedAt), 'd MMM HH:mm')}
                </li>
              )}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {perms.acknowledge && !alert.acknowledged && (
              <Button size="sm" onClick={acknowledge}>
                <BellRing className="size-4" aria-hidden />
                Acknowledge
              </Button>
            )}
            {perms.note && !compact && (
              <Button size="sm" variant="secondary" onClick={() => setNoteOpen((v) => !v)}>
                <MessageSquare className="size-4" aria-hidden />
                Add note
              </Button>
            )}
            {alert.workOrderId ? (
              <Link to={`/work-orders/${alert.workOrderId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:underline">
                <ClipboardList className="size-4" aria-hidden />
                Work order {alert.workOrderId}
              </Link>
            ) : (
              perms.workOrder && (
                <Button size="sm" variant="teal" onClick={createWorkOrder}>
                  <ClipboardList className="size-4" aria-hidden />
                  Create work order
                </Button>
              )
            )}
          </div>

          {noteOpen && (
            <div className="mt-2 flex gap-2">
              <label htmlFor={`note-${alert.id}`} className="sr-only">
                Note
              </label>
              <input
                id={`note-${alert.id}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveNote()}
                placeholder="e.g. Checked on site — chiller staging issue"
                className={inputClass}
                autoFocus
              />
              <Button size="sm" onClick={saveNote} disabled={!note.trim()}>
                Save
              </Button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
