import { useEffect, useState, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { Sidebar } from './Sidebar'
import { TitleBar } from './TitleBar'
import { ButlerOverlay } from './ButlerOverlay'
import { GlobalSearchBar } from './GlobalSearchBar'
import * as settingsService from '@/services/settingsService'
import { showToast } from '@/store/useToastStore'

const DEFAULT_BUTLER_SHORTCUT = 'Shift+Space'
const isTauriApp = isTauri()

export function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false)

  const toggleSearch = useCallback(() => setSearchOpen(v => !v), [])

  // Cmd+/ keyboard shortcut for global search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        toggleSearch()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleSearch])

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
      <main className="flex-1 h-full pt-10 relative overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto px-8 py-6 w-full max-w-7xl mx-auto h-full container relative">
          <Outlet />
        </div>
      </main>
      <ButlerOverlay />
      <GlobalSearchBar isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
