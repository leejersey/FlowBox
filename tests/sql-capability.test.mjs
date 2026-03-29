import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Tauri 默认能力集应包含 sql execute 权限', async () => {
  const raw = await readFile(new URL('../src-tauri/capabilities/default.json', import.meta.url), 'utf8')
  const capability = JSON.parse(raw)
  const permissions = Array.isArray(capability.permissions) ? capability.permissions : []

  assert.ok(
    permissions.includes('sql:allow-execute'),
    '缺少 sql:allow-execute，会导致 db.execute 被拒绝（如新建待办失败）'
  )
})
