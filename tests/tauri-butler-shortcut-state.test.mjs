import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Tauri 应维护 Butler 快捷键状态并导出服务模块', async () => {
  const [commandsSource, servicesSource, butlerCommandSource] = await Promise.all([
    readFile(new URL('../src-tauri/src/commands/mod.rs', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/src/services/mod.rs', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/src/commands/butler.rs', import.meta.url), 'utf8'),
  ])

  assert.ok(
    servicesSource.includes('pub mod butler_shortcut;'),
    'services/mod.rs 应导出 butler_shortcut 服务模块'
  )
  assert.ok(
    butlerCommandSource.includes('pub fn butler_set_shortcut'),
    'commands/butler.rs 应暴露 butler_set_shortcut'
  )
  assert.ok(
    commandsSource.includes('pub mod butler;'),
    'commands/mod.rs 应继续导出 butler 模块'
  )
})
