import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('tsc -b 无错误', () => {
  const run = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-b'], { encoding: 'utf8' })
  assert.equal(run.status, 0, run.stdout + run.stderr)
})
