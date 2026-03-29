import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function assertUsesCoreIsTauri(filePath, label) {
  const source = await readFile(new URL(filePath, import.meta.url), 'utf8')

  assert.ok(
    source.includes("@tauri-apps/api/core"),
    `${label} 缺少 @tauri-apps/api/core 导入，环境检测可能不兼容 Tauri v2`
  )
  assert.ok(
    source.includes('isTauri()'),
    `${label} 未调用 isTauri()，会导致 Tauri 逻辑被提前跳过`
  )
}

test('剪贴板页面应使用 isTauri() 做环境检测', async () => {
  await assertUsesCoreIsTauri('../src/pages/ClipboardPage.tsx', 'ClipboardPage')
})

test('剪贴板监听 Hook 应使用 isTauri() 做环境检测', async () => {
  await assertUsesCoreIsTauri('../src/hooks/useClipboardWatcher.ts', 'useClipboardWatcher')
})
