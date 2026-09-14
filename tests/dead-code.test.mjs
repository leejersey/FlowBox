import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'

test('死代码已删除且 Rust 不再声明空模块', async () => {
  for (const file of ['../src/pages/SkillsPage.tsx', '../src/App.css', '../remove_bg.py', '../src-tauri/src/services/mod_placeholder.rs', '../src-tauri/src/models/mod.rs']) {
    await assert.rejects(access(new URL(file, import.meta.url)))
  }
  const lib = await readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8')
  assert.doesNotMatch(lib, /pub mod (errors|models)/)
})
