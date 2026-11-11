import { ArrowRight, Briefcase, Building2, ChartColumn, HardHat, MapPin, Radio, ShieldCheck, Zap, type LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router'
import { ROLE_HOME, ROLE_LABELS, ROLE_ORDER } from '../auth/roles'
import { BrandMark } from '../components/layout/BrandMark'
import { SampleBadge } from '../components/layout/SampleBadge'
import { UserAvatar } from '../components/ui/UserAvatar'
import { SITES } from '../data/sites'
import { NODES, SMDBS } from '../data/smdbs'
import { formatNumber } from '../lib/format'
import { siteFilterLabel } from '../lib/scope'
import { useSimulator } from '../sim/simulatorContext'
import { actions } from '../store/actions'
import { useAppDispatch, useAppState } from '../store/hooks'
import type { Role } from '../types'

/** What each role is for, shown on its login card. */
const ROLE_INFO: Record<Role, { icon: LucideIcon; blurb: string }> = {
  fm_manager: { icon: Briefcase, blurb: 'Portfolio KPIs across every client site' },
  energy_engineer: { icon: ChartColumn, blurb: 'Analytics, waste detection, power quality' },
  site_supervisor: { icon: HardHat, blurb: 'Live boards and alerts for their sites' },
  client_viewer: { icon: Building2, blurb: 'Their buildings, costs and monthly reports' },
  admin: { icon: ShieldCheck, blurb: 'IoT devices, users and demo tools' },
}

/**
 * Demo login: one card per role, with a login button for each demo user in
 * that role. There is no real authentication.
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
      <aside className="relative hidden overflow-hidden bg-navy-950 text-white lg:flex lg:flex-col">
        {/* Faint wiring-diagram grid */}
        <svg className="pointer-events-none absolute inset-0 size-full opacity-[0.07]" aria-hidden>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        <div className="relative flex flex-1 flex-col justify-between p-10 xl:p-14">
          <BrandMark dark showPreparedFor={false} />

          <div className="max-w-md">
            <p className="text-sm font-semibold tracking-widest text-teal-300 uppercase">Prepared for Imdaad</p>
            <h1 className="mt-3 text-4xl leading-tight font-bold tracking-tight xl:text-5xl">Every SMDB, every site, one live view.</h1>
            <p className="mt-4 text-lg text-navy-200">
              Selec energy meters and Kuroshio IoT nodes turn each distribution board into live data, then into savings you can show every client.
            </p>

            {/* Live strip: real numbers from the running simulator */}
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <div className="flex items-center gap-2 text-sm text-navy-200">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal-400 opacity-60" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-teal-400" />
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
                    <dt className="flex items-center gap-1.5 text-xs text-navy-300">
                      <Icon className="size-3.5" aria-hidden />
                      {label}
                    </dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <p className="text-xs text-navy-400">All people, clients and buildings are fictional. All figures are sample data.</p>
        </div>
      </aside>

      {/* ---------- Role logins ---------- */}
      <main className="flex flex-col bg-navy-50/40">
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
                return (
                  <li key={r} className="rounded-2xl border border-navy-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-teal-300">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-navy-900">{ROLE_LABELS[r]}</h3>
                        <p className="text-sm text-navy-500">{blurb}</p>
                      </div>
                    </div>
                    <div className={roleUsers.length > 1 ? 'mt-3 grid gap-2 sm:grid-cols-2' : 'mt-3'}>
                      {roleUsers.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => signIn(u.id)}
                          aria-label={`Log in as ${u.name}, ${ROLE_LABELS[r]}`}
                          className="group flex w-full items-center gap-3 rounded-xl border border-navy-100 bg-navy-50/50 px-3 py-2.5 text-left transition hover:border-teal-400 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
                        >
                          <UserAvatar user={u} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-navy-900">{u.name}</span>
                            <span className="block truncate text-xs text-navy-500">{siteFilterLabel(u, 'ALL')}</span>
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-teal-700">
                            Log in
                            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                          </span>
                        </button>
                      ))}
                    </div>
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
