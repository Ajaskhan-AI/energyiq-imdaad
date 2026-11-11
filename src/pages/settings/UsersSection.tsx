import { Pencil, UserPlus, Users } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { can } from '../../auth/permissions'
import { ROLE_LABELS, ROLE_ORDER } from '../../auth/roles'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { inputClass } from '../../components/ui/styles'
import { useToast } from '../../components/ui/toastContext'
import { UserAvatar } from '../../components/ui/UserAvatar'
import { CLIENTS, getClient, SITES } from '../../data/sites'
import { siteFilterLabel } from '../../lib/scope'
import { actions } from '../../store/actions'
import { useAppDispatch, useAppState } from '../../store/hooks'
import type { Role, User } from '../../types'

/** Users & roles: Admin can edit and add demo users; FM Operations Manager can view. */
export function UsersSection() {
  const { users } = useAppState()
  const user = useCurrentUser()
  const canManage = can(user, 'users.manage')
  const [editing, setEditing] = useState<User | 'new' | null>(null)
  const sorted = [...users].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name))

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Users className="size-5 text-navy-600" aria-hidden /> Users & roles
        </span>
      }
      subtitle={canManage ? 'Change a user’s role or sites, or add a demo user. Changes apply immediately.' : 'View only for your role. The System Admin manages users.'}
      actions={
        canManage && (
          <Button size="sm" variant="teal" onClick={() => setEditing('new')}>
            <UserPlus className="size-4" aria-hidden />
            Add demo user
          </Button>
        )
      }
      flush
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-navy-50/60 text-xs font-semibold tracking-wide text-navy-500 uppercase">
            <tr>
              <th className="px-5 py-3">User</th>
              <th className="px-3 py-3">Role</th>
              <th className="px-3 py-3">Organisation</th>
              <th className="px-3 py-3">Sites</th>
              {canManage && <th className="px-5 py-3 text-right">Edit</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-50">
            {sorted.map((u) => (
              <tr key={u.id}>
                <td className="px-5 py-2.5">
                  <span className="flex items-center gap-3">
                    <UserAvatar user={u} size="sm" />
                    <span>
                      <span className="block font-medium text-navy-900">
                        {u.name} {u.id === user?.id && <Badge tone="info">You</Badge>}
                      </span>
                      <span className="block text-xs text-navy-500">{u.jobTitle}</span>
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2.5 text-navy-700">{ROLE_LABELS[u.role]}</td>
                <td className="px-3 py-2.5 text-navy-700">{u.organisation}</td>
                <td className="px-3 py-2.5 text-navy-700">{u.siteIds === 'ALL' ? 'All sites' : u.siteIds.map((id) => SITES.find((s) => s.id === id)?.shortName ?? id).join(', ')}</td>
                {canManage && (
                  <td className="px-5 py-2.5 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(u)}
                      disabled={u.id === user?.id}
                      title={u.id === user?.id ? 'You can’t change your own role while logged in' : undefined}
                      aria-label={`Edit ${u.name}`}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <UserModal user={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </Card>
  )
}

function initialsOf(name: string): string {
  const words = name.replace(/^Dr\.?\s+/i, '').trim().split(/\s+/)
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase() || '?'
}

function UserModal({ user, onClose }: { user?: User; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const toast = useToast()
  const [name, setName] = useState(user?.name ?? '')
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? '')
  const [role, setRole] = useState<Role>(user?.role ?? 'site_supervisor')
  const [allSites, setAllSites] = useState(user ? user.siteIds === 'ALL' : false)
  const [siteIds, setSiteIds] = useState<string[]>(user && user.siteIds !== 'ALL' ? user.siteIds : [])
  const [clientId, setClientId] = useState(user?.clientId ?? CLIENTS[0].id)
  const [showErrors, setShowErrors] = useState(false)

  const isClient = role === 'client_viewer'
  // Client viewers can only be given their own client's sites.
  const siteChoices = isClient ? SITES.filter((s) => s.clientId === clientId) : SITES
  const chosen = siteIds.filter((id) => siteChoices.some((s) => s.id === id))
  const errors = {
    name: name.trim().length < 3 ? 'Enter a full name.' : undefined,
    sites: !allSites && chosen.length === 0 ? 'Pick at least one site.' : undefined,
  }
  const toggle = (id: string) => setSiteIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setShowErrors(true)
    if (errors.name || errors.sites) return
    const saved: User = {
      id: user?.id ?? `u-demo-${Date.now().toString(36)}`,
      name: name.trim(),
      role,
      siteIds: allSites && !isClient ? 'ALL' : chosen,
      ...(isClient ? { clientId } : {}),
      initials: initialsOf(name),
      jobTitle: jobTitle.trim() || ROLE_LABELS[role],
      organisation: isClient ? `${getClient(clientId)?.name ?? ''} · client` : role === 'admin' ? 'Kuroshio AI' : 'Imdaad · FM provider',
    }
    dispatch(actions.saveUser(saved))
    toast.show(user ? `${saved.name} updated` : `${saved.name} added: available on the login screen and in Switch role`)
    onClose()
  }

  return (
    <Modal
      title={user ? `Edit ${user.name}` : 'Add demo user'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="user-form" variant="teal">
            Save
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="um-name" required error={showErrors ? errors.name : undefined}>
            <input id="um-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Job title" htmlFor="um-title" optional>
            <input id="um-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder={ROLE_LABELS[role]} className={inputClass} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role" htmlFor="um-role" required>
            <select id="um-role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClass}>
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>
          {isClient && (
            <Field label="Client" htmlFor="um-client" required>
              <select id="um-client" value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputClass}>
                {CLIENTS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <Field label="Sites" required error={showErrors ? errors.sites : undefined} hint={isClient ? 'Client users only see their own sites.' : undefined}>
          <div className="space-y-2 rounded-lg border border-navy-100 p-3">
            {!isClient && (
              <label className="flex items-center gap-2 text-sm font-medium text-navy-800">
                <input type="checkbox" checked={allSites} onChange={(e) => setAllSites(e.target.checked)} className="size-4 accent-teal-600" />
                All sites (whole portfolio)
              </label>
            )}
            {(!allSites || isClient) &&
              siteChoices.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm text-navy-700">
                  <input type="checkbox" checked={chosen.includes(s.id)} onChange={() => toggle(s.id)} className="size-4 accent-teal-600" />
                  {s.name} <span className="text-xs text-navy-400">· {getClient(s.clientId)?.name}</span>
                </label>
              ))}
          </div>
        </Field>
        <p className="text-xs text-navy-500">Preview: {siteFilterLabel({ ...(user ?? ({} as User)), siteIds: allSites && !isClient ? 'ALL' : chosen } as User, 'ALL')}</p>
      </form>
    </Modal>
  )
}
