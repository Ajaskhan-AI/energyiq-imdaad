import { lazy, Suspense, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { PAGE_ACCESS } from './auth/permissions'
import { RequirePermission } from './auth/RequirePermission'
import { ROLE_HOME } from './auth/roles'
import { useCurrentUser } from './auth/useCurrentUser'
import { ProtectedLayout } from './components/layout/ProtectedLayout'
import { PageLoader } from './components/ui/PageLoader'
import type { Permission } from './types'
import NotFoundPage from './pages/NotFoundPage'

// Each page is loaded on first visit (code splitting), so the app opens faster.
const LoginPage = lazy(() => import('./pages/LoginPage'))
const OverviewPage = lazy(() => import('./pages/overview/OverviewPage'))
const SmdbPage = lazy(() => import('./pages/smdb/SmdbPage'))
const AlertsPage = lazy(() => import('./pages/smdb/AlertsPage'))
const SmdbDetailPage = lazy(() => import('./pages/smdb/SmdbDetailPage'))
const EnergyPage = lazy(() => import('./pages/energy/EnergyPage'))
const PowerQualityPage = lazy(() => import('./pages/powerQuality/PowerQualityPage'))
const AssetsPage = lazy(() => import('./pages/assets/AssetsPage'))
const AssetDetailPage = lazy(() => import('./pages/assets/AssetDetailPage'))
const BillingPage = lazy(() => import('./pages/billing/BillingPage'))
const WorkOrdersPage = lazy(() => import('./pages/workOrders/WorkOrdersPage'))
const WorkOrderDetailPage = lazy(() => import('./pages/workOrders/WorkOrderDetailPage'))
const DevicesPage = lazy(() => import('./pages/devices/DevicesPage'))
const ReportPage = lazy(() => import('./pages/report/ReportPage'))
const HowItWorksPage = lazy(() => import('./pages/howItWorks/HowItWorksPage'))
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'))

/** "/" sends each role to its own home page. */
function HomeRedirect() {
  const user = useCurrentUser()
  return <Navigate to={user ? ROLE_HOME[user.role] : '/login'} replace />
}

/** Shorthand: wrap a page in its permission guard. */
const guard = (access: readonly Permission[], page: ReactNode) => <RequirePermission anyOf={access}>{page}</RequirePermission>

/**
 * HashRouter keeps the route after a "#" (e.g. /#/energy), so the app
 * works on any static host without server rewrite rules.
 */
export default function App() {
  return (
    <HashRouter>
      <Suspense fallback={<PageLoader fullScreen />}>
        <Routes>
          <Route path="login" element={<LoginPage />} />

          {/* Everything else needs a demo login; pages render inside the shell's <Outlet /> */}
          <Route element={<ProtectedLayout />}>
            <Route index element={<HomeRedirect />} />
            <Route path="overview" element={guard(PAGE_ACCESS.overview, <OverviewPage />)} />
            <Route path="smdb" element={guard(PAGE_ACCESS.smdb, <SmdbPage />)} />
            <Route path="smdb/alerts" element={guard(PAGE_ACCESS.smdb, <AlertsPage />)} />
            {/* Detail pages also check the user's sites themselves */}
            <Route path="smdb/:smdbId" element={guard(PAGE_ACCESS.smdb, <SmdbDetailPage />)} />
            <Route path="energy" element={guard(PAGE_ACCESS.energy, <EnergyPage />)} />
            <Route path="power-quality" element={guard(PAGE_ACCESS.powerQuality, <PowerQualityPage />)} />
            <Route path="assets" element={guard(PAGE_ACCESS.assets, <AssetsPage />)} />
            <Route path="assets/:assetId" element={guard(PAGE_ACCESS.assets, <AssetDetailPage />)} />
            <Route path="billing" element={guard(PAGE_ACCESS.billing, <BillingPage />)} />
            <Route path="work-orders" element={guard(PAGE_ACCESS.workOrders, <WorkOrdersPage />)} />
            <Route path="work-orders/:workOrderId" element={guard(PAGE_ACCESS.workOrders, <WorkOrderDetailPage />)} />
            <Route path="devices" element={guard(PAGE_ACCESS.devices, <DevicesPage />)} />
            <Route path="report" element={guard(PAGE_ACCESS.report, <ReportPage />)} />
            <Route path="how-it-works" element={guard(PAGE_ACCESS.howItWorks, <HowItWorksPage />)} />
            <Route path="settings" element={guard(PAGE_ACCESS.settings, <SettingsPage />)} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  )
}
