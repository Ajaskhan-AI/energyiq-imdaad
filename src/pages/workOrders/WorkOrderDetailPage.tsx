import { format } from 'date-fns'
import { ArrowLeft, CheckCheck, ClipboardList, FileDown, MapPin, MessageSquare, Play, Send } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { can } from '../../auth/permissions'
import { ROLE_LABELS } from '../../auth/roles'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field } from '../../components/ui/Field'
import { inputClass } from '../../components/ui/styles'
import { useToast } from '../../components/ui/toastContext'
import { getAsset } from '../../data/assets'
import { getBuilding, getSite } from '../../data/sites'
import { getSmdb } from '../../data/smdbs'
import { actorFromUser } from '../../lib/actor'
import { formatDuration } from '../../lib/format'
import { canSeeSite } from '../../lib/scope'
import { WO_PRIORITY_LABELS, WO_PRIORITY_TONE, WO_SOURCE_LABELS, WO_STATUS_LABELS, WO_STATUS_TONE, workOrderAgeHours } from '../../lib/workOrders'
import { downloadWorkOrderPdf } from '../../pdf/workOrderPdf'
import { actions } from '../../store/actions'
import { useAppDispatch, useAppState } from '../../store/hooks'
import AccessRestrictedPage from '../AccessRestrictedPage'

/** One work order: details, links back to the insight, history and actions. */
export default function WorkOrderDetailPage() {
  const { workOrderId } = useParams()
  const { workOrders } = useAppState()
  const user = useCurrentUser()
  const dispatch = useAppDispatch()
  const toast = useToast()
  const [remark, setRemark] = useState('')
  const [note, setNote] = useState('')
  const [closing, setClosing] = useState(false)

  const wo = workOrders.find((w) => w.id === workOrderId)
  if (!user) return null
  if (!wo) {
    return (
      <EmptyState icon={ClipboardList} title={`Work order ${workOrderId} not found`}>
        <Link to="/work-orders" className="text-teal-700 underline">
          Back to work orders
        </Link>
      </EmptyState>
    )
  }
  if (!canSeeSite(user, wo.siteId)) return <AccessRestrictedPage />

  const site = getSite(wo.siteId)
  const smdb = wo.smdbId ? getSmdb(wo.smdbId) : undefined
  const asset = wo.assetId ? getAsset(wo.assetId) : undefined
  const canUpdate = can(user, 'workorders.update')
  const canSend = can(user, 'smdb.createWorkOrder')
  const actor = actorFromUser(user)

  const sendToCafm = () => {
    dispatch(actions.sendToCafm(wo.id, actor))
    toast.show(`${wo.id} sent to CAFM (simulated)`)
  }
  const start = () => {
    dispatch(actions.startWorkOrder(wo.id, actor))
    toast.show(`${wo.id} marked as in progress`, 'info')
  }
  const close = () => {
    if (!remark.trim()) return
    dispatch(actions.closeWorkOrder(wo.id, remark, actor))
    setClosing(false)
    setRemark('')
    toast.show(`${wo.id} closed`)
  }
  const addNote = () => {
    if (!note.trim()) return
    dispatch(actions.addWorkOrderNote(wo.id, note, actor))
    setNote('')
  }

  return (
    <>
      <Link to="/work-orders" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-navy-800">
        <ArrowLeft className="size-4" aria-hidden />
        All work orders
      </Link>

      <div className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm font-semibold text-teal-700">{wo.id}</p>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">{wo.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={WO_STATUS_TONE[wo.status]}>{WO_STATUS_LABELS[wo.status]}</Badge>
            <Badge tone={WO_PRIORITY_TONE[wo.priority]}>{WO_PRIORITY_LABELS[wo.priority]} priority</Badge>
            <Badge tone="neutral">From {WO_SOURCE_LABELS[wo.source]}</Badge>
            {wo.cafmRef && <Badge tone="info">CAFM {wo.cafmRef}</Badge>}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-navy-600">
            <MapPin className="size-4" aria-hidden />
            {site?.name} · {getBuilding(wo.buildingId)?.shortName}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            const file = downloadWorkOrderPdf(wo)
            toast.show(`Downloaded ${file}`)
          }}
        >
          <FileDown className="size-4" aria-hidden />
          Download PDF
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Description">
            <p className="whitespace-pre-line text-navy-800">{wo.description}</p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {smdb && (
                <div>
                  <dt className="text-navy-500">SMDB</dt>
                  <dd>
                    <Link to={`/smdb/${smdb.id}`} className="font-medium text-teal-700 hover:underline">
                      {smdb.name}
                    </Link>{' '}
                    <span className="text-navy-500">· meter {smdb.meterId}</span>
                  </dd>
                </div>
              )}
              {asset && (
                <div>
                  <dt className="text-navy-500">Asset</dt>
                  <dd>
                    <Link to={`/assets/${asset.id}`} className="font-medium text-teal-700 hover:underline">
                      {asset.name}
                    </Link>{' '}
                    <span className="text-navy-500">· {asset.id}</span>
                  </dd>
                </div>
              )}
              {wo.alertId && (
                <div>
                  <dt className="text-navy-500">Raised from alert</dt>
                  <dd>
                    <Link to="/smdb/alerts" className="font-medium text-teal-700 hover:underline">
                      {wo.alertId}
                    </Link>
                  </dd>
                </div>
              )}
              {wo.wasteFlagId && (
                <div>
                  <dt className="text-navy-500">Raised from</dt>
                  <dd>
                    <Link to="/energy?tab=waste" className="font-medium text-teal-700 hover:underline">
                      Energy waste pattern
                    </Link>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-navy-500">{wo.closedAt ? 'Time to close' : 'Open for'}</dt>
                <dd className="font-medium text-navy-900">{formatDuration(workOrderAgeHours(wo) * 3_600_000)}</dd>
              </div>
              {wo.closeRemark && (
                <div className="sm:col-span-2">
                  <dt className="text-navy-500">Closing remark</dt>
                  <dd className="font-medium text-navy-900">{wo.closeRemark}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card title="History" subtitle="Every action, with who did it and when">
            <ol className="space-y-3">
              {[...wo.history].reverse().map((e, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-teal-500" />
                  <span>
                    <span className="font-medium text-navy-900">{e.text}</span>
                    <span className="block text-xs text-navy-500">
                      {e.by.name} · {e.by.role === 'system' ? 'System' : ROLE_LABELS[e.by.role]} · {format(new Date(e.at), 'd MMM yyyy, HH:mm')}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            {canUpdate && wo.status !== 'closed' && (
              <div className="mt-4 flex gap-2">
                <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()} placeholder="Add a note…" aria-label="Note" className={inputClass} />
                <Button variant="secondary" onClick={addNote} disabled={!note.trim()}>
                  <MessageSquare className="size-4" aria-hidden />
                  Add
                </Button>
              </div>
            )}
          </Card>
        </div>

        <Card title="Actions">
          <div className="space-y-3">
            {!wo.cafmRef && canSend && wo.status !== 'closed' && (
              <Button variant="teal" className="w-full" onClick={sendToCafm}>
                <Send className="size-4" aria-hidden />
                Send to CAFM
              </Button>
            )}
            {canUpdate && wo.status === 'open' && (
              <Button className="w-full" onClick={start}>
                <Play className="size-4" aria-hidden />
                Start work
              </Button>
            )}
            {canUpdate && wo.status !== 'closed' && !closing && (
              <Button variant="secondary" className="w-full" onClick={() => setClosing(true)}>
                <CheckCheck className="size-4" aria-hidden />
                Close work order
              </Button>
            )}
            {closing && (
              <div className="space-y-2">
                <Field label="Closing remark" htmlFor="wo-remark" required>
                  <textarea id="wo-remark" rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="What was found and done" className={inputClass} />
                </Field>
                <div className="flex gap-2">
                  <Button variant="teal" onClick={close} disabled={!remark.trim()}>
                    Close
                  </Button>
                  <Button variant="ghost" onClick={() => setClosing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {wo.status === 'closed' && <p className="text-sm text-navy-600">Closed on {format(new Date(wo.closedAt ?? wo.createdAt), 'd MMM yyyy, HH:mm')}.</p>}
            {!canUpdate && !canSend && <p className="text-sm text-navy-500">View only for your role.</p>}
            <p className="text-xs text-navy-500">“Send to CAFM” is simulated in the demo: it records a reference number. In a pilot it would call the CAFM system’s API.</p>
          </div>
        </Card>
      </div>
    </>
  )
}
