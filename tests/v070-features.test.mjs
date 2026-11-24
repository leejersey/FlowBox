import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('全局剪贴板快选浮窗 (⇧⌘V) 已在 Tauri 窗口、权限与 Rust 快捷键中完整配置', async () => {
  const [confRaw, capRaw, libRs] = await Promise.all([
    readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/capabilities/clipboard-picker.json', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8'),
  ])

  const conf = JSON.parse(confRaw)
  const cap = JSON.parse(capRaw)
  assert.ok(conf.app.windows.some(w => w.label === 'clipboard-picker' && w.url === '/clipboard-picker'))
  assert.ok(cap.windows.includes('clipboard-picker'))
  assert.match(libRs, /CommandOrControl\+Shift\+V/)
  assert.match(libRs, /toggle_clipboard_picker/)
  assert.match(libRs, /clipboard_write_text/)
})

test('macOS 顶部菜单栏托盘与番茄倒计时标题命令已注册', async () => {
  const [cargoToml, libRs, trayRs] = await Promise.all([
    readFile(new URL('../src-tauri/Cargo.toml', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/src/tray.rs', import.meta.url), 'utf8'),
  ])

  assert.match(cargoToml, /tray-icon/)
  assert.match(libRs, /tray::install\(app\)/)
  assert.match(libRs, /tray::tray_set_title/)
  assert.match(libRs, /WindowEvent::CloseRequested/)
  assert.match(trayRs, /TrayIconBuilder::with_id/)
})

test('主窗口隐藏到菜单栏后，点击 Dock 图标可通过 RunEvent::Reopen 唤回', async () => {
  const libRs = await readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8')

  assert.match(libRs, /RunEvent::Reopen/)
  assert.match(libRs, /\.build\(tauri::generate_context!\(\)\)/)
})

test('剪贴板快选回车后切回原应用并模拟 ⌘V 粘贴', async () => {
  const [libRs, clipboardRs, pasteRs, pickerTsx] = await Promise.all([
    readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/src/commands/clipboard.rs', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/src/services/paste_back.rs', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/ClipboardPickerPage.tsx', import.meta.url), 'utf8'),
  ])

  assert.match(libRs, /clipboard_paste_selection/)
  assert.match(clipboardRs, /paste_back::remember_frontmost_app\(\)/)
  assert.match(pasteRs, /AXIsProcessTrusted/)
  assert.match(pasteRs, /CGEventFlagCommand/)
  assert.match(pickerTsx, /invoke<string>\('clipboard_paste_selection'/)
})
