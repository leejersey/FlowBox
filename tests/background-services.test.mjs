import test from 'node:test'
import assert from 'node:assert/strict'
import { syncBackgroundSettings, applyBackgroundSetting } from '../src/services/backgroundSettingsService.ts'

test('启动默认开启剪贴板、关闭追踪，命令成功后才写 DB', async () => {
  const calls = []
  const deps = {
    get: async key => {
      calls.push(['get', key])
      return key === 'clipboard.auto_watch' ? null : 'false'
    },
    set: async (key, value) => calls.push(['set', key, value]),
    invoke: async (command, payload) => calls.push(['invoke', command, payload]),
  }
  await syncBackgroundSettings(deps)
  assert.deepEqual(calls[1], ['invoke', 'clipboard_set_watch', { enabled: true }])
  assert.ok(calls.find(c => c[0] === 'invoke' && c[1] === 'app_usage_set_tracking'))

  calls.length = 0
  await applyBackgroundSetting('general.app_tracking', true, deps)
  assert.equal(calls[0][0], 'invoke')
  assert.equal(calls[1][0], 'set')
  assert.equal(calls.length, 2)
})

test('设置写入失败时回滚后台运行态', async () => {
  const calls = []
  const deps = {
    get: async key => {
      calls.push(['get', key])
      return 'false'
    },
    set: async (key, value) => {
      calls.push(['set', key, value])
      throw new Error('database locked')
    },
    invoke: async (command, payload) => calls.push(['invoke', command, payload]),
  }

  await assert.rejects(
    applyBackgroundSetting('general.app_tracking', true, deps),
    /database locked/,
  )
  assert.deepEqual(calls, [
    ['invoke', 'app_usage_set_tracking', { enabled: true }],
    ['set', 'general.app_tracking', 'true'],
    ['get', 'general.app_tracking'],
    ['invoke', 'app_usage_set_tracking', { enabled: false }],
  ])
})

test('设置未保存过时按该设置默认值回滚', async () => {
  const calls = []
  const deps = {
    get: async key => {
      calls.push(['get', key])
      return null
    },
    set: async (key, value) => {
      calls.push(['set', key, value])
      throw new Error('database locked')
    },
    invoke: async (command, payload) => calls.push(['invoke', command, payload]),
  }

  await assert.rejects(
    applyBackgroundSetting('clipboard.auto_watch', false, deps),
    /database locked/,
  )
  assert.deepEqual(calls, [
    ['invoke', 'clipboard_set_watch', { enabled: false }],
    ['set', 'clipboard.auto_watch', 'false'],
    ['get', 'clipboard.auto_watch'],
    ['invoke', 'clipboard_set_watch', { enabled: true }],
  ])
})

test('回滚失败仍抛出原始设置写入错误', async () => {
  const setError = new Error('database locked')
  const deps = {
    get: async () => 'false',
    set: async () => { throw setError },
    invoke: async (_command, payload) => {
      if (!payload.enabled) throw new Error('rollback failed')
    },
  }

  await assert.rejects(
    applyBackgroundSetting('general.app_tracking', true, deps),
    error => error === setError,
  )
})
