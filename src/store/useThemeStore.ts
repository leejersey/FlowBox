import { create } from 'zustand'
import { settingsGet, settingsSet } from '@/services/settingsService'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeStore {
  mode: ThemeMode
  init: () => Promise<void>
  setMode: (mode: ThemeMode) => void
}

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

export const useThemeStore = create<ThemeStore>((set, get) => {
  const applyTheme = (mode: ThemeMode) => {
    const root = document.documentElement
    const isDark =
      mode === 'dark' ||
      (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }

  return {
    mode: 'system',
    init: async () => {
      let savedMode: string | null = null
      if (isTauri) {
        try {
          savedMode = await settingsGet('appearance.theme')
        } catch { /* ignore */ }
      } else {
        savedMode = localStorage.getItem('appearance.theme')
      }

      const initialMode = (savedMode === 'light' || savedMode === 'dark') ? savedMode : 'system'
      set({ mode: initialMode as ThemeMode })
      applyTheme(initialMode as ThemeMode)

      // 监听系统主题变化
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (get().mode === 'system') {
          applyTheme('system')
        }
      })
    },
    setMode: async (mode: ThemeMode) => {
      set({ mode })
      applyTheme(mode)
      if (isTauri) {
        try {
          await settingsSet('appearance.theme', mode)
        } catch { /* ignore */ }
      } else {
        localStorage.setItem('appearance.theme', mode)
      }
    }
  }
})
