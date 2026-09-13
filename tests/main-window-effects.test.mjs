import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { initializeAppWindow, registerMainWindowListener, shouldPersistUsageTick } from '../src/services/appInitializationService.ts'

test('双窗口和 StrictMode 重挂载只执行一次应用级写操作', async () => {
  const calls = []
  const steps = [['recover', async () => calls.push('recover')]]
  await Promise.all([
    initializeAppWindow('main', steps),
    initializeAppWindow('main', steps),
    initializeAppWindow('butler', steps),
  ])
  assert.deepEqual(calls, ['recover'])
  assert.equal(shouldPersistUsageTick('main'), true)
  assert.equal(shouldPersistUsageTick('butler'), false)
})

test('剪贴板只有 App 常驻 persistence subscriber，页面不得再次写库', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const clipboard = await readFile(new URL('../src/pages/ClipboardPage.tsx', import.meta.url), 'utf8')
  assert.equal(app.match(/useClipboardPersistence\(/g)?.length, 1)
  assert.match(clipboard, /useClipboardControls\(/)
  assert.doesNotMatch(clipboard, /useClipboardPersistence|clipCreate/)
})

test('异步 listen 晚到时仍安全清理，Butler 不订阅', async () => {
  let resolveListen
  let unlistenCalls = 0
  const cleanup = registerMainWindowListener('main', () => new Promise(resolve => { resolveListen = resolve }))
  cleanup()
  resolveListen(() => { unlistenCalls += 1 })
  await Promise.resolve()
  assert.equal(unlistenCalls, 1)

  let butlerListens = 0
  registerMainWindowListener('butler', async () => { butlerListens += 1; return () => {} })
  await Promise.resolve()
  assert.equal(butlerListens, 0)
})

test('密钥迁移只挂在 main-only 初始化步骤', async () => {
  const databaseHook = await readFile(new URL('../src/hooks/useDatabase.ts', import.meta.url), 'utf8')
  assert.match(databaseHook, /initializeAppWindow\([\s\S]*migrateLegacySecrets/)
  assert.doesNotMatch(databaseHook, /label\s*===\s*['"]butler['"][\s\S]*migrateLegacySecrets/)
})
