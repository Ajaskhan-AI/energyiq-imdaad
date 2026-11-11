import clsx from 'clsx'
import { ArrowLeft, BellOff } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { can } from '../../auth/permissions'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { AlertCard } from '../../components/alerts/AlertCard'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { inputClass } from '../../components/ui/styles'
import { filterBySite } from '../../lib/scope'
import { visibleSmdbs } from '../../lib/smdb'
import { useAppState } from '../../store/hooks'
import type { Alert } from '../../types'

type Tab = 'active' | 'unacknowledged' | 'resolved' | 'all'
const TABS: Array<{ id: Tab; label: string; match: (a: Alert) => boolean }> = [
  { id: 'active', label: 'Active', match: (a) => !a.resolvedAt },
  { id: 'unacknowledged', label: 'Not acknowledged', match: (a) => !a.acknowledged },
  { id: 'resolved', label: 'Resolved', match: (a) => !!a.resolvedAt },
  { id: 'all', label: 'All', match: () => true },
]

/** Alerts center: every alert raised from the live data, with acknowledge / note / work order. */
export default function AlertsPage() {
  const state = useAppState()
  const user = useCurrentUser()
  const [tab, setTab] = useState<Tab>('active')
  const [source, setSource] = useState<'all' | Alert['source']>('all')

  const boardIds = new Set(visibleSmdbs(user, state.site).map((s) => s.id))
  const canAssets = can(user, 'assets.view')
  const canDevices = can(user, 'devices.view')
  const scoped = filterBySite(state.alerts, user, state.site).filter((a) =>
    a.smdbId ? boardIds.has(a.smdbId) : a.source === 'predictive' ? canAssets : a.source === 'device' ? canDevices : true,
  )
  const bySource = scoped.filter((a) => source === 'all' || a.source === source)
  const match = TABS.find((t) => t.id === tab)?.match ?? (() => true)
  // Active tab: critical first. Always: newest first.
  const visible = bySource
    .filter(match)
    .sort(
      (a, b) =>
        (tab === 'active' ? Number(b.severity === 'critical') - Number(a.severity === 'critical') : 0) ||
        b.createdAt.localeCompare(a.createdAt),
    )

  return (
    <>
      <Link to="/smdb" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-navy-800">
        <ArrowLeft className="size-4" aria-hidden />
        SMDB monitoring
      </Link>
      <div className="mt-3">
        <PageHeader
          title="Alerts center"
          description="Alerts are raised automatically from the live readings and clear themselves when the condition is gone. Acknowledge them, add notes, or turn them into work orders."
        />
      </div>

      <Card flush>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-100 px-5 py-4">
          <div role="tablist" aria-label="Alert filter" className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={clsx('rounded-lg px-3 py-1.5 text-sm font-medium', tab === t.id ? 'bg-navy-800 text-white' : 'text-navy-600 hover:bg-navy-50')}
              >
                {t.label} <span className="ml-1 opacity-70">{bySource.filter(t.match).length}</span>
              </button>
            ))}
          </div>
          <select aria-label="Source" value={source} onChange={(e) => setSource(e.target.value as typeof source)} className={clsx(inputClass, 'w-auto')}>
            <option value="all">All sources</option>
            <option value="smdb">SMDB monitoring</option>
            <option value="predictive">Asset health</option>
            <option value="device">IoT devices</option>
          </select>
        </div>
        <div className="space-y-3 p-5">
          {visible.length === 0 ? (
            <EmptyState icon={BellOff} title="No alerts here" />
          ) : (
            visible.map((a) => <AlertCard key={a.id} alert={a} />)
          )}
        </div>
      </Card>
    </>
  )
}
