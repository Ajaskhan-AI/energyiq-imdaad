import clsx from 'clsx'
import { format } from 'date-fns'
import { ArrowLeft, CircleCheck, ClipboardList, HeartPulse, Lightbulb, MapPin, ShieldCheck, Stethoscope, Timer, Zap } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { can } from '../../auth/permissions'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { ASSET_ICONS } from '../../components/assetIcons'
import { CurrentBandChart, HealthBadge, HealthTrendChart, SpectrumChart } from '../../components/predictive/PredictiveCharts'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/toastContext'
import { getAsset } from '../../data/assets'
import { getBuilding, getSite } from '../../data/sites'
import { getSmdb } from '../../data/smdbs'
import { actorFromUser } from '../../lib/actor'
import { canSeeSite } from '../../lib/scope'
import { predictiveWorkOrder } from '../../lib/workOrders'
import { usePredictive } from '../../sim/usePredictive'
import { actions } from '../../store/actions'
import { useAppDispatch, useAppState } from '../../store/hooks'
import AccessRestrictedPage from '../AccessRestrictedPage'

/** One monitored asset: diagnosis, recommended action and the signals behind it. */
export default function AssetDetailPage() {
  const { assetId } = useParams()
  const state = useAppState()
  const user = useCurrentUser()
  const dispatch = useAppDispatch()
  const toast = useToast()
  const navigate = useNavigate()
  const assessments = usePredictive()

  const asset = getAsset(assetId ?? '')
  const a = assessments.find((x) => x.assetId === assetId)
  if (!user) return null
  if (!asset || !a) {
    return (
      <EmptyState icon={HeartPulse} title={`${assetId} is not a monitored asset`}>
        <Link to="/assets" className="text-teal-700 underline">
          Back to Asset health
        </Link>
      </EmptyState>
    )
  }
  if (!canSeeSite(user, asset.siteId)) return <AccessRestrictedPage />

  const canAct = can(user, 'assets.act')
  const canWorkOrder = can(user, 'smdb.createWorkOrder')
  const Icon = ASSET_ICONS[asset.category]
  const building = getBuilding(asset.buildingId)
  const site = getSite(asset.siteId)
  const feeder = asset.smdbId ? getSmdb(asset.smdbId) : undefined
  const reset = state.predictiveResets[asset.id]
  const openWorkOrder = state.workOrders.find((w) => w.assetId === asset.id && w.source === 'predictive' && w.status !== 'closed')
  const openAlert = state.alerts.find((x) => x.assetId === asset.id && x.source === 'predictive' && x.code === 'health' && !x.resolvedAt)

  const createWorkOrder = () => {
    const id = `WO-${state.counters.workOrder}`
    dispatch(actions.createWorkOrder(predictiveWorkOrder(asset, a, id, actorFromUser(user), openAlert?.id)))
    toast.show(`Work order ${id} created`)
    navigate(`/work-orders/${id}`)
  }
  const resolve = () => {
    if (!window.confirm(`Mark ${asset.name} as resolved? Its health score resets and monitoring starts fresh.`)) return
    dispatch(actions.resolvePredictive(asset.id, actorFromUser(user)))
    toast.show(`${asset.name} marked as resolved — health reset`)
  }

  const statusPanel =
    a.status === 'alert'
      ? 'border-red-200 bg-red-50'
      : a.status === 'watch'
        ? 'border-amber-200 bg-amber-50'
        : 'border-green-200 bg-green-50'

  return (
    <>
      <Link to="/assets" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-navy-800">
        <ArrowLeft className="size-4" aria-hidden />
        All monitored assets
      </Link>

      <div className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-navy-800 text-white">
            <Icon className="size-7" aria-hidden />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">{asset.name}</h1>
              <HealthBadge status={a.status} />
            </div>
            <p className="font-mono text-sm font-semibold text-teal-700">{asset.id}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-navy-600">
              <MapPin className="size-4" aria-hidden />
              {site?.name} · {building?.shortName} · {asset.location} · {asset.description}
            </p>
          </div>
        </div>
        {feeder && (
          <Link to={`/smdb/${feeder.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:underline">
            <Zap className="size-4" aria-hidden />
            Fed from {feeder.name}
          </Link>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Diagnosis */}
        <section className={clsx('rounded-xl border p-5 xl:col-span-2', statusPanel)}>
          <div className="flex flex-wrap items-start gap-6">
            <div className="text-center">
              <p className="text-xs font-semibold tracking-wide text-navy-500 uppercase">Health score</p>
              <p className={clsx('text-5xl font-bold tabular-nums', a.status === 'alert' ? 'text-red-700' : a.status === 'watch' ? 'text-amber-700' : 'text-green-700')}>
                {a.health}
              </p>
              <p className="text-sm text-navy-500">out of 100</p>
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              {a.issue ? (
                <>
                  <p className="flex items-start gap-2">
                    <Stethoscope className="mt-0.5 size-5 shrink-0 text-navy-700" aria-hidden />
                    <span>
                      <span className="block text-lg font-semibold text-navy-900">{a.issue.title}</span>
                      <span className="text-navy-700">{a.issue.detail}</span>
                    </span>
                  </p>
                  <p className="flex items-start gap-2">
                    <Lightbulb className="mt-0.5 size-5 shrink-0 text-navy-700" aria-hidden />
                    <span>
                      <span className="font-semibold text-navy-900">Recommended action: </span>
                      <span className="text-navy-700">{a.issue.action}</span>
                    </span>
                  </p>
                  {a.daysToAction !== null && (
                    <p className="flex items-center gap-2 font-semibold text-navy-900">
                      <Timer className="size-5 shrink-0" aria-hidden />
                      {a.status === 'watch'
                        ? `Estimated ≈ ${a.daysToAction} days before it reaches Alert`
                        : `Act within ≈ ${a.daysToAction} days — risk of breakdown after that`}
                    </p>
                  )}
                </>
              ) : (
                <p className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-green-700" aria-hidden />
                  <span>
                    <span className="block text-lg font-semibold text-navy-900">Running normally</span>
                    <span className="text-navy-700">Current, ripple and spectrum are within the normal band. No action needed.</span>
                  </span>
                </p>
              )}
              {reset && (
                <p className="text-sm text-navy-600">
                  <CircleCheck className="mr-1 inline size-4 text-teal-600" aria-hidden />
                  Marked resolved by {reset.by.name} on {format(new Date(reset.at), 'd MMM yyyy, HH:mm')}.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Actions + signals */}
        <div className="space-y-6">
          {(canAct || canWorkOrder) && (
            <Card title="Actions">
              <div className="space-y-3">
                {openWorkOrder ? (
                  <Link to={`/work-orders/${openWorkOrder.id}`} className="flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800 hover:underline">
                    <ClipboardList className="size-4" aria-hidden />
                    Work order {openWorkOrder.id} is open
                  </Link>
                ) : (
                  canWorkOrder && (
                    <Button variant="teal" className="w-full" onClick={createWorkOrder}>
                      <ClipboardList className="size-4" aria-hidden />
                      Create work order
                    </Button>
                  )
                )}
                {canAct && (
                <Button variant="secondary" className="w-full" onClick={resolve} disabled={a.status === 'ok'}>
                  <ShieldCheck className="size-4" aria-hidden />
                  Mark as resolved
                </Button>
                )}
                {canAct && a.status === 'ok' && <p className="text-xs text-navy-500">Nothing to resolve — the asset is healthy.</p>}
              </div>
            </Card>
          )}

          <Card title="Signals today">
            <dl className="space-y-2 text-sm">
              {[
                ['Motor current', `${a.currentA} A`],
                ['Normal band', `${a.band[0]}–${a.band[1]} A`],
                ['Deviation from normal', `${a.deviationPct > 0 ? '+' : ''}${a.deviationPct}%`],
                ['Current ripple', `${a.ripplePct}% (normal < 2.5%)`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-navy-500">{label}</dt>
                  <dd className="font-semibold tabular-nums text-navy-900">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-navy-500">Source: CT clamps on the motor supply, sampled by the Kuroshio IoT node. Simulated for the demo.</p>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Health trend" subtitle="Last 60 days · green OK ≥ 80 · amber Watch 60–79 · red Alert < 60">
          <HealthTrendChart points={a.history} resetAt={reset?.at} />
        </Card>
        <Card title="Motor current vs normal band" subtitle="Daily average running current">
          <CurrentBandChart points={a.history} band={a.band} />
        </Card>
        <Card title="Current signature" subtitle="Side-bands and harmonics as % of the 50 Hz fundamental — red bars are fault indicators" className="xl:col-span-2">
          <SpectrumChart bins={a.spectrum} />
        </Card>
      </div>
    </>
  )
}
