import { Lock } from 'lucide-react'
import { Link } from 'react-router'
import { ROLE_HOME, ROLE_LABELS } from '../auth/roles'
import { useCurrentUser } from '../auth/useCurrentUser'

export default function AccessRestrictedPage() {
  const user = useCurrentUser()
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <Lock className="size-7" aria-hidden />
      </div>
      <h1 className="mt-4 text-2xl font-bold text-navy-900">Access restricted for your role</h1>
      <p className="mt-2 text-navy-500">
        {user ? `${ROLE_LABELS[user.role]} users can’t open this page.` : 'You can’t open this page.'} Use{' '}
        <span className="font-medium text-navy-700">Switch role</span> in the top bar to view it as another user.
      </p>
      {user && (
        <Link
          to={ROLE_HOME[user.role]}
          className="mt-6 inline-block rounded-lg bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700"
        >
          Go to my home page
        </Link>
      )}
    </div>
  )
}
