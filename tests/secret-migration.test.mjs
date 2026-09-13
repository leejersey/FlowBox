import test from 'node:test'
import assert from 'node:assert/strict'
import { getSecret, migrateLegacySecret, migrateLegacySecrets } from '../src/services/secretService.ts'
import { initializeAppWindow } from '../src/services/appInitializationService.ts'

test('Keychain 写入成功后才删除 SQLite 明文', async () => {
  const calls = []
  const deps = {
    getSecret: async () => null,
    getLegacy: async () => 'legacy-token',
    setSecret: async () => calls.push('set'),
    deleteLegacy: async () => calls.push('delete'),
  }
  assert.deepEqual(await migrateLegacySecret('ai.openai_api_key', deps), { value: 'legacy-token', migrated: true })
  assert.deepEqual(calls, ['set', 'delete'])
})

test('Keychain 写入失败时保留 SQLite 明文', async () => {
  let deleted = false
  const result = await migrateLegacySecret('asr.volc_access_token', {
    getSecret: async () => null,
    getLegacy: async () => 'legacy-token',
    setSecret: async () => { throw new Error('denied') },
    deleteLegacy: async () => { deleted = true },
  })
  assert.deepEqual(result, { value: 'legacy-token', migrated: false, error: 'denied' })
  assert.equal(deleted, false)
  assert.equal(await getSecret('asr.volc_access_token', {
    getSecure: async () => { throw new Error('denied') },
    getLegacy: async () => 'legacy-token',
  }), 'legacy-token')
})

test('三键中间迁移失败仍继续并允许应用 ready', async () => {
  const keys = ['ai.openai_api_key', 'asr.volc_app_id', 'asr.volc_access_token']
  const attempted = [], deleted = []
  let outcomes, ready = false
  const init = await initializeAppWindow('main', [['migrate-secrets', async () => {
    outcomes = await migrateLegacySecrets(keys, {
      getSecret: async () => null,
      getLegacy: async key => `legacy:${key}`,
      setSecret: async key => { attempted.push(key); if (key === 'asr.volc_app_id') throw new Error('denied') },
      deleteLegacy: async key => deleted.push(key),
    })
  }]])
  ready = true
  assert.deepEqual(attempted, keys)
  assert.deepEqual(deleted, ['ai.openai_api_key', 'asr.volc_access_token'])
  assert.equal(outcomes[1].value, 'legacy:asr.volc_app_id')
  assert.equal(outcomes[1].migrated, false)
  assert.deepEqual(init.failures, [])
  assert.equal(ready, true)
})

test('Keychain 读取失败时保留旧值并继续迁移后续键', async () => {
  const attempted = []
  const results = await migrateLegacySecrets(['ai.openai_api_key', 'asr.volc_app_id'], {
    getSecret: async key => {
      if (key === 'ai.openai_api_key') throw new Error('unavailable')
      return null
    },
    getLegacy: async key => `legacy:${key}`,
    setSecret: async key => attempted.push(key),
    deleteLegacy: async () => {},
  })
  assert.equal(results[0].value, 'legacy:ai.openai_api_key')
  assert.equal(results[0].migrated, false)
  assert.deepEqual(attempted, ['asr.volc_app_id'])
})

test('Keychain 已有值时删除残留 SQLite 明文', async () => {
  let deleted = false
  const result = await migrateLegacySecret('ai.openai_api_key', {
    getSecret: async () => 'secure-token',
    getLegacy: async () => 'legacy-token',
    setSecret: async () => { throw new Error('should not write') },
    deleteLegacy: async () => { deleted = true },
  })
  assert.deepEqual(result, { value: 'secure-token', migrated: true })
  assert.equal(deleted, true)
})
