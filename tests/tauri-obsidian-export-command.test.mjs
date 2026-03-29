import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Tauri 应注册 Obsidian Markdown 导出命令并写入 Inbox 目录', async () => {
  const [libSource, commandModSource, serviceModSource, commandSource, serviceSource] = await Promise.all([
    readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/src/commands/mod.rs', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/src/services/mod.rs', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/src/commands/obsidian.rs', import.meta.url), 'utf8').catch(() => ''),
    readFile(new URL('../src-tauri/src/services/obsidian_export.rs', import.meta.url), 'utf8').catch(() => ''),
  ])

  assert.ok(
    commandModSource.includes('pub mod obsidian;'),
    'commands/mod.rs 应导出 obsidian 模块'
  )
  assert.ok(
    serviceModSource.includes('pub mod obsidian_export;'),
    'services/mod.rs 应导出 obsidian_export 模块'
  )
  assert.ok(
    libSource.includes('commands::obsidian::obsidian_export_markdown'),
    'lib.rs 应注册 obsidian_export_markdown 命令'
  )
  assert.ok(
    commandSource.includes('pub fn obsidian_export_markdown'),
    'commands/obsidian.rs 应暴露 obsidian_export_markdown'
  )
  assert.ok(
    serviceSource.includes('join("Inbox")'),
    'obsidian_export 服务应将笔记写入 Inbox 目录'
  )
})
