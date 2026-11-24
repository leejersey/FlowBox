import { invoke, isTauri } from '@tauri-apps/api/core'

/** 列出本机「快捷指令」App 中的全部指令名称 */
export async function listMacosShortcuts(): Promise<string[]> {
  if (!isTauri()) return []
  return invoke('macos_shortcuts_list')
}

export async function runMacosShortcut(name: string): Promise<void> {
  if (!isTauri()) return
  await invoke('macos_shortcut_run', { name })
}
