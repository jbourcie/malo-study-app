import React from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { TopBar } from './components/TopBar'
import { RequireAuth, RequireParent } from './components/Guards'
import { HomePage } from './pages/Home'
import { LoginPage } from './pages/Login'
import { ThemeSessionPage } from './pages/ThemeSession'
import { AdminImportPage } from './pages/AdminImport'
import { ProgressPage } from './pages/Progress'
import { ModerationPage } from './pages/Moderation'
import { RewardPage } from './pages/Reward'
import { ProgressOverviewPage } from './pages/ProgressOverview'
import { NotFoundPage } from './pages/NotFound'

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
        <Route path="/admin/moderation" element={<RequireParent><ModerationPage /></RequireParent>} />
        <Route path="/recompenses" element={<RequireAuth><RewardPage /></RequireAuth>} />
        <Route path="/progression" element={<RequireAuth><ProgressOverviewPage /></RequireAuth>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </HashRouter>
  )
}
