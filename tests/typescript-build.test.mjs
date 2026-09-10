import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tsc = path.join(repoRoot, 'node_modules/typescript/bin/tsc')

test('tsc -b 无错误', () => {
  const run = spawnSync(process.execPath, [tsc, '-b'], { cwd: repoRoot, encoding: 'utf8' })
  assert.equal(run.status, 0, run.stdout + run.stderr)
})
