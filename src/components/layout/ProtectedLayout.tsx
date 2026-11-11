import { Navigate } from 'react-router'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { AppShell } from './AppShell'

/** Not logged in → login screen. Everyone else gets the app shell. */
export function ProtectedLayout() {
  const user = useCurrentUser()
  if (!user) return <Navigate to="/login" replace />
  return <AppShell />
}
