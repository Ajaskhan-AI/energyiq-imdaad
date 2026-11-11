import clsx from 'clsx'
import { formatDistanceToNowStrict } from 'date-fns'
import { CloudUpload, Database, Power, Radio, RotateCcw, Signal, WifiOff } from 'lucide-react'
import { Link } from 'react-router'
import { can } from '../../auth/permissions'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { LiveIndicator } from '../../components/smdb/SmdbBits'
import { Badge, type Tone } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { KpiCard } from '../../components/ui/KpiCard'
import { PageHeader } from '../../components/ui/PageHeader'
import { useToast } from '../../components/ui/toastContext'
import { getBuilding, getSite } from '../../data/sites'
import { getSmdb, LATEST_FIRMWARE } from '../../data/smdbs'
import { scopedSiteIds } from '../../lib/scope'
import { NODE_STATUS_LABELS } from '../../sim/deviceModel'
import { useSimulator } from '../../sim/simulatorContext'
import { useAppState } from '../../store/hooks'
import type { NodeStatus } from '../../types'

const STATUS_TONE: Record<NodeStatus, Tone> = { online: 'ok', weak: 'warn', offline: 'alert' }

/** Signal bars from RSSI (dBm). */
function SignalBars({ rssi }: { rssi: number }) {
  const bars = rssi > -80 ? 4 : rssi > -90 ? 3 : rssi > -100 ? 2 : 1
  return (
    <span className="inline-flex items-end gap-0.5" aria-label={`${rssi} dBm`}>
      {[1, 2, 3, 4].map((b) => (
        <span key={b} className={clsx('w-1 rounded-sm', b <= bars ? (bars <= 1 ? 'bg-red-500' : bars === 2 ? 'bg-amber-500' : 'bg-teal-600') : 'bg-navy-100')} style={{ height: 4 + b * 3 }} />
      ))}
    </span>
  )
}

/** Health of the Kuroshio IoT nodes that read the SMDB meters. */
export default function DevicesPage() {
  const { site } = useAppState()
  const user = useCurrentUser()
  const sim = useSimulator()
  const toast = useToast()
  const canManage = can(user, 'devices.manage')

  const ids = scopedSiteIds(user, site)
  const nodes = sim.nodes.filter((n) => ids.has(n.node.siteId)).sort((a, b) => ['offline', 'weak', 'online'].indexOf(a.status) - ['offline', 'weak', 'online'].indexOf(b.status))
  const count = (s: NodeStatus) => nodes.filter((n) => n.status === s).length
  const meters = nodes.reduce((s, n) => s + n.node.smdbIds.length, 0)
  const completeness = nodes.length ? nodes.reduce((s, n) => s + n.completenessPct, 0) / nodes.length : 0
  const outdated = nodes.filter((n) => n.node.firmware !== LATEST_FIRMWARE).length

  return (
    <>
      <PageHeader
        title="Device health"
        description="Kuroshio IoT nodes (ESP32-S3 + SIM7080G cellular) read the Selec meters over RS-485 / Modbus every minute and send the data to the cloud. If a node loses signal it buffers readings and back-fills them when it reconnects."
        actions={<LiveIndicator updatedAt={sim.updatedAt} intervalMs={sim.intervalMs} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Nodes online" value={`${count('online') + count('weak')} / ${nodes.length}`} sub={`${meters} meters connected`} icon={Radio} tone={count('offline') ? 'warn' : 'ok'} />
        <KpiCard label="Offline" value={count('offline')} sub="No data received" icon={WifiOff} tone={count('offline') ? 'alert' : 'ok'} />
        <KpiCard label="Weak signal" value={count('weak')} sub="Below −100 dBm" icon={Signal} tone={count('weak') ? 'warn' : 'ok'} />
        <KpiCard label="Data completeness (24 h)" value={`${completeness.toFixed(1)}%`} sub={`${outdated} node${outdated === 1 ? '' : 's'} on older firmware`} icon={Database} tone={completeness < 98 ? 'warn' : 'ok'} />
      </div>

      <Card className="mt-6" flush title="IoT nodes" subtitle="Offline and weak-signal nodes first">
        {nodes.length === 0 ? (
          <EmptyState icon={Radio} title="No nodes on this site" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="bg-navy-50/60 text-xs font-semibold tracking-wide text-navy-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Node</th>
                  <th className="px-3 py-3">Location</th>
                  <th className="px-3 py-3">Meters</th>
                  <th className="px-3 py-3">Signal</th>
                  <th className="px-3 py-3 text-right">Data 24 h</th>
                  <th className="px-3 py-3">Last seen</th>
                  <th className="px-3 py-3">Firmware</th>
                  {canManage && <th className="px-5 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {nodes.map((n) => (
                  <tr key={n.node.id} className={n.status === 'offline' ? 'bg-red-50/50' : undefined}>
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs font-semibold text-navy-900">{n.node.id}</span>
                      <span className="mt-1 block">
                        <Badge tone={STATUS_TONE[n.status]}>{NODE_STATUS_LABELS[n.status]}</Badge>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-navy-700">
                      {getSite(n.node.siteId)?.shortName} · {getBuilding(n.node.buildingId)?.shortName}
                      <span className="block text-xs text-navy-500">{n.node.location}</span>
                    </td>
                    <td className="px-3 py-3">
                      {n.node.smdbIds.map((id) => (
                        <Link key={id} to={`/smdb/${id}`} className="block text-xs text-teal-700 hover:underline">
                          {getSmdb(id)?.meterId} · {getSmdb(id)?.name.split('·')[1]?.trim()}
                        </Link>
                      ))}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {n.status === 'offline' ? (
                        <span className="text-navy-400">—</span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <SignalBars rssi={n.rssiDbm} />
                          <span className="text-xs text-navy-600 tabular-nums">
                            {n.rssiDbm} dBm · {n.network}
                          </span>
                        </span>
                      )}
                    </td>
                    <td className={clsx('px-3 py-3 text-right tabular-nums', n.completenessPct < 98 && 'font-semibold text-amber-700')}>{n.completenessPct.toFixed(1)}%</td>
                    <td className="px-3 py-3 whitespace-nowrap text-navy-700">
                      {formatDistanceToNowStrict(n.lastSeen)} ago
                      {n.status === 'offline' && <span className="block text-xs text-navy-500">{n.bufferedReadings.toLocaleString()} readings buffered on node</span>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs">{n.node.firmware}</span>
                      {n.node.firmware !== LATEST_FIRMWARE && <span className="block text-xs text-amber-700">Update available</span>}
                    </td>
                    {canManage && (
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        {n.status === 'offline' ? (
                          <Button
                            size="sm"
                            variant="teal"
                            onClick={() => {
                              sim.setNodeOffline(n.node.id, false)
                              toast.show(`${n.node.id} reconnected — buffered readings back-filled`)
                            }}
                          >
                            <RotateCcw className="size-4" aria-hidden />
                            Restart node
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              sim.setNodeOffline(n.node.id, true)
                              toast.show(`Simulating a comms loss on ${n.node.id}`, 'info')
                            }}
                          >
                            <Power className="size-4" aria-hidden />
                            Simulate comms loss
                          </Button>
                        )}
                        {n.node.firmware !== LATEST_FIRMWARE && (
                          <Button size="sm" variant="ghost" onClick={() => toast.show(`Over-the-air update to ${LATEST_FIRMWARE} scheduled for ${n.node.id} tonight at 02:00 (simulated)`, 'info')}>
                            <CloudUpload className="size-4" aria-hidden />
                            Update
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-3 text-xs text-navy-500">Signal, uptime and completeness values are simulated for the demo.</p>
    </>
  )
}
