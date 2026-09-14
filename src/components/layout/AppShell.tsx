import { useEffect, useState, useCallback } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { Sidebar } from './Sidebar'
import { TitleBar } from './TitleBar'
import { StatusBar } from './StatusBar'
import { ButlerOverlay } from './ButlerOverlay'
import { GlobalSearchBar } from './GlobalSearchBar'
import { DailyReviewModal } from '@/components/review/DailyReviewModal'
import { ScreenshotOcrPanel } from '@/components/screenshot/ScreenshotOcrPanel'
import { useDailyReview } from '@/hooks/useDailyReview'
import { useScreenshotOcr } from '@/hooks/useScreenshotOcr'
import * as settingsService from '@/services/settingsService'
import { showToast } from '@/store/useToastStore'

const DEFAULT_BUTLER_SHORTCUT = 'Shift+Space'
const isTauriApp = isTauri()

export interface AppShellOutletContext {
  triggerReview: () => Promise<void>
}

export function AppShell() {
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const dailyReview = useDailyReview()
  const screenshotOcr = useScreenshotOcr()

  const toggleSearch = useCallback(() => setSearchOpen(v => !v), [])

  // 全局桌面级快捷键体系
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey

      // ⌘/ 全局搜索
      if (isCmdOrCtrl && e.key === '/') {
        e.preventDefault()
        toggleSearch()
        return
      }

      // ⌘1 ~ ⌘5, ⌘8, ⌘, 模块极速切换
      if (isCmdOrCtrl && !e.shiftKey && !e.altKey) {
        if (e.key === '1') { e.preventDefault(); navigate('/') }
        else if (e.key === '2') { e.preventDefault(); navigate('/pomodoro') }
        else if (e.key === '3') { e.preventDefault(); navigate('/idea') }
        else if (e.key === '4') { e.preventDefault(); navigate('/clipboard') }
        else if (e.key === '5') { e.preventDefault(); navigate('/voice') }
        else if (e.key === '8') { e.preventDefault(); navigate('/stats') }
        else if (e.key === ',') { e.preventDefault(); navigate('/settings') }
        else if (e.key.toLowerCase() === 'n') {
          // ⌘N 广播全局新建捕获事件
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('flowbox:quick_create'))
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleSearch, navigate])

  useEffect(() => {
    if (!isTauriApp) return

    let active = true

    const syncButlerShortcut = async () => {
      try {
        const shortcut = await settingsService.settingsGet('shortcuts.butler_hotkey')
        if (!active) return
        await invoke('butler_set_shortcut', { shortcut: shortcut || DEFAULT_BUTLER_SHORTCUT })
      } catch (err) {
        if (active) {
          showToast(`同步 Butler 快捷键失败: ${String(err)}`, 'error')
        }
      }
    }

    syncButlerShortcut()

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface relative">
      <TitleBar />
      <Sidebar onSearchClick={toggleSearch} />
      <main className="flex-1 h-full pt-10 relative overflow-hidden flex flex-col min-w-0">
        <div className="flex-1 w-full h-full relative overflow-hidden px-4 lg:px-6 py-4 flex flex-col min-w-0">
          <Outlet context={{ triggerReview: dailyReview.triggerReview }} />
        </div>
        <StatusBar />
      </main>
      <ButlerOverlay />
      <GlobalSearchBar isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <DailyReviewModal
        isOpen={dailyReview.isOpen}
        onClose={dailyReview.close}
        reviewData={dailyReview.reviewData}
        aiSummary={dailyReview.aiSummary}
        isLoadingData={dailyReview.isLoadingData}
        isLoadingAi={dailyReview.isLoadingAi}
        onSave={dailyReview.saveReview}
        isSaved={dailyReview.isSaved}
      />
      <ScreenshotOcrPanel
        isOpen={screenshotOcr.isOpen}
        step={screenshotOcr.step}
        ocrResult={screenshotOcr.ocrResult}
        error={screenshotOcr.error}
        onSaveAsIdea={screenshotOcr.saveAsIdea}
        onSaveAsTodo={screenshotOcr.saveAsTodo}
        onClose={screenshotOcr.close}
        onUpdateText={screenshotOcr.updateText}
        onUpdateTitle={screenshotOcr.updateTitle}
      />
    </div>
  )
}
