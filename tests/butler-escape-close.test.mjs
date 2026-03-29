import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Butler 页面应通过窗口级 ESC 监听关闭', async () => {
  const source = await readFile(new URL('../src/pages/ButlerPage.tsx', import.meta.url), 'utf8')

  assert.ok(
    source.includes("window.addEventListener('keydown'"),
    'ButlerPage 应在 window 上监听 keydown'
  )
  assert.ok(
    source.includes("e.key === 'Escape'"),
    'ButlerPage 应监听 Escape 键'
  )
  assert.ok(
    source.includes("invoke('hide_butler'"),
    'ButlerPage 的 ESC 处理应调用 hide_butler'
  )
})
