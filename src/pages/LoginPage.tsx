import { ArrowRight, MapPin } from 'lucide-react'
import { useNavigate } from 'react-router'
import { ROLE_HOME, ROLE_LABELS, ROLE_ORDER } from '../auth/roles'
import { BrandMark } from '../components/layout/BrandMark'
import { SampleBadge } from '../components/layout/SampleBadge'
import { UserAvatar } from '../components/ui/UserAvatar'
import { siteFilterLabel } from '../lib/scope'
import { actions } from '../store/actions'
import { useAppDispatch, useAppState } from '../store/hooks'

/** Demo login: one card per demo user, click to sign in. No passwords. */
export default function LoginPage() {
  const { users } = useAppState()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const sorted = [...users].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))

  const signIn = (userId: string) => {
    const user = users.find((u) => u.id === userId)
    if (!user) return
    dispatch(actions.login(user.id))
    navigate(ROLE_HOME[user.role])
  }

  return (
    <div className="min-h-screen bg-navy-900">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <BrandMark dark showPreparedFor={false} />
            <h1 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">SMDB energy monitoring & analytics</h1>
            <p className="mt-2 max-w-2xl text-lg text-navy-200">
              A demo prepared for Imdaad: live SMDB data from Selec energy meters and Kuroshio IoT nodes, turned into analytics across a
              multi-client FM portfolio.
            </p>
            <p className="mt-4 text-navy-300">Choose a demo user to see the platform from their role. No passwords: click a card to sign in.</p>
          </div>
          <SampleBadge />
        </header>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => signIn(user.id)}
              className="group flex items-start gap-4 rounded-xl bg-white p-5 text-left shadow-sm ring-1 ring-navy-800 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-2 hover:ring-teal-400 focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:outline-none"
            >
              <UserAvatar user={user} size="lg" />
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold text-navy-900">{user.name}</span>
                <span className="block text-sm text-navy-500">{user.jobTitle}</span>
                <span className="block text-xs text-navy-400">{user.organisation}</span>
                <span className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-navy-50 px-2.5 py-1 font-medium text-navy-700">{ROLE_LABELS[user.role]}</span>
                  <span className="inline-flex items-center gap-1 text-navy-500">
                    <MapPin className="size-3.5" aria-hidden />
                    {siteFilterLabel(user, 'ALL')}
                  </span>
                </span>
              </span>
              <ArrowRight className="mt-1 size-5 text-navy-300 transition group-hover:text-teal-600" aria-hidden />
            </button>
          ))}
        </div>

        <p className="mt-10 text-sm text-navy-400">
          All people, clients and buildings in this demo are fictional. All figures are sample data. Kuroshio AI · www.kuroshioai.com
        </p>
      </div>
    </div>
  )
}
