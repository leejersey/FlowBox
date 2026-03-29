import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Markdown 页面应支持导出到 Obsidian Inbox 并生成默认文件名', async () => {
  const [pageSource, serviceSource] = await Promise.all([
    readFile(new URL('../src/pages/MarkdownPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/obsidianService.ts', import.meta.url), 'utf8').catch(() => ''),
  ])

  assert.ok(
    pageSource.includes('generateDefaultFileName'),
    'MarkdownPage 应包含默认文件名生成逻辑'
  )
  assert.ok(
    pageSource.includes("setSetting('obsidian.vault_path'"),
    'MarkdownPage 导出前应保存 obsidian.vault_path'
  )
  assert.ok(
    serviceSource.includes("invoke('obsidian_export_markdown'"),
    'obsidianService 应调用 obsidian_export_markdown'
  )
})
