import React from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { TopBar } from './components/TopBar'
import { RequireAdmin, RequireAuth, RequireParent } from './components/Guards'
import { HomePage } from './pages/Home'
import { LoginPage } from './pages/Login'
import { ThemeSessionPage } from './pages/ThemeSession'
import { AdminImportPage } from './pages/AdminImport'
import { ProgressPage } from './pages/Progress'
import { QuestionModerationPage } from './pages/QuestionModeration'
import { PackRequestBuilderPage } from './pages/admin/PackRequestBuilderPage'
import { ProgressOverviewPage } from './pages/ProgressOverview'
import { NotFoundPage } from './pages/NotFound'
import { CollectionPage } from './pages/Collection'
import { WorldMapPage } from './pages/world/WorldMapPage'
import { BiomePage } from './pages/world/BiomePage'
import { ZonePage } from './pages/world/ZonePage'
import { ChestPage } from './pages/ChestPage'

export function App() {
  return (
    <HashRouter>
      <div className="container">
        <TopBar />
      </div>

      <Routes>
        <Route path="/connexion" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
        <Route path="/theme/:themeId" element={<RequireAuth><ThemeSessionPage /></RequireAuth>} />
        <Route path="/admin/import" element={<RequireParent><AdminImportPage /></RequireParent>} />
        <Route path="/admin/progression" element={<RequireParent><ProgressPage /></RequireParent>} />
        <Route path="/admin/questions" element={<RequireAdmin><QuestionModerationPage /></RequireAdmin>} />
        <Route path="/admin/pack-request" element={<RequireAdmin><PackRequestBuilderPage /></RequireAdmin>} />
        <Route path="/collection" element={<RequireAuth><CollectionPage /></RequireAuth>} />
        <Route path="/progression" element={<RequireAuth><ProgressOverviewPage /></RequireAuth>} />
        <Route path="/chest" element={<RequireAuth><ChestPage /></RequireAuth>} />
        <Route path="/world" element={<RequireAuth><WorldMapPage /></RequireAuth>} />
        <Route path="/world/:biomeId" element={<RequireAuth><BiomePage /></RequireAuth>} />
        <Route path="/world/:biomeId/zone/:themeId" element={<RequireAuth><ZonePage /></RequireAuth>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </HashRouter>
  )
}
