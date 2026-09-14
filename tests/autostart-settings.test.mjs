import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { syncAutostart, setAutostart } from '../src/services/backgroundSettingsService.ts'

test('初始化与切换都以插件 isEnabled 结果回写 DB', async () => {
  const writes = []
  const plugin = { isEnabled: async () => true, enable: async () => {}, disable: async () => {} }
  assert.equal(await syncAutostart(plugin, async (k, v) => writes.push([k, v])), true)
  assert.deepEqual(writes.at(-1), ['general.autostart', 'true'])
  await setAutostart(false, { ...plugin, isEnabled: async () => false }, async (k, v) => writes.push([k, v]))
  assert.deepEqual(writes.at(-1), ['general.autostart', 'false'])
})

test('插件切换或状态读取失败时不写 DB', async () => {
  const writes = []
  const write = async (key, value) => writes.push([key, value])
  const failedToggle = { isEnabled: async () => false, enable: async () => { throw new Error('enable failed') }, disable: async () => {} }
  await assert.rejects(setAutostart(true, failedToggle, write), /enable failed/)
  assert.deepEqual(writes, [])

  const failedRead = { ...failedToggle, enable: async () => {}, isEnabled: async () => { throw new Error('read failed') } }
  await assert.rejects(setAutostart(true, failedRead, write), /read failed/)
  assert.deepEqual(writes, [])
})

test('落库失败时把已启用的插件恢复为关闭', async () => {
  const calls = []
  let enabled = false
  const plugin = {
    isEnabled: async () => enabled,
    enable: async () => { calls.push('enable'); enabled = true },
    disable: async () => { calls.push('disable'); enabled = false },
  }
  const persistError = new Error('persist failed')

  await assert.rejects(
    setAutostart(true, plugin, async () => { throw persistError }),
    error => error === persistError,
  )
  assert.deepEqual(calls, ['enable', 'disable'])
  assert.equal(enabled, false)
})

test('切换后状态读取失败时回滚', async () => {
  const calls = []
  let reads = 0
  const readError = new Error('read failed')
  const plugin = {
    isEnabled: async () => {
      if (reads++ === 0) return false
      throw readError
    },
    enable: async () => { calls.push('enable') },
    disable: async () => { calls.push('disable') },
  }

  await assert.rejects(setAutostart(true, plugin, async () => {}), error => error === readError)
  assert.deepEqual(calls, ['enable', 'disable'])
})

test('回滚失败仍抛出原始错误', async () => {
  const calls = []
  let enabled = false
  const persistError = new Error('persist failed')
  const plugin = {
    isEnabled: async () => enabled,
    enable: async () => { enabled = true },
    disable: async () => { calls.push('disable'); throw new Error('rollback failed') },
  }

  await assert.rejects(
    setAutostart(true, plugin, async () => { throw persistError }),
    error => error === persistError,
  )
  assert.deepEqual(calls, ['disable'])
})

test('插件启用后抛错时恢复原状态并保留原始错误', async () => {
  let enabled = false
  const enableError = new Error('enable failed after mutation')
  const plugin = {
    isEnabled: async () => enabled,
    enable: async () => {
      enabled = true
      throw enableError
    },
    disable: async () => { enabled = false },
  }

  await assert.rejects(
    setAutostart(true, plugin, async () => assert.fail('不应写 DB')),
    error => error === enableError,
  )
  assert.equal(enabled, false)
})

test('并发切换串行执行且失败后队列继续', async () => {
  const events = []
  let enabled = false
  let saved
  let releaseFirstPersist
  let firstPersistStarted
  const firstPersistReady = new Promise(resolve => { firstPersistStarted = resolve })
  const releaseFirst = new Promise(resolve => { releaseFirstPersist = resolve })
  const persistError = new Error('first persist failed')
  const plugin = {
    isEnabled: async () => enabled,
    enable: async () => { events.push('enable'); enabled = true },
    disable: async () => { events.push('disable'); enabled = false },
  }
  let persists = 0
  const persist = async (_key, value) => {
    persists++
    events.push(`persist:${persists}:start:${value}`)
    if (persists === 1) {
      firstPersistStarted()
      await releaseFirst
      events.push('persist:1:fail')
      throw persistError
    }
    saved = value
    events.push(`persist:${persists}:done:${value}`)
  }

  const first = setAutostart(true, plugin, persist)
  await firstPersistReady
  const second = setAutostart(true, plugin, persist)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(events, ['enable', 'persist:1:start:true'])

  releaseFirstPersist()
  await assert.rejects(first, error => error === persistError)
  assert.equal(await second, true)
  assert.equal(enabled, true)
  assert.equal(saved, 'true')
  assert.deepEqual(events, [
    'enable',
    'persist:1:start:true',
    'persist:1:fail',
    'disable',
    'enable',
    'persist:2:start:true',
    'persist:2:done:true',
  ])
})

test('autostart 权限只授予 main 窗口', async () => {
  const defaultCapability = JSON.parse(await readFile(
    new URL('../src-tauri/capabilities/default.json', import.meta.url),
    'utf8',
  ))
  const autostartCapability = JSON.parse(await readFile(
    new URL('../src-tauri/capabilities/autostart-main.json', import.meta.url),
    'utf8',
  ))
  const permissions = [
    'autostart:allow-enable',
    'autostart:allow-disable',
    'autostart:allow-is-enabled',
  ]

  assert.deepEqual(defaultCapability.windows, ['main', 'butler'])
  assert.equal(defaultCapability.permissions.some(permission => permissions.includes(permission)), false)
  assert.equal(autostartCapability.identifier, 'autostart-main')
  assert.deepEqual(autostartCapability.windows, ['main'])
  assert.deepEqual(autostartCapability.permissions, permissions)
})
