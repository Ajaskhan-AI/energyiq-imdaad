import { ArrowRight, Briefcase, Building2, ChartColumn, HardHat, MapPin, Radio, ShieldCheck, Zap, type LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router'
import { ROLE_HOME, ROLE_LABELS, ROLE_ORDER } from '../auth/roles'
import { Button } from '@/components/shadcn/button'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/shadcn/card'
import { BrandMark } from '../components/layout/BrandMark'
import { SampleBadge } from '../components/layout/SampleBadge'
import { getClient, getSite, SITES } from '../data/sites'
import { NODES, SMDBS } from '../data/smdbs'
import { formatNumber } from '../lib/format'
import { useSimulator } from '../sim/simulatorContext'
import { actions } from '../store/actions'
import { useAppDispatch, useAppState } from '../store/hooks'
import type { Role, User } from '../types'

/** What each role is for, shown on its login card. */
const ROLE_INFO: Record<Role, { icon: LucideIcon; blurb: string }> = {
  fm_manager: { icon: Briefcase, blurb: 'Portfolio KPIs across every client site' },
  energy_engineer: { icon: ChartColumn, blurb: 'Analytics, waste detection, power quality' },
  site_supervisor: { icon: HardHat, blurb: 'Live boards and alerts for their sites' },
  client_viewer: { icon: Building2, blurb: 'Their buildings, costs and monthly reports' },
  admin: { icon: ShieldCheck, blurb: 'IoT devices, users and demo tools' },
}

/** What a login covers, without showing a person's name: the client, or the sites. */
function scopeLabel(user: User): string {
  if (user.clientId) return getClient(user.clientId)?.name ?? 'Client'
  if (user.siteIds === 'ALL') return 'All sites'
  return user.siteIds.map((id) => getSite(id)?.shortName ?? id).join(' & ')
}

/**
 * Demo login: one card per role. Roles with several demo accounts show one
 * button per client / set of sites. There is no real authentication.
 */
export default function LoginPage() {
  const { users } = useAppState()
  const sim = useSimulator()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const roles = ROLE_ORDER.filter((r) => users.some((u) => u.role === r))
  const liveKw = SMDBS.reduce((s, b) => s + (sim.health[b.id]?.status === 'offline' ? 0 : (sim.readings[b.id]?.kW ?? 0)), 0)
  const nodesOnline = sim.nodes.filter((n) => n.status !== 'offline').length

  const signIn = (userId: string) => {
    const user = users.find((u) => u.id === userId)
    if (!user) return
    dispatch(actions.login(user.id))
    navigate(ROLE_HOME[user.role])
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* ---------- Brand panel ---------- */}
      <aside className="relative hidden overflow-hidden border-r border-navy-100 bg-white text-navy-950 lg:flex lg:flex-col">
        {/* Faint wiring-diagram grid */}
        <svg className="pointer-events-none absolute inset-0 size-full text-teal-600 opacity-[0.06]" aria-hidden>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        <div className="relative flex flex-1 flex-col justify-between p-10 xl:p-14">
          <BrandMark large showPreparedFor={false} />

          <div className="max-w-md">
            <p className="text-sm font-semibold tracking-widest text-teal-600 uppercase">Prepared for Imdaad</p>
            <h1 className="mt-3 text-4xl leading-tight font-bold tracking-tight xl:text-5xl">Every SMDB, every site, one live view.</h1>
            <p className="mt-4 text-lg text-navy-500">
              Selec energy meters and Kuroshio IoT nodes turn each distribution board into live data, then into savings you can show every client.
            </p>

            {/* Live strip: real numbers from the running simulator */}
            <div className="mt-8 rounded-2xl border border-teal-100 bg-teal-50/60 p-5">
              <div className="flex items-center gap-2 text-sm text-navy-600">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-60" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-green-600" />
                </span>
                Live across the demo portfolio
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-4">
                {[
                  { icon: Zap, label: 'Live load', value: `${formatNumber(liveKw)} kW` },
                  { icon: MapPin, label: 'Sites · boards', value: `${SITES.length} · ${SMDBS.length}` },
                  { icon: Radio, label: 'Nodes online', value: `${nodesOnline} / ${NODES.length}` },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label}>
                    <dt className="flex items-center gap-1.5 text-xs text-navy-500">
                      <Icon className="size-3.5" aria-hidden />
                      {label}
                    </dt>
                    <dd className="mt-1 text-xl font-semibold text-navy-950 tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <p className="text-xs text-navy-400">All people, clients and buildings are fictional. All figures are sample data.</p>
        </div>
      </aside>

      {/* ---------- Role logins ---------- */}
      <main className="flex flex-col bg-white">
        <div className="flex items-center justify-between gap-3 px-6 pt-6 sm:px-10">
          <div className="lg:hidden">
            <BrandMark showPreparedFor={false} />
          </div>
          <SampleBadge className="ml-auto" />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-xl">
            <h2 className="text-3xl font-bold tracking-tight text-navy-900">Sign in</h2>
            <p className="mt-1 text-navy-500">Pick a role to see the platform from that point of view. No password needed in the demo.</p>

            <ul className="mt-8 space-y-3">
              {roles.map((r) => {
                const { icon: Icon, blurb } = ROLE_INFO[r]
                const roleUsers = users.filter((u) => u.role === r)
                const single = roleUsers.length === 1
                // Long labels (lists of sites) get a full row each so they never get cut off.
                const stacked = roleUsers.some((u) => scopeLabel(u).length > 24)
                return (
                  <li key={r}>
                    <Card className="gap-3 py-4 transition hover:border-navy-200 hover:shadow-md">
                      <div className="flex items-center gap-3 px-4">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-100">
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base">{ROLE_LABELS[r]}</CardTitle>
                          <CardDescription>{blurb}</CardDescription>
                        </div>
                        {single && (
                          <Button onClick={() => signIn(roleUsers[0].id)} aria-label={`Log in as ${ROLE_LABELS[r]}`}>
                            Log in
                            <ArrowRight aria-hidden />
                          </Button>
                        )}
                      </div>
                      {/* Several accounts (e.g. one per client): choose by scope, not by name */}
                      {!single && (
                        <CardContent className={stacked ? 'grid gap-2 px-4' : 'grid gap-2 px-4 sm:grid-cols-2'}>
                          {roleUsers.map((u) => (
                            <Button
                              key={u.id}
                              variant="outline"
                              onClick={() => signIn(u.id)}
                              aria-label={`Log in as ${ROLE_LABELS[r]}, ${scopeLabel(u)}`}
                              className="group h-11 justify-start hover:border-teal-400 hover:bg-teal-50"
                            >
                              <MapPin className="text-muted-foreground" aria-hidden />
                              <span className="min-w-0 flex-1 truncate text-left">{scopeLabel(u)}</span>
                              <span className="inline-flex items-center gap-1 font-semibold text-teal-700">
                                Log in
                                <ArrowRight className="transition group-hover:translate-x-0.5" aria-hidden />
                              </span>
                            </Button>
                          ))}
                        </CardContent>
                      )}
                    </Card>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        <p className="px-6 pb-6 text-center text-xs text-navy-400 sm:px-10">Kuroshio AI · www.kuroshioai.com · EnergyIQ demo</p>
      </main>
    </div>
  )
}
