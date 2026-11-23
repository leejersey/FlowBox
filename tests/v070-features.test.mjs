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
