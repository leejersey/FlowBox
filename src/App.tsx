import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ButlerPage } from './pages/ButlerPage'
import { useDatabase } from './hooks/useDatabase'
import { ToastContainer } from './components/ui/ToastContainer'
import { useThemeStore } from './store/useThemeStore'
import { useAppUsageTracker } from './hooks/useAppUsageTracker'
import { useClipboardPersistence } from './hooks/useClipboardWatcher'
import { lazy, Suspense, useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isTauri } from '@tauri-apps/api/core'

const TodoPage = lazy(() => import('./pages/TodoPage').then(module => ({ default: module.TodoPage })))
const IdeaPage = lazy(() => import('./pages/IdeaPage').then(module => ({ default: module.IdeaPage })))
const PomodoroPage = lazy(() => import('./pages/PomodoroPage').then(module => ({ default: module.PomodoroPage })))
const ClipboardPage = lazy(() => import('./pages/ClipboardPage').then(module => ({ default: module.ClipboardPage })))
const VoicePage = lazy(() => import('./pages/VoicePage').then(module => ({ default: module.VoicePage })))
const MarkdownPage = lazy(() => import('./pages/MarkdownPage').then(module => ({ default: module.MarkdownPage })))
const StatsPage = lazy(() => import('./pages/StatsPage').then(module => ({ default: module.StatsPage })))
const TrendingPage = lazy(() => import('./pages/TrendingPage').then(module => ({ default: module.TrendingPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(module => ({ default: module.SettingsPage })))

const windowLabel = isTauri() ? getCurrentWindow().label : 'main'

function MainWindowEffects() {
  useClipboardPersistence()
  useAppUsageTracker()
  return null
}

function SuspendedOutlet() {
  return (
    <Suspense fallback={<div style={{ padding: 20 }}>加载中...</div>}>
      <Outlet />
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
    return <div style={{ padding: 20, color: 'red' }}>数据库初始化失败: {error}</div>
  }

  if (!ready) {
    return <div style={{ padding: 20 }}>正在初始化数据库...</div>
  }

  return (
    <BrowserRouter>
      {windowLabel === 'main' && <MainWindowEffects />}
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route element={<SuspendedOutlet />}>
            <Route index element={<TodoPage />} />
            <Route path="idea" element={<IdeaPage />} />
            <Route path="pomodoro" element={<PomodoroPage />} />
            <Route path="clipboard" element={<ClipboardPage />} />
            <Route path="voice" element={<VoicePage />} />
            <Route path="markdown" element={<MarkdownPage />} />
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
