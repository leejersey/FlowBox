import type { CodeThemeName } from './codeThemes'

const CODE_THEME_STORAGE_KEY = 'markdown.codeTheme'

export function normalizeCodeTheme(theme: string | null | undefined): CodeThemeName {
  return theme === 'light' || theme === 'dark' ? theme : 'dark'
}

export function loadCodeThemePreference(): CodeThemeName {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  return normalizeCodeTheme(window.localStorage.getItem(CODE_THEME_STORAGE_KEY))
}

export function saveCodeThemePreference(theme: CodeThemeName) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(CODE_THEME_STORAGE_KEY, theme)
}
