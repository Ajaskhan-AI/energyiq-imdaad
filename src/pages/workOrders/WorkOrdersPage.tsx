import clsx from 'clsx'
import { format } from 'date-fns'
import { CircleCheck, ClipboardList, Hourglass, Send, Wrench } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { KpiCard } from '../../components/ui/KpiCard'
import { PageHeader } from '../../components/ui/PageHeader'
import { inputClass } from '../../components/ui/styles'
import { getSite } from '../../data/sites'
import { formatDuration } from '../../lib/format'
import { filterBySite } from '../../lib/scope'
import { WO_PRIORITY_LABELS, WO_PRIORITY_TONE, WO_SOURCE_LABELS, WO_STATUS_LABELS, WO_STATUS_TONE, workOrderAgeHours } from '../../lib/workOrders'
import { useAppState } from '../../store/hooks'
import type { WorkOrderSource, WorkOrderStatus } from '../../types'

/** Work orders raised from alerts and analytics, ready to hand over to the CAFM system. */
export default function WorkOrdersPage() {
  const state = useAppState()
  const user = useCurrentUser()
  const navigate = useNavigate()
  const [status, setStatus] = useState<WorkOrderStatus | 'active' | 'all'>('active')
  const [source, setSource] = useState<WorkOrderSource | 'all'>('all')
  const [query, setQuery] = useState('')

  const scoped = filterBySite(state.workOrders, user, state.site)
  const q = query.trim().toLowerCase()
  const list = scoped
    .filter((w) => (status === 'all' ? true : status === 'active' ? w.status !== 'closed' : w.status === status))
    .filter((w) => source === 'all' || w.source === source)
    .filter((w) => !q || `${w.id} ${w.title} ${w.description} ${w.cafmRef ?? ''}`.toLowerCase().includes(q))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const open = scoped.filter((w) => w.status !== 'closed')
  const closed = scoped.filter((w) => w.closedAt)
  const avgClose = closed.length ? closed.reduce((s, w) => s + workOrderAgeHours(w), 0) / closed.length : null
  const notSent = open.filter((w) => !w.cafmRef).length

  return (
    <>
      <PageHeader
        title="Work orders"
        description="Every alert, asset-health finding and energy-waste pattern can become a work order. In a live roll-out these are pushed to Imdaad’s CAFM / helpdesk system; here they are kept in the demo."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Open" value={open.filter((w) => w.status === 'open').length} sub="Not started yet" icon={ClipboardList} tone={open.length ? 'warn' : 'ok'} />
        <KpiCard label="In progress" value={open.filter((w) => w.status === 'in_progress').length} sub="Work started on site" icon={Wrench} tone="info" />
        <KpiCard label="Average time to close" value={formatDuration(avgClose === null ? null : avgClose * 3_600_000)} sub={`${closed.length} closed`} icon={Hourglass} tone="neutral" />
        <KpiCard label="Not yet sent to CAFM" value={notSent} sub="Open work orders without a CAFM reference" icon={Send} tone={notSent ? 'warn' : 'ok'} />
      </div>

      <Card className="mt-6" flush>
        <div className="grid gap-3 border-b border-navy-100 px-5 py-4 sm:grid-cols-3">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search id, title, CAFM ref…" aria-label="Search work orders" className={inputClass} />
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputClass}>
            <option value="active">Open + in progress</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="closed">Closed</option>
            <option value="all">All statuses</option>
          </select>
          <select aria-label="Source" value={source} onChange={(e) => setSource(e.target.value as typeof source)} className={inputClass}>
            <option value="all">All sources</option>
            {(Object.keys(WO_SOURCE_LABELS) as WorkOrderSource[]).map((s) => (
              <option key={s} value={s}>
                {WO_SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        {list.length === 0 ? (
          <EmptyState icon={CircleCheck} title="No work orders match these filters" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-navy-50/60 text-xs font-semibold tracking-wide text-navy-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Work order</th>
                  <th className="px-3 py-3">Site</th>
                  <th className="px-3 py-3">Source</th>
                  <th className="px-3 py-3">Priority</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">CAFM ref</th>
                  <th className="px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {list.map((w) => (
                  <tr key={w.id} onClick={() => navigate(`/work-orders/${w.id}`)} className={clsx('cursor-pointer hover:bg-teal-50/40', w.priority === 'high' && w.status !== 'closed' && 'bg-red-50/40')}>
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs font-semibold text-teal-700">{w.id}</span>
                      <span className="block font-medium text-navy-900">{w.title}</span>
                    </td>
                    <td className="px-3 py-3 text-navy-700">{getSite(w.siteId)?.shortName}</td>
                    <td className="px-3 py-3 text-navy-700">{WO_SOURCE_LABELS[w.source]}</td>
                    <td className="px-3 py-3">
                      <Badge tone={WO_PRIORITY_TONE[w.priority]}>{WO_PRIORITY_LABELS[w.priority]}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={WO_STATUS_TONE[w.status]}>{WO_STATUS_LABELS[w.status]}</Badge>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-navy-600">{w.cafmRef ?? <span className="font-sans text-amber-700">Not sent</span>}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-navy-600">{format(new Date(w.createdAt), 'd MMM, HH:mm')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
