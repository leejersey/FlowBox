import { BrowserRouter, Routes, Route, Outlet, useOutletContext, useNavigate } from 'react-router-dom'
import { AppShell, type AppShellOutletContext } from './components/layout/AppShell'
import { ButlerPage } from './pages/ButlerPage'
import { useDatabase } from './hooks/useDatabase'
import { ToastContainer } from './components/ui/ToastContainer'
import { useThemeStore } from './store/useThemeStore'
import { useUpdaterStore } from './store/useUpdaterStore'
import { useAppUsageTracker } from './hooks/useAppUsageTracker'
import { useClipboardPersistence } from './hooks/useClipboardWatcher'
import { lazy, Suspense, useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isTauri } from '@tauri-apps/api/core'
import { settingsNavigation } from './services/settingsNavigationService'

const TodoPage = lazy(() => import('./pages/TodoPage').then(module => ({ default: module.TodoPage })))
const IdeaPage = lazy(() => import('./pages/IdeaPage').then(module => ({ default: module.IdeaPage })))
const PomodoroPage = lazy(() => import('./pages/PomodoroPage').then(module => ({ default: module.PomodoroPage })))
const ClipboardPage = lazy(() => import('./pages/ClipboardPage').then(module => ({ default: module.ClipboardPage })))
const VoicePage = lazy(() => import('./pages/VoicePage').then(module => ({ default: module.VoicePage })))
const StatsPage = lazy(() => import('./pages/StatsPage').then(module => ({ default: module.StatsPage })))
const TrendingPage = lazy(() => import('./pages/TrendingPage').then(module => ({ default: module.TrendingPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(module => ({ default: module.SettingsPage })))

const windowLabel = isTauri() ? getCurrentWindow().label : 'main'

function SettingsNavigationBridge() {
  const navigate = useNavigate()
  useEffect(() => settingsNavigation.bind(() => navigate('/settings')), [navigate])
  return null
}

function MainWindowEffects() {
  useClipboardPersistence()
  useAppUsageTracker()

  useEffect(() => {
    const store = useUpdaterStore.getState()
    void store.loadCurrentVersion()
    const timer = window.setTimeout(() => {
      void store.checkForUpdate({ silent: true })
    }, 4500)
    return () => window.clearTimeout(timer)
  }, [])

  return null
}

function SuspendedOutlet() {
  const context = useOutletContext<AppShellOutletContext>()

  return (
    <Suspense fallback={<div className="flex-1 h-full w-full flex items-center justify-center text-xs font-medium text-on-surface-variant/70 animate-pulse">加载中...</div>}>
      <Outlet context={context} />
    </Suspense>
  )
}

function App() {
  const { ready, error } = useDatabase()
  const initTheme = useThemeStore(state => state.init)

  useEffect(() => {
    initTheme()
  }, [initTheme])

  if (error) {
    return (
      <div className="h-screen w-screen bg-surface text-on-surface flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl bg-surface-container border border-red-500/30 p-6 shadow-xl">
          <h1 className="text-base font-bold text-red-500 mb-2">数据库初始化失败</h1>
          <p className="text-xs text-on-surface-variant leading-relaxed break-words">{error}</p>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="h-screen w-screen bg-surface text-on-surface flex flex-col items-center justify-center gap-3 select-none">
        <div className="w-8 h-8 rounded-full border-2 border-primary/25 border-t-primary animate-spin" />
        <span className="text-xs font-medium text-on-surface-variant/80">正在初始化本地工作区...</span>
      </div>
    )
  }

  return (
    <BrowserRouter>
      {windowLabel === 'main' && <SettingsNavigationBridge />}
      {windowLabel === 'main' && <MainWindowEffects />}
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route element={<SuspendedOutlet />}>
            <Route index element={<TodoPage />} />
            <Route path="idea" element={<IdeaPage />} />
            <Route path="pomodoro" element={<PomodoroPage />} />
            <Route path="clipboard" element={<ClipboardPage />} />
            <Route path="voice" element={<VoicePage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="trending" element={<TrendingPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
        {/* Butler 独立窗口路由 — 不包裹 AppShell */}
        <Route path="/butler" element={<ButlerPage />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  )
}

export default App
