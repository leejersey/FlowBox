import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Butler 快捷键应支持动态配置并默认使用 Shift+Space', async () => {
  const [libSource, settingsSource, appShellSource, serviceSource] = await Promise.all([
    readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/SettingsPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/layout/AppShell.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/src/services/butler_shortcut.rs', import.meta.url), 'utf8'),
  ])

  assert.ok(
    serviceSource.includes('DEFAULT_BUTLER_SHORTCUT: &str = "Shift+Space"'),
    'butler_shortcut 服务应将默认快捷键设为 Shift+Space'
  )
  assert.ok(
    libSource.includes('commands::butler::butler_set_shortcut'),
    'lib.rs 应注册 butler_set_shortcut 命令'
  )
  assert.ok(
    settingsSource.includes('shortcuts.butler_hotkey'),
    'SettingsPage 应读写 shortcuts.butler_hotkey'
  )
  assert.ok(
    appShellSource.includes("invoke('butler_set_shortcut'"),
    'AppShell 应在主窗口启动时同步 Butler 快捷键'
  )
})
