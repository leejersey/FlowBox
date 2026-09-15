import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow, LogicalSize, PhysicalSize, PhysicalPosition } from '@tauri-apps/api/window'
import { createMiniWindowController, type MiniWindowAdapter } from '@/lib/pomodoroMiniWindow'
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
import { supportsNativeSettingsMenu } from '@/services/settingsNavigationService'

const DEFAULT_BUTLER_SHORTCUT = 'Shift+Space'
const isTauriApp = isTauri()

export interface AppShellOutletContext {
  triggerReview: () => Promise<void>
  isMini: boolean
  enterMini: () => Promise<void>
  exitMini: () => Promise<void>
}

export function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)
  const [isMini, setIsMini] = useState(false)
  const controllerRef = useRef<ReturnType<typeof createMiniWindowController> | null>(null)
  const mountedRef = useRef(false)
  const currentPathRef = useRef(location.pathname)
  const dailyReview = useDailyReview()
  const screenshotOcr = useScreenshotOcr()

  const toggleSearch = useCallback(() => setSearchOpen(v => !v), [])

  const forceExitMini = useCallback(async () => {
    if (mountedRef.current) setIsMini(false)
    const controller = controllerRef.current
    if (!controller) return
    try {
      await controller.forceExit()
    } catch (error) {
      if (mountedRef.current) showToast(`恢复窗口失败: ${String(error)}`, 'error')
    }
  }, [])

  const enterMini = useCallback(async () => {
    if (!mountedRef.current) return
    if (!isTauriApp) {
      showToast('浏览器预览模式不支持窗口尺寸收缩', 'info')
      return
    }
    const controller = controllerRef.current
    if (!controller || currentPathRef.current !== '/pomodoro') return
    try {
      await controller.enter()
      if (!mountedRef.current) return
      if (currentPathRef.current !== '/pomodoro') {
        await controller.forceExit()
        return
      }
      const state = controller.getState()
      if (state.mode === 'mini' && state.desired === 'mini') {
        setIsMini(true)
        setSearchOpen(false)
      }
    } catch (error) {
      if (mountedRef.current) showToast(`切换小窗失败: ${String(error)}`, 'error')
    }
  }, [])

  const exitMini = useCallback(async () => {
    if (!mountedRef.current) return
    const controller = controllerRef.current
    if (!controller) return
    try {
      await controller.exit()
      if (!mountedRef.current) return
      const state = controller.getState()
      if (state.mode === 'normal' && state.desired === 'normal') setIsMini(false)
    } catch (error) {
      // Manual failure leaves the compact UI available for a retry.
      if (mountedRef.current) showToast(`恢复窗口失败: ${String(error)}`, 'error')
    }
  }, [])

  useLayoutEffect(() => {
    mountedRef.current = true
    if (isTauriApp && !controllerRef.current) {
      const win = getCurrentWindow()
      if (win.label === 'main') {
        const adapter: MiniWindowAdapter = {
          innerPhysicalSize: () => win.innerSize(),
          outerPhysicalPosition: () => win.outerPosition(),
          isResizable: () => win.isResizable(),
          isAlwaysOnTop: () => win.isAlwaysOnTop(),
          isMaximized: () => win.isMaximized(),
          setLogicalSize: (width, height) => win.setSize(new LogicalSize(width, height)),
          setPhysicalSize: size => win.setSize(new PhysicalSize(size.width, size.height)),
          setPhysicalPosition: position => win.setPosition(new PhysicalPosition(position.x, position.y)),
          setResizable: value => win.setResizable(value),
          setAlwaysOnTop: value => win.setAlwaysOnTop(value),
          maximize: () => win.maximize(),
          unmaximize: () => win.unmaximize(),
        }
        controllerRef.current = createMiniWindowController(adapter)
      }
    }
    return () => {
      mountedRef.current = false
      void controllerRef.current?.forceExit().catch(error => {
        console.error('Unmount window restoration failed', error)
      })
    }
  }, [])

  useLayoutEffect(() => {
    currentPathRef.current = location.pathname
    if (location.pathname !== '/pomodoro') {
      // Run after the layout ref update; reveal chrome before awaiting native restore.
      void Promise.resolve().then(() => {
        if (mountedRef.current && currentPathRef.current !== '/pomodoro') return forceExitMini()
      })
    }
  }, [location.pathname, forceExitMini])

  // 全局桌面级快捷键体系
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isMini) return
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
        else if (e.key === ',' && !supportsNativeSettingsMenu()) { e.preventDefault(); navigate('/settings') }
        else if (e.key.toLowerCase() === 'n') {
          // ⌘N 广播全局新建捕获事件
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('flowbox:quick_create'))
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleSearch, navigate, isMini])

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
    <div className={isMini ? 'h-screen w-screen overflow-hidden bg-surface' : 'flex h-screen w-screen overflow-hidden bg-surface relative'}>
      {!isMini && <TitleBar />}
      {!isMini && <Sidebar onSearchClick={toggleSearch} />}
      <main className={isMini ? 'h-full w-full overflow-hidden' : 'flex-1 h-full pt-10 relative overflow-hidden flex flex-col min-w-0'}>
        <div className={isMini ? 'h-full w-full' : 'flex-1 w-full h-full relative overflow-hidden px-4 lg:px-6 py-4 flex flex-col min-w-0'}>
          <Outlet context={{ triggerReview: dailyReview.triggerReview, isMini, enterMini, exitMini }} />
        </div>
        {!isMini && <StatusBar />}
      </main>
      {!isMini && <ButlerOverlay />}
      {!isMini && <GlobalSearchBar isOpen={searchOpen} onClose={() => setSearchOpen(false)} />}
      {!isMini && <DailyReviewModal
        isOpen={dailyReview.isOpen}
        onClose={dailyReview.close}
        reviewData={dailyReview.reviewData}
        aiSummary={dailyReview.aiSummary}
        isLoadingData={dailyReview.isLoadingData}
        isLoadingAi={dailyReview.isLoadingAi}
        onSave={dailyReview.saveReview}
        isSaved={dailyReview.isSaved}
      />}
      {!isMini && <ScreenshotOcrPanel
        isOpen={screenshotOcr.isOpen}
        step={screenshotOcr.step}
        ocrResult={screenshotOcr.ocrResult}
        error={screenshotOcr.error}
        onSaveAsIdea={screenshotOcr.saveAsIdea}
        onSaveAsTodo={screenshotOcr.saveAsTodo}
        onClose={screenshotOcr.close}
        onUpdateText={screenshotOcr.updateText}
        onUpdateTitle={screenshotOcr.updateTitle}
      />}
    </div>
  )
}
