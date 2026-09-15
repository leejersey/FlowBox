import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [menu, lib] = await Promise.all([
  readFile(new URL('../src-tauri/src/settings_menu.rs', import.meta.url), 'utf8'),
  readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8'),
])

test('settings augments the default macOS application submenu while initially disabled', () => {
  assert.match(menu, /SETTINGS_ID: &str = "flowbox-settings"/)
  assert.match(menu, /Menu::default\(app.handle\(\)\)\?/)
  assert.match(menu, /items.first\(\).and_then\(\|item\| item.as_submenu\(\)\)/)
  assert.match(menu, /MenuItem::with_id\(app, SETTINGS_ID, "设置…", false, Some\("CmdOrCtrl\+,"\)\)\?/)
  assert.match(menu, /submenu.insert\(&settings, 2\)\?/)
  assert.match(menu, /app.set_menu\(menu\)\?/)
  assert.match(menu, /#\[cfg\(not\(target_os = "macos"\)\)\][\s\S]*pub fn install/)
})

test('readiness uses the injected caller and only enables the application submenu item', () => {
  assert.match(menu, /settings_menu_ready\(window: tauri::WebviewWindow\)/)
  assert.match(menu, /authorize_ready\(window.label\(\)\)\?/)
  assert.match(menu, /if label == "main"/)
  assert.match(menu, /submenu.get\(SETTINGS_ID\)/)
  assert.match(menu, /item.set_enabled\(true\)/)
  assert.doesNotMatch(menu, /\bmenu.get\(/)
})

test('only the settings menu event reveals main before emitting a targeted navigation', () => {
  const handler = menu.slice(menu.indexOf('app.on_menu_event'))
  assert.match(handler, /if event.id\(\).as_ref\(\) != SETTINGS_ID \{ return; \}/)
  assert.match(handler, /get_webview_window\("main"\)/)
  const positions = ['window.show()?', 'window.unminimize()?', 'window.set_focus()?', 'app.emit_to(']
    .map(operation => handler.indexOf(operation))
  assert.ok(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])))
  assert.match(handler, /EventTarget::WebviewWindow \{ label: "main".into\(\) \}, SETTINGS_EVENT, \(\)/)
  assert.match(menu, /SETTINGS_EVENT: &str = "flowbox:open-settings"/)
  assert.match(handler, /log::error!\(/)
  assert.doesNotMatch(handler, /WebviewWindowBuilder|\.emit\(/)
})

test('setup propagates installation errors and registers the readiness command', () => {
  assert.match(lib, /pub mod settings_menu;/)
  assert.match(lib, /generate_handler!\[[\s\S]*settings_menu::settings_menu_ready/)
  assert.match(lib, /\.setup\(move \|app\| \{\s*settings_menu::install\(app\)\?;/)
})
