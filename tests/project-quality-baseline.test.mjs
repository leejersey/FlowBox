import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { ESLint } from 'eslint'

test('项目提供统一检查脚本并隔离生成物', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)))
  assert.equal(pkg.scripts.test, 'node --test')
  assert.equal(pkg.scripts.check, 'npm run build && npm run lint && npm test')
  assert.equal(pkg.scripts['check:rust'], 'cargo check --manifest-path src-tauri/Cargo.toml && cargo test --manifest-path src-tauri/Cargo.toml')

  const eslint = new ESLint()
  for (const path of ['src/App.tsx', 'vite.config.ts']) assert.equal(await eslint.isPathIgnored(path), false)
  for (const path of ['dist/assets/x.js', '.worktrees/example/src/App.tsx', 'src-tauri/target/debug/x.js', 'node_modules/example/index.js']) {
    assert.equal(await eslint.isPathIgnored(path), true)
  }
})
