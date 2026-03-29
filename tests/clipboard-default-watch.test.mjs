import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('剪贴板监听在未配置时应默认开启', async () => {
  const source = await readFile(new URL('../src/hooks/useClipboardWatcher.ts', import.meta.url), 'utf8')

  assert.ok(
    source.includes("saved !== 'false'"),
    '未配置 clipboard.auto_watch 时应默认开启监听，避免用户误以为功能未实现'
  )
})
