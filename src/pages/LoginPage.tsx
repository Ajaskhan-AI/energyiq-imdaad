import clsx from 'clsx'
import { ArrowRight, Briefcase, Building2, ChartColumn, Check, HardHat, KeyRound, Lock, MapPin, Radio, ShieldCheck, User as UserIcon, Zap, type LucideIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
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

/** What each role is for, shown on the role picker. */
const ROLE_INFO: Record<Role, { icon: LucideIcon; blurb: string }> = {
  fm_manager: { icon: Briefcase, blurb: 'Portfolio KPIs across every client site' },
  energy_engineer: { icon: ChartColumn, blurb: 'Analytics, waste detection, power quality' },
  site_supervisor: { icon: HardHat, blurb: 'Live boards and alerts for your sites' },
  client_viewer: { icon: Building2, blurb: 'Your buildings, costs and monthly reports' },
  admin: { icon: ShieldCheck, blurb: 'IoT devices, users and demo tools' },
}

/** "Khalid Al Suwaidi" → "khalid.alsuwaidi" (demo username, not a real account). */
function username(name: string): string {
  const words = name.toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/)
  return words.length > 1 ? `${words[0]}.${words.slice(1).join('')}` : words[0]
}

/**
 * Demo login: pick a role, then the user for that role, and sign in.
 * There is no real authentication; no password is checked.
 */
export default function LoginPage() {
  const { users } = useAppState()
  const sim = useSimulator()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const roles = ROLE_ORDER.filter((r) => users.some((u) => u.role === r))
  const [role, setRole] = useState<Role>(roles[0] ?? 'fm_manager')
  const roleUsers = users.filter((u) => u.role === role)
  const [userId, setUserId] = useState<string | null>(null)
  const selected = roleUsers.find((u) => u.id === userId) ?? roleUsers[0]

  const liveKw = SMDBS.reduce((s, b) => s + (sim.health[b.id]?.status === 'offline' ? 0 : (sim.readings[b.id]?.kW ?? 0)), 0)
  const nodesOnline = sim.nodes.filter((n) => n.status !== 'offline').length

  const pickRole = (r: Role) => {
    setRole(r)
    setUserId(null)
  }
  const signIn = (event: FormEvent) => {
    event.preventDefault()
    if (!selected) return
    dispatch(actions.login(selected.id))
    navigate(ROLE_HOME[selected.role])
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

      {/* ---------- Sign-in panel ---------- */}
      <main className="flex flex-col bg-navy-50/40">
        <div className="flex items-center justify-between gap-3 px-6 pt-6 sm:px-10">
          <div className="lg:hidden">
            <BrandMark showPreparedFor={false} />
          </div>
          <SampleBadge className="ml-auto" />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <form onSubmit={signIn} className="w-full max-w-xl">
            <h2 className="text-3xl font-bold tracking-tight text-navy-900">Sign in</h2>
            <p className="mt-1 text-navy-500">Choose your role to see the platform from that point of view.</p>

            {/* Step 1: role */}
            <fieldset className="mt-8">
              <legend className="text-sm font-semibold text-navy-800">1. Sign in as</legend>
              <div role="radiogroup" aria-label="Role" className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {roles.map((r) => {
                  const { icon: Icon, blurb } = ROLE_INFO[r]
                  const active = r === role
                  return (
                    <button
                      key={r}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => pickRole(r)}
                      className={clsx(
                        'group relative flex items-start gap-3 rounded-xl border bg-white p-3.5 text-left transition',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500',
                        active ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-navy-100 hover:border-navy-300',
                        r === 'admin' && roles.length % 2 === 1 && 'sm:col-span-2',
                      )}
                    >
                      <span className={clsx('flex size-10 shrink-0 items-center justify-center rounded-lg', active ? 'bg-teal-600 text-white' : 'bg-navy-50 text-navy-600 group-hover:bg-navy-100')}>
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-navy-900">{ROLE_LABELS[r]}</span>
                        <span className="block text-sm text-navy-500">{blurb}</span>
                      </span>
                      {active && <Check className="absolute top-3 right-3 size-4 text-teal-600" aria-hidden />}
                    </button>
                  )
                })}
              </div>
            </fieldset>

            {/* Step 2: account for that role */}
            <fieldset className="mt-7">
              <legend className="text-sm font-semibold text-navy-800">2. Account</legend>
              {roleUsers.length > 1 && (
                <div role="radiogroup" aria-label="Account" className="mt-3 space-y-2">
                  {roleUsers.map((u) => {
                    const active = u.id === selected?.id
                    return (
                      <label
                        key={u.id}
                        className={clsx(
                          'flex cursor-pointer items-center gap-3 rounded-xl border bg-white px-3.5 py-2.5 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-teal-500',
                          active ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-navy-100 hover:border-navy-300',
                        )}
                      >
                        <input type="radio" name="account" value={u.id} checked={active} onChange={() => setUserId(u.id)} className="sr-only" />
                        <UserAvatar user={u} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-navy-900">{u.name}</span>
                          <span className="block truncate text-xs text-navy-500">
                            {u.jobTitle} · {siteFilterLabel(u, 'ALL')}
                          </span>
                        </span>
                        <span className={clsx('flex size-5 items-center justify-center rounded-full border', active ? 'border-teal-600 bg-teal-600 text-white' : 'border-navy-200')}>
                          {active && <Check className="size-3" aria-hidden />}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}

              {selected && (
                <div className="mt-3 space-y-3">
                  {roleUsers.length === 1 && (
                    <div className="flex items-center gap-3 rounded-xl border border-navy-100 bg-white px-3.5 py-2.5">
                      <UserAvatar user={selected} size="sm" />
                      <span className="min-w-0">
                        <span className="block font-medium text-navy-900">{selected.name}</span>
                        <span className="block truncate text-xs text-navy-500">
                          {selected.jobTitle} · {siteFilterLabel(selected, 'ALL')}
                        </span>
                      </span>
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="relative block">
                      <UserIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-navy-400" aria-hidden />
                      <input readOnly value={username(selected.name)} aria-label="Username" className="block w-full rounded-lg border border-navy-200 bg-white py-2.5 pr-3 pl-9 text-navy-900" />
                    </label>
                    <label className="relative block">
                      <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-navy-400" aria-hidden />
                      <input
                        readOnly
                        type="password"
                        value="demo-access"
                        aria-label="Password (not needed in the demo)"
                        className="block w-full rounded-lg border border-navy-200 bg-navy-50 py-2.5 pr-3 pl-9 text-navy-500"
                      />
                    </label>
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-navy-500">
                    <KeyRound className="size-3.5" aria-hidden />
                    Demo access: no password is checked · {selected.organisation}
                  </p>
                </div>
              )}
            </fieldset>

            <button
              type="submit"
              disabled={!selected}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 px-5 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:opacity-50"
            >
              Sign in{selected ? ` as ${selected.name.split(' ')[0]}` : ''}
              <ArrowRight className="size-5" aria-hidden />
            </button>
          </form>
        </div>

        <p className="px-6 pb-6 text-center text-xs text-navy-400 sm:px-10">Kuroshio AI · www.kuroshioai.com · EnergyIQ demo</p>
      </main>
    </div>
  )
}
