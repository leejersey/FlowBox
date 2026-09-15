import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { createSettingsNavigation } from '../lib/settingsNavigation'

export function supportsNativeSettingsMenu() {
  return isTauri() && /Mac/.test(navigator.platform)
}

const root = globalThis as typeof globalThis & {
  __flowboxSettingsNavigation?: ReturnType<typeof createSettingsNavigation>
}
export const settingsNavigation = root.__flowboxSettingsNavigation ??=
  createSettingsNavigation()

export async function initializeSettingsNavigation() {
  if (!supportsNativeSettingsMenu() || getCurrentWindow().label !== 'main') return
  await settingsNavigation.start(
    () => listen('flowbox:open-settings', () => settingsNavigation.request()),
    () => invoke('settings_menu_ready'),
  )
}
