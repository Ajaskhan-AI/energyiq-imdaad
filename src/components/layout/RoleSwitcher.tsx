import { Check, ChevronDown, LogOut, Repeat } from 'lucide-react'
import { useNavigate } from 'react-router'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu'
import { ROLE_HOME, ROLE_LABELS, ROLE_ORDER } from '../../auth/roles'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { getClient, getSite } from '../../data/sites'
import { actions } from '../../store/actions'
import { useAppDispatch, useAppState } from '../../store/hooks'
import type { User } from '../../types'
import { UserAvatar } from '../ui/UserAvatar'

/** What a login covers (same wording as the login page): the client, or the sites. */
function scopeLabel(user: User): string {
  if (user.clientId) return getClient(user.clientId)?.name ?? 'Client'
  if (user.siteIds === 'ALL') return 'All sites'
  return user.siteIds.map((id) => getSite(id)?.shortName ?? id).join(' & ')
}

/**
 * User menu in the top bar. The presenter can jump to any other role
 * instantly ("Switch role") or log out to the login screen.
 */
export function RoleSwitcher() {
  const user = useCurrentUser()
  const { users } = useAppState()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  if (!user) return null

  const switchTo = (target: User) => {
    dispatch(actions.login(target.id))
    navigate(ROLE_HOME[target.role])
  }
  const logout = () => {
    dispatch(actions.logout())
    navigate('/login')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="User menu and switch role"
        className="flex h-9 items-center gap-2 rounded-md border border-navy-100 bg-white pr-2 pl-1 outline-none hover:bg-navy-50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <UserAvatar user={user} size="sm" />
        <span className="hidden max-w-44 text-left leading-tight xl:block">
          <span className="block truncate text-sm font-semibold text-navy-900">{ROLE_LABELS[user.role]}</span>
          <span className="block truncate text-xs text-navy-500">{scopeLabel(user)}</span>
        </span>
        <ChevronDown className="size-4 text-navy-400" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center gap-3 py-2">
          <UserAvatar user={user} size="md" />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-navy-900">{user.name}</span>
            <span className="block truncate text-xs font-normal text-navy-500">
              {ROLE_LABELS[user.role]} · {user.organisation}
            </span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-navy-400 uppercase">
          <Repeat className="size-3.5" aria-hidden />
          Switch role
        </DropdownMenuLabel>
        <DropdownMenuGroup>
          {ROLE_ORDER.flatMap((role) => users.filter((u) => u.role === role)).map((u) => (
            <DropdownMenuItem key={u.id} onSelect={() => switchTo(u)} className="gap-3 py-2">
              <UserAvatar user={u} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-navy-900">{ROLE_LABELS[u.role]}</span>
                <span className="block truncate text-xs text-navy-500">{scopeLabel(u)}</span>
              </span>
              {u.id === user.id && <Check className="text-teal-600" aria-label="Current" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout} className="gap-2">
          <LogOut aria-hidden />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
