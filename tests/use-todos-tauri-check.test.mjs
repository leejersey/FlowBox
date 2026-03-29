import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('useTodos 应使用 @tauri-apps/api/core 的 isTauri 检测运行环境', async () => {
  const source = await readFile(new URL('../src/hooks/useTodos.ts', import.meta.url), 'utf8')

  assert.ok(
    source.includes("@tauri-apps/api/core"),
    '缺少 @tauri-apps/api/core 导入，环境检测可能不兼容 Tauri v2'
  )

  assert.ok(
    source.includes('isTauri()'),
    'useTodos 未调用 isTauri()，可能导致创建成功但列表不刷新'
  )
})
