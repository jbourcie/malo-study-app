import React from 'react'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import { RequireAdmin, RequireAuth, RequireParent } from './components/Guards'
import { HomePage } from './pages/Home'
import { LoginPage } from './pages/Login'
import { ThemeSessionPage } from './pages/ThemeSession'
import { AdminImportPage } from './pages/AdminImport'
import { ProgressPage } from './pages/Progress'
import { QuestionModerationPage } from './pages/QuestionModeration'
import { PackRequestBuilderPage } from './pages/admin/PackRequestBuilderPage'
import { QuestionReportsPage } from './pages/admin/QuestionReportsPage'
import { ProgressOverviewPage } from './pages/ProgressOverview'
import { NotFoundPage } from './pages/NotFound'
import { CollectionPage } from './pages/Collection'
import { WorldMapPage } from './pages/world/WorldMapPage'
import { BiomePage } from './pages/world/BiomePage'
import { ZonePage } from './pages/world/ZonePage'
import { ChestPage } from './pages/ChestPage'
import { WorldHubPage } from './pages/WorldHub'
import { BiomeMapPage } from './pages/biome/BiomeMapPage'
import { PrioritySettingsPage } from './pages/PrioritySettings'
import { ZoneMapPage } from './pages/zone/ZoneMapPage'
import { consumeNavAnchor } from './world/transitions/navAnchors'
import { AppShellMap } from './components/layout/AppShellMap'

function AppRoutes() {
  const location = useLocation()
  const routeKey = location.pathname
  const navIntent = React.useMemo(() => {
    if (routeKey.startsWith('/biome/')) {
      const intent = consumeNavAnchor()
      return intent && intent.from === 'world' ? intent : null
    }
    if (routeKey.startsWith('/zone/')) {
      const intent = consumeNavAnchor()
      return intent && intent.from === 'biome' ? intent : null
    }
    return null
  }, [routeKey])

  return (
    <Routes location={location} key={routeKey}>
      <Route path="/" element={<LoginPage />} />
      <Route path="/connexion" element={<LoginPage />} />
      <Route
        path="/home"
        element={
          <RequireAuth>
            <AppShellMap routeKey={routeKey} navContext={navIntent}>
              <WorldHubPage />
            </AppShellMap>
          </RequireAuth>
        }
      />
      <Route
        path="/hub"
        element={
          <RequireAuth>
            <AppShellMap routeKey={routeKey} navContext={navIntent}>
              <WorldHubPage />
            </AppShellMap>
          </RequireAuth>
        }
      />
      <Route path="/theme/:themeId" element={<RequireAuth><ThemeSessionPage /></RequireAuth>} />
      <Route path="/admin/import" element={<RequireAdmin><AdminImportPage /></RequireAdmin>} />
      <Route path="/admin/progression" element={<RequireAdmin><ProgressPage /></RequireAdmin>} />
      <Route path="/admin/questions" element={<RequireAdmin><QuestionModerationPage /></RequireAdmin>} />
      <Route path="/admin/reports" element={<RequireAdmin><QuestionReportsPage /></RequireAdmin>} />
      <Route path="/admin/pack-request" element={<RequireAdmin><PackRequestBuilderPage /></RequireAdmin>} />
      <Route path="/parent/priorites" element={<RequireParent><PrioritySettingsPage /></RequireParent>} />
      <Route path="/collection" element={<RequireAuth><CollectionPage /></RequireAuth>} />
      <Route path="/progression" element={<RequireAuth><ProgressOverviewPage /></RequireAuth>} />
      <Route path="/chest" element={<RequireAuth><ChestPage /></RequireAuth>} />
      <Route path="/world" element={<RequireAuth><WorldMapPage /></RequireAuth>} />
      <Route path="/world/:biomeId" element={<RequireAuth><BiomePage /></RequireAuth>} />
      <Route
        path="/biome/:biomeId"
        element={
          <RequireAuth>
            <AppShellMap routeKey={routeKey} navContext={navIntent}>
              <BiomeMapPage />
            </AppShellMap>
          </RequireAuth>
        }
      />
      <Route
        path="/zone/:biomeId/:zoneKey"
        element={
          <RequireAuth>
            <AppShellMap routeKey={routeKey} navContext={navIntent}>
              <ZoneMapPage />
            </AppShellMap>
          </RequireAuth>
        }
      />
      <Route path="/world/:biomeId/zone/:themeId" element={<RequireAuth><ZonePage /></RequireAuth>} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export function App() {
  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  )
}
