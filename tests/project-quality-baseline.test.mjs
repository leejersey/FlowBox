import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('项目提供统一检查脚本并隔离生成物', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)))
  const eslint = await readFile(new URL('../eslint.config.js', import.meta.url), 'utf8')
  assert.equal(pkg.scripts.test, 'node --test')
  assert.match(pkg.scripts.check, /build.*lint.*test/)
  assert.match(pkg.scripts['check:rust'], /cargo check.*cargo test/)
  for (const ignored of ['.worktrees/**', 'src-tauri/target/**', 'node_modules/**']) assert.ok(eslint.includes(ignored))
})
