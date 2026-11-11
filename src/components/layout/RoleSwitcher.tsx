import clsx from 'clsx'
import { Check, ChevronDown, LogOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { ROLE_HOME, ROLE_LABELS, ROLE_ORDER } from '../../auth/roles'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { siteFilterLabel } from '../../lib/scope'
import { actions } from '../../store/actions'
import { useAppDispatch, useAppState } from '../../store/hooks'
import { UserAvatar } from '../ui/UserAvatar'

/**
 * "Switch role" menu for the presenter: jump to any demo user instantly.
 * Selecting a user logs in as them and opens their home page.
 */
export function RoleSwitcher({ compact = false }: { compact?: boolean }) {
  const user = useCurrentUser()
  const { users } = useAppState()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Close when clicking outside the menu or pressing Escape.
  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null

  const switchTo = (userId: string) => {
    const target = users.find((u) => u.id === userId)
    if (!target) return
    dispatch(actions.login(target.id))
    setOpen(false)
    navigate(ROLE_HOME[target.role])
  }

  const logout = () => {
    dispatch(actions.logout())
    setOpen(false)
    navigate('/login')
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Switch role"
        className="flex items-center gap-2 rounded-lg border border-navy-200 bg-white py-1 pr-2 pl-1 hover:bg-navy-50"
      >
        <UserAvatar user={user} size="sm" />
        {!compact && (
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-sm font-semibold text-navy-900">{user.name}</span>
            <span className="block text-xs text-navy-500">{ROLE_LABELS[user.role]}</span>
          </span>
        )}
        <ChevronDown className="size-4 text-navy-500" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 max-h-[75vh] w-80 overflow-y-auto rounded-xl border border-navy-100 bg-white py-2 shadow-xl"
        >
          <p className="px-4 pt-1 pb-2 text-xs font-semibold tracking-wide text-navy-400 uppercase">Switch role</p>
          {ROLE_ORDER.map((role) => {
            const roleUsers = users.filter((u) => u.role === role)
            if (roleUsers.length === 0) return null
            return (
              <div key={role} className="py-1">
                <p className="px-4 py-1 text-xs font-medium text-navy-500">{ROLE_LABELS[role]}</p>
                {roleUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    role="menuitem"
                    onClick={() => switchTo(u.id)}
                    className={clsx(
                      'flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-navy-50',
                      u.id === user.id && 'bg-teal-50',
                    )}
                  >
                    <UserAvatar user={u} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-navy-900">{u.name}</span>
                      <span className="block truncate text-xs text-navy-500">
                        {u.organisation} · {siteFilterLabel(u, 'ALL')}
                      </span>
                    </span>
                    {u.id === user.id && <Check className="size-4 text-teal-600" aria-label="Current user" />}
                  </button>
                ))}
              </div>
            )
          })}
          <div className="mt-1 border-t border-navy-100 pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={logout}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm font-medium text-navy-700 hover:bg-navy-50"
            >
              <LogOut className="size-4" aria-hidden />
              Log out to the demo login screen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
