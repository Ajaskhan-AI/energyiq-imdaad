import { Suspense, useState } from 'react'
import { Outlet } from 'react-router'
import { actions } from '../../store/actions'
import { useAppDispatch, useAppState } from '../../store/hooks'
import { PageLoader } from '../ui/PageLoader'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useResetDemo } from './useResetDemo'

const COLLAPSE_KEY = 'energyiq-sidebar-collapsed'

/** Remembered per browser; a convenience only, so failures are ignored. */
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Frame around every logged-in page: sidebar + top bar + page content.
 * <Outlet /> is where the current page renders.
 */
export function AppShell() {
  const { site } = useAppState()
  const dispatch = useAppDispatch()
  const resetDemo = useResetDemo()
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, value ? '0' : '1')
      } catch {
        // Private mode / storage blocked: the toggle still works for this visit.
      }
      return !value
    })
  }

  return (
    <div className="flex h-screen overflow-hidden print:h-auto print:overflow-visible">
      <Sidebar mobileOpen={menuOpen} onClose={() => setMenuOpen(false)} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto print:overflow-visible">
        <TopBar site={site} onSiteChange={(value) => dispatch(actions.setSite(value))} onOpenMenu={() => setMenuOpen(true)} onReset={resetDemo} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
