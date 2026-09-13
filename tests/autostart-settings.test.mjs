import test from 'node:test'
import assert from 'node:assert/strict'
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
