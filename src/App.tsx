import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { TodoPage } from './pages/TodoPage'
import { IdeaPage } from './pages/IdeaPage'
import { PomodoroPage } from './pages/PomodoroPage'
import { ClipboardPage } from './pages/ClipboardPage'
import { VoicePage } from './pages/VoicePage'
import { MarkdownPage } from './pages/MarkdownPage'
import { StatsPage } from './pages/StatsPage'
import { SettingsPage } from './pages/SettingsPage'
import { ButlerPage } from './pages/ButlerPage'
import { useDatabase } from './hooks/useDatabase'
import { ToastContainer } from './components/ui/ToastContainer'
import { useThemeStore } from './store/useThemeStore'
import { useAppUsageTracker } from './hooks/useAppUsageTracker'
import { useEffect } from 'react'

function App() {
  const { ready, error } = useDatabase()
  const initTheme = useThemeStore(state => state.init)
  useAppUsageTracker()

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
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<TodoPage />} />
          <Route path="idea" element={<IdeaPage />} />
          <Route path="pomodoro" element={<PomodoroPage />} />
          <Route path="clipboard" element={<ClipboardPage />} />
          <Route path="voice" element={<VoicePage />} />
          <Route path="markdown" element={<MarkdownPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        {/* Butler 独立窗口路由 — 不包裹 AppShell */}
        <Route path="/butler" element={<ButlerPage />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  )
}

export default App
